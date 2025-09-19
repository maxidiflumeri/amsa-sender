// workers/email-worker.service.ts
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { connection } from 'src/queues/bullmq.config';
import { insertHeaderAndFooter, renderTemplate } from 'src/common/renderTemplate';
import { getDatosFromContacto } from 'src/common/getDatosFromContacto';
import * as nodemailer from 'nodemailer';
import { RedisClientType } from 'redis';
//import { prepararHtmlConTracking } from 'src/common/inyectEmailTracking';
import { prepararHtmlConTracking_safe } from 'src/common/inyectEmailTracking';
import { generarTrackingTok } from 'src/common/generateTrackingTok';
import { randomUUID } from 'node:crypto';
import { buildAmsaHeader, injectHtmlMarker } from 'src/common/bounce.common';
import { EmailDesuscribirService } from 'src/modules/email/desuscribir-email/desuscribir-email.service';
import { hashEmail, normalizeEmail } from 'src/common/email-normalize.common';
import { acquireGlobalSesSlot, chunkArray, sleep } from 'src/common/rate-limit';

@Injectable()
export class EmailWorkerService implements OnModuleInit {
    private readonly logger = new Logger(EmailWorkerService.name);
    private smtpHost = process.env.AWS_SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com';
    private smtpPort = process.env.AWS_SMTP_PORT || '587'
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
        const worker = new Worker(
            'emailsEnvios',
            this.procesarJob.bind(this),
            {
                connection,
                concurrency: 5
            }
        );

        worker.on('failed', (job, err) => {
            this.logger.error(`❌ Job ${job?.id ?? 'unknown'} falló: ${err.message}`);
        });

        this.logger.log('👷 Worker de Email iniciado y escuchando jobs en "emailsEnvios"...');
    }

    async procesarJob(job: Job) {
        // ===== Parámetros de performance =====
        const RATE_GLOBAL = Number(process.env.SES_RATE_LIMIT_PER_SEC ?? '14');       // límite global SES (msg/s)
        const BATCH_SIZE = Number(process.env.EMAIL_SEND_BATCH_SIZE ?? '5');         // tamaño de lote concurrente
        const MAX_PARALLEL_CAMPAIGNS = 5;                                             // tu concurrency del worker
        const PER_CAMPAIGN_FLOOR = Number(process.env.EMAILS_PER_SEC_FLOOR_PER_CAMPAIGN ?? '0');

        // “piso” por campaña para distribución conservadora cuando corren varias a la vez
        const perCampaignPerSec = Math.max(
            PER_CAMPAIGN_FLOOR,
            Math.floor(RATE_GLOBAL / Math.max(1, MAX_PARALLEL_CAMPAIGNS))
        );
        // pausa mínima entre lotes de esta campaña (suaviza picos si hay varias campañas)
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

        const transporter = nodemailer.createTransport({
            host: this.smtpHost,
            port: parseInt(this.smtpPort),
            secure: false,
            auth: { user: this.smtpUser, pass: this.smtpPassword },
            pool: true,
            maxConnections: 4,     // cuántas conexiones simultáneas mantiene abiertas
            maxMessages: Infinity, // no reciclamos a menos que SES cierre
        });

        const contactos = campania.contactos;
        const lotes = chunkArray(contactos, BATCH_SIZE);

        for (const lote of lotes) {
            const tareas = lote.map(async (contacto) => {
                // 1) Desuscripción (no consume rate ni SMTP)
                const norm = normalizeEmail(contacto.email);
                const h = hashEmail(norm);
                const isSuppressed = await this.prisma.emailDesuscripciones.findFirst({
                    where: {
                        tenantId: 'amsa-sender', // ajustar si multi-tenant
                        emailHash: h,
                        OR: [{ scope: 'global' }, { scope: 'campaign' }],
                    },
                    select: { id: true },
                });

                if (isSuppressed) {
                    this.logger.log(`⛔ Omitido ${contacto.email} (desuscripto)`);
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

                // 2) Render base + crear reporte “pendiente”
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
                    // 3) Preparación HTML final con tracking + headers
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

                    // 4) Rate limit global de SES (comparte slots entre campañas)
                    await acquireGlobalSesSlot(this.pubClient, RATE_GLOBAL);

                    // 5) Enviar
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

                    // 6) Persistir enviado
                    await this.prisma.reporteEmail.update({
                        where: { id: reporte.id },
                        data: {
                            estado: 'enviado',
                            enviadoAt: new Date(),
                            html: htmlConMarker, // el HTML realmente enviado
                            smtpMessageId: messageId,
                        },
                    });

                    this.logger.log(`✅ Enviado a ${contacto.email}`);
                    return { ok: true, skipped: false };
                } catch (err: any) {
                    this.logger.warn(`⚠️ Fallo al enviar a ${contacto.email}: ${err.message}`);
                    await this.prisma.reporteEmail.update({
                        where: { id: reporte.id },
                        data: { estado: 'fallo', error: err.message, enviadoAt: new Date() },
                    });
                    return { ok: false, skipped: false, error: err.message };
                }
            });

            // Ejecutamos el lote en paralelo (que ningún error tire el lote)
            const resultados = await Promise.allSettled(tareas);

            // Progreso del lote (contamos enviados + desuscriptos para UX)
            let enviadosEnLote = 0;
            for (const r of resultados) {
                if (r.status === 'fulfilled') {
                    const v: any = r.value;
                    if (v?.ok || v?.skipped) enviadosEnLote += 1;
                }
            }
            enviados += enviadosEnLote;

            await this.subClient.publish('progreso-envio-mail', JSON.stringify({
                campañaId: idCampania,
                enviados,
                total,
            }));

            // Pausa mínima entre lotes para suavizar picos si hay varias campañas
            if (minMsBetweenBatches > 0) {
                await sleep(minMsBetweenBatches);
            }
        }

        // Progreso final
        await this.subClient.publish('progreso-envio-mail', JSON.stringify({
            campañaId: idCampania,
            enviados,
            total,
        }));

        await this.prisma.campañaEmail.update({
            where: { id: idCampania },
            data: { estado: 'finalizada', enviadoAt: new Date() },
        });

        await this.subClient.publish('campania-finalizada', JSON.stringify({ campañaId: idCampania }));

        this.logger.log(`🏁 Campaña ${idCampania} finalizada. Total procesados: ${enviados}/${total}`);
    }
}