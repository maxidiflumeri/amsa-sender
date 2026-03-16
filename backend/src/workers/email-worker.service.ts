// workers/email-worker.service.ts
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { connection } from 'src/queues/bullmq.config';
import { insertHeaderAndFooter, renderTemplate } from 'src/common/renderTemplate';
import { getDatosFromContacto } from 'src/common/getDatosFromContacto';
import * as nodemailer from 'nodemailer';
import { RedisClientType } from 'redis';
import { prepararHtmlConTracking_safe } from 'src/common/inyectEmailTracking';
import { generarTrackingTok } from 'src/common/generateTrackingTok';
import { randomUUID } from 'node:crypto';
import { buildAmsaHeader, injectHtmlMarker } from 'src/common/bounce.common';
import { EmailDesuscribirService } from 'src/modules/email/desuscribir-email/desuscribir-email.service';
import { hashEmail, normalizeEmail } from 'src/common/email-normalize.common';
import { acquireGlobalSesSlot, chunkArray, sleep } from 'src/common/rate-limit';
import { Prisma } from '@prisma/client'; // ✅ NUEVO para $queryRaw seguro

@Injectable()
export class EmailWorkerService implements OnModuleInit {
    private readonly logger = new Logger(EmailWorkerService.name);
    private smtpHost = process.env.AWS_SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com';
    private smtpPort = process.env.AWS_SMTP_PORT || '587';
    private smtpUser = process.env.AWS_SMTP_USER || '';
    private smtpPassword = process.env.AWS_SMTP_PASSWORD || '';

    private getApiBaseUrl(): string {
        return process.env.PUBLIC_API_BASE_URL || 'http://localhost:5001/api';
    }

    constructor(
        private prisma: PrismaService,
        private descService: EmailDesuscribirService,
        @Inject('EMAIL_REDIS_CLIENT') private readonly pubClient: RedisClientType,
        @Inject('EMAIL_REDIS_SUB') private readonly subClient: RedisClientType,
    ) { }

    async onModuleInit() {
        const worker = new Worker('emailsEnvios', this.procesarJob.bind(this), {
            connection,
            concurrency: Number(process.env.EMAIL_MAX_PARALLEL_CAMPAIGNS ?? '5'),
        });

        worker.on('failed', async (job, err) => {
            this.logger.error(`❌ Job ${job?.id ?? 'unknown'} falló: ${err.message}`);
            const campañaId = job?.data?.idCampania;
            if (campañaId) {
                try {
                    await this.prisma.campañaEmail.update({
                        where: { id: campañaId },
                        data: { estado: 'error' },
                    });
                    this.logger.warn(`⚠️ Campaña email ${campañaId} marcada como "error" por fallo del job.`);
                    await this.subClient.publish('campania-error', JSON.stringify({ campañaId, tipo: 'email' }));
                } catch (e) {
                    this.logger.error(`❌ No se pudo marcar campaña email ${campañaId} como error: ${e.message}`);
                }
            }
        });

        this.logger.log('👷 Worker de Email iniciado y escuchando jobs en "emailsEnvios"...');
    }

    async procesarJob(job: Job) {
        // ===== Parámetros de performance =====
        const RATE_GLOBAL = Number(process.env.SES_RATE_LIMIT_PER_SEC ?? '14'); // límite global SES (msg/s)
        const BATCH_SIZE = Number(process.env.EMAIL_SEND_BATCH_SIZE ?? '5'); // tamaño de lote concurrente
        const MAX_PARALLEL_CAMPAIGNS = Number(process.env.EMAIL_MAX_PARALLEL_CAMPAIGNS ?? '5'); // tu concurrency del worker
        const PER_CAMPAIGN_FLOOR = Number(process.env.EMAILS_PER_SEC_FLOOR_PER_CAMPAIGN ?? '0');

        const perCampaignPerSec = Math.max(
            PER_CAMPAIGN_FLOOR,
            Math.floor(RATE_GLOBAL / Math.max(1, MAX_PARALLEL_CAMPAIGNS)),
        );
        const minMsBetweenBatches = Math.ceil((BATCH_SIZE / Math.max(1, perCampaignPerSec)) * 1000);

        const { idCampania, idTemplate, idCuentaSmtp } = job.data;
        this.logger.log(`📨 Procesando campañaEmail ${idCampania}...`);

        const campania = await this.prisma.campañaEmail.findUnique({
            where: { id: idCampania },
            include: { contactos: true },
        });
        if (!campania) {
            this.logger.error(`❌ Campaña con ID ${idCampania} no encontrada.`);
            return;
        }

        const template = await this.prisma.templateEmail.findUnique({
            where: { id: idTemplate },
        });
        if (!template) {
            this.logger.error(`❌ Template con ID ${idTemplate} no encontrado.`);
            return;
        }

        const smtp = await this.prisma.cuentaSMTP.findUnique({
            where: { id: idCuentaSmtp },
        });
        if (!smtp) {
            this.logger.error(`❌ Cuenta SMTP con ID ${idCuentaSmtp} no encontrada.`);
            return;
        }

        const total = campania.contactos.length;
        let enviados = 0;

        await this.subClient.publish('campania-estado', JSON.stringify({ campañaId: idCampania }));
        await this.prisma.campañaEmail.update({
            where: { id: idCampania },
            data: { estado: 'procesando' },
        });
        // Limpiar logs anteriores de este run
        try { await this.pubClient.del(`campania-email-logs:${idCampania}`); } catch {}
        await this.publicarLog(idCampania, 'info', `▶️ Iniciando: ${total} contactos`);

        const transporter = nodemailer.createTransport({
            host: this.smtpHost,
            port: parseInt(this.smtpPort),
            secure: false,
            auth: { user: this.smtpUser, pass: this.smtpPassword },
            pool: true,
            maxConnections: 4,
            maxMessages: Infinity,
        });

        const contactos = campania.contactos;

        // =============== 🚀 PRE-CARGA BATCH: desuscriptos + suprimidos ===============
        const allEmails = contactos.map((c) => c.email).filter(Boolean);
        const uniqueNorm = Array.from(new Set(allEmails.map((e) => normalizeEmail(e))));
        // 1) Desuscripciones por hash (batch)
        const hashes = uniqueNorm.map((e) => hashEmail(e));
        const desus = await this.prisma.emailDesuscripciones.findMany({
            where: {
                tenantId: 'amsa-sender', // ajustar si multi-tenant
                emailHash: { in: hashes },
                OR: [{ scope: 'global' }, { scope: 'campaign' }],
            },
            select: { emailHash: true },
        });
        const unsubHashSet = new Set(desus.map((x) => x.emailHash));

        // 2) Suprimidos por vista (batch) -> traigo info para log/reporte
        const suppressedRows: Array<{ email: string; bounceType: string | null; bounceSubType: string | null }> =
            uniqueNorm.length
                ? await this.prisma.$queryRaw(
                    Prisma.sql`SELECT email, bounceType, bounceSubType
                       FROM vw_email_suppression
                       WHERE isSuppressed = 1
                         AND email IN (${Prisma.join(uniqueNorm)})`,
                )
                : [];
        const suppressedMap = new Map<string, { bounceType: string | null; bounceSubType: string | null }>();
        for (const r of suppressedRows) {
            const k = normalizeEmail(r.email);
            suppressedMap.set(k, { bounceType: r.bounceType, bounceSubType: r.bounceSubType });
        }
        // ============================================================================

        const lotes = chunkArray(contactos, BATCH_SIZE);

        for (const lote of lotes) {
            const tareas = lote.map(async (contacto) => {
                const norm = normalizeEmail(contacto.email);
                const h = hashEmail(norm);

                // (A) Omitir si DESUSCRIPTO (sin consumir rate/SMTP)
                if (unsubHashSet.has(h)) {
                    this.logger.log(`⛔ Omitido ${contacto.email} (desuscripto)`);
                    await this.publicarLog(idCampania, 'skip', `⛔ Omitido: ${contacto.email}  (desuscripto)`);
                    await this.prisma.reporteEmail.create({
                        data: {
                            campañaId: idCampania,
                            contactoId: contacto.id,
                            estado: 'Desuscripto',
                            asunto: '',
                            html: '',
                            creadoAt: new Date(),
                        },
                    });
                    return { ok: true, skipped: true };
                }

                // (B) Omitir si SUPRIMIDO (hard bounce/complaint previo)
                const sup = suppressedMap.get(norm);
                if (sup) {
                    const motivo = `Suppressed (hard bounce/complaint): ${sup.bounceType ?? ''}/${sup.bounceSubType ?? ''}`.trim();
                    this.logger.log(`⛔ Omitido ${contacto.email} (suprimido) ${motivo}`);
                    await this.publicarLog(idCampania, 'skip', `⛔ Omitido: ${contacto.email}  (suprimido — ${sup.bounceType ?? 'bounce'})`);
                    await this.prisma.reporteEmail.create({
                        data: {
                            campañaId: idCampania,
                            contactoId: contacto.id,
                            estado: 'omitido', // p. ej. 'omitido' (ajustá si tu enum no lo contempla)
                            asunto: '',
                            html: '',
                            error: motivo,
                            creadoAt: new Date(),
                        },
                    });
                    return { ok: true, skipped: true };
                }

                // ======== Continúa el flujo normal de envío ========
                const datos = getDatosFromContacto(contacto.datos);
                const htmlBase = renderTemplate(template.html, datos);
                const subject = renderTemplate(template.asunto, datos);

                const reporte = await this.prisma.reporteEmail.create({
                    data: {
                        campañaId: idCampania,
                        contactoId: contacto.id,
                        estado: 'pendiente',
                        asunto: subject,
                        html: htmlBase, // guardamos base por trazabilidad
                        creadoAt: new Date(),
                    },
                });

                try {
                    const tok = reporte.trackingTok || generarTrackingTok();
                    if (!reporte.trackingTok) {
                        await this.prisma.reporteEmail.update({
                            where: { id: reporte.id },
                            data: { trackingTok: tok },
                        });
                    }

                    const apiBase = this.getApiBaseUrl();
                    const tokenUnsub = this.descService.signUnsubToken({
                        tenantId: 'amsa-sender',
                        email: contacto.email,
                        campaignId: idCampania,
                        scope: 'global',
                    });
                    const unsubUrl = `${apiBase}/email/desuscripciones/u?u=${encodeURIComponent(tokenUnsub)}`;
                    const verEnNavegadorUrl = `${process.env.FRONT_BASE_URL}/mailing/vista/${reporte.id}`;

                    const htmlConLayout = insertHeaderAndFooter(htmlBase, verEnNavegadorUrl, unsubUrl);
                    const htmlFinal = prepararHtmlConTracking_safe(htmlConLayout, apiBase, tok);

                    const secret = process.env.AMSA_BOUNCE_SECRET || '';
                    const domain = 'anamayasa.com.ar'; // o desde config
                    const messageId = `<${reporte.id}.${randomUUID()}@${domain}>`;
                    const xHeader = buildAmsaHeader(reporte.id, contacto.email, messageId, secret);
                    const htmlConMarker = injectHtmlMarker(htmlFinal, xHeader);

                    // Rate limit global SES
                    await acquireGlobalSesSlot(this.pubClient, RATE_GLOBAL);

                    // Enviar
                    await transporter.sendMail({
                        from: `"${smtp.remitente}" <${smtp.usuario}>`,
                        to: contacto.email,
                        subject,
                        html: htmlConMarker,
                        replyTo: smtp.usuario,
                        messageId,
                        headers: {
                            'X-AMSASender': xHeader,
                            'List-Unsubscribe': `<${unsubUrl}>`,
                            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                            'X-SES-CONFIGURATION-SET': process.env.SES_CONFIG_SET || '',
                        },
                    });

                    await this.prisma.reporteEmail.update({
                        where: { id: reporte.id },
                        data: {
                            estado: 'enviado',
                            enviadoAt: new Date(),
                            html: htmlConMarker,
                            smtpMessageId: messageId,
                        },
                    });

                    await this.publicarLog(idCampania, 'ok', `✅ Enviado: ${contacto.email}`);
                    this.logger.log(`✅ Enviado a ${contacto.email}`);
                    return { ok: true, skipped: false };
                } catch (err: any) {
                    this.logger.warn(`⚠️ Fallo al enviar a ${contacto.email}: ${err.message}`);
                    await this.publicarLog(idCampania, 'warn', `⚠️ Fallo: ${contacto.email} — ${err.message}`);
                    await this.prisma.reporteEmail.update({
                        where: { id: reporte.id },
                        data: { estado: 'fallo', error: err.message, enviadoAt: new Date() },
                    });
                    return { ok: false, skipped: false, error: err.message };
                }
            });

            const resultados = await Promise.allSettled(tareas);

            let enviadosEnLote = 0;
            for (const r of resultados) {
                if (r.status === 'fulfilled') {
                    const v: any = r.value;
                    if (v?.ok || v?.skipped) enviadosEnLote += 1;
                }
            }
            enviados += enviadosEnLote;

            await this.subClient.publish(
                'progreso-envio-mail',
                JSON.stringify({
                    campañaId: idCampania,
                    enviados,
                    total,
                }),
            );

            if (minMsBetweenBatches > 0) {
                await sleep(minMsBetweenBatches);
            }
        }

        await this.subClient.publish(
            'progreso-envio-mail',
            JSON.stringify({
                campañaId: idCampania,
                enviados,
                total,
            }),
        );

        await this.prisma.campañaEmail.update({
            where: { id: idCampania },
            data: { estado: 'finalizada', enviadoAt: new Date() },
        });

        await this.subClient.publish('campania-finalizada', JSON.stringify({ campañaId: idCampania }));
        await this.publicarLog(idCampania, 'info', `🏁 Finalizada — ${enviados}/${total} procesados`);

        this.logger.log(`🏁 Campaña ${idCampania} finalizada. Total procesados: ${enviados}/${total}`);
    }

    private async publicarLog(campañaId: number, nivel: 'ok' | 'warn' | 'error' | 'info' | 'skip', mensaje: string): Promise<void> {
        const payload = JSON.stringify({ campañaId, nivel, mensaje, timestamp: new Date().toISOString() });
        try {
            await this.subClient.publish('campania-log', payload);
            // Persiste en lista Redis para historial (últimas 200 entradas, TTL 24h)
            const key = `campania-email-logs:${campañaId}`;
            await this.pubClient.rPush(key, payload);
            await this.pubClient.lTrim(key, -500, -1);
            await this.pubClient.expire(key, 86400);
        } catch { /* silenciar errores de log para no interrumpir el envío */ }
    }
}