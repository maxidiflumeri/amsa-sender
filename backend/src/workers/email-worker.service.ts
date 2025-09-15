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

@Injectable()
export class EmailWorkerService implements OnModuleInit {
    private readonly logger = new Logger(EmailWorkerService.name);

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
            host: smtp.host,
            port: smtp.puerto,
            secure: false,
            name: 'amsasender.anamayasa.com',
            requireTLS: true,
            tls: {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true
            },                               
            auth: {
                user: smtp.usuario,
                pass: smtp.password,
            },
        });

        for (const contacto of campania.contactos) {
            const norm = normalizeEmail(contacto.email);
            const h = hashEmail(norm);
            const isSuppressed = await this.prisma.emailDesuscripciones.findFirst({
                where: {
                    tenantId: 'amsa-sender', // o del campaign si es multi-tenant
                    emailHash: h,
                    OR: [
                        { scope: 'global' },
                        { scope: 'campaign' },
                    ],
                },
                select: { id: true },
            });

            if (!isSuppressed) {
                const datos = getDatosFromContacto(contacto.datos);
                const html = renderTemplate(template.html, datos);
                const subject = renderTemplate(template.asunto, datos);

                // 1) Crear Reporte "pendiente" (como ya hacías)
                const reporte = await this.prisma.reporteEmail.create({
                    data: {
                        campañaId: idCampania,
                        contactoId: contacto.id,
                        estado: 'pendiente',
                        asunto: subject,
                        html, // HTML base renderizado (sin tracking aún)
                        creadoAt: new Date(),
                    },
                });

                // 2) URL "ver en navegador"
                const verEnNavegadorUrl = `${process.env.FRONT_BASE_URL}/mailing/vista/${reporte.id}`;
                // const verEnNavegadorUrl = `https://amsasender.anamayasa.com.ar/mailing/vista/${reporte.id}`;

                try {
                    // 3) 🔵 Generar token (si no tuviera)
                    const tok = reporte.trackingTok || generarTrackingTok();
                    if (!reporte.trackingTok) {
                        await this.prisma.reporteEmail.update({
                            where: { id: reporte.id },
                            data: { trackingTok: tok },
                        });
                    }

                    const token = this.descService.signUnsubToken({
                        tenantId: 'amsa-sender',
                        email: contacto.email,            // del contacto
                        campaignId: idCampania,       // opcional
                        scope: 'global',  // o 'campaign' si preferís
                    });

                    const apiBase = this.getApiBaseUrl();
                    const unsubUrl = `${apiBase}/email/desuscripciones/u?u=${encodeURIComponent(token)}`;

                    // 4) 🔵 Armar HTML final:
                    //    Primero aplico header/footer; luego inyecto pixel y reescribo links
                    const htmlConLayout = insertHeaderAndFooter(html, verEnNavegadorUrl, unsubUrl);
                    const htmlFinal = prepararHtmlConTracking_safe(htmlConLayout, apiBase, tok);
                    const secret = process.env.AMSA_BOUNCE_SECRET || '';
                    const domain = 'anamayasa.com.ar'; // o sacalo de config
                    const messageId = `<${reporte.id}.${randomUUID()}@${domain}>`;
                    const xHeader = buildAmsaHeader(reporte.id, contacto.email, messageId, secret);
                    const htmlConMarker = injectHtmlMarker(htmlFinal, xHeader);

                    // 5) Enviar
                    await transporter.sendMail({
                        from: `"${smtp.remitente}" <${smtp.usuario}>`, // si querés mostrar remitente: `"${smtp.remitente}" <${smtp.emailFrom || smtp.usuario}>`
                        to: contacto.email,
                        subject,
                        html: htmlConMarker,
                        // 👇 envelope controla el Return-Path real del sobre
                        envelope: {
                            from: 'rebotes@anamayasa.com.ar', // casilla que creaste en Workspace
                            to: contacto.email
                        },
                        messageId, // lo fijamos nosotros
                        headers: {
                            'X-AMSASender': xHeader,
                            "List-Unsubscribe": `<${unsubUrl}>`,
                            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                        },
                    });

                    enviados++;

                    // 6) 🔵 Guardar estado + html final con tracking
                    await this.prisma.reporteEmail.update({
                        where: { id: reporte.id },
                        data: {
                            estado: 'enviado',
                            enviadoAt: new Date(),
                            html: htmlConMarker, // guardamos el HTML que se envió realmente (con pixel + links reescritos),
                            smtpMessageId: messageId,
                        },
                    });

                    await this.subClient.publish('progreso-envio-mail', JSON.stringify({
                        campañaId: idCampania,
                        enviados,
                        total,
                    }));

                    this.logger.log(`✅ Enviado a ${contacto.email}`);

                } catch (err) {
                    this.logger.warn(`⚠️ Fallo al enviar a ${contacto.email}: ${err.message}`);

                    await this.prisma.reporteEmail.update({
                        where: { id: reporte.id },
                        data: {
                            estado: 'fallo',
                            error: err.message,
                            enviadoAt: new Date(),
                            // (opcional) podés persistir htmlConLayout/htmlFinal si lo calculaste antes del send
                        },
                    });
                }
            } else {
                this.logger.log(`⛔ Omitido ${contacto.email} (está desuscripto)`);
                await this.prisma.reporteEmail.create({
                    data: {
                        campañaId: idCampania,
                        contactoId: contacto.id,
                        estado: 'Desuscripto',
                        asunto: '',
                        html: '', // HTML base renderizado (sin tracking aún)
                        creadoAt: new Date(),
                    },
                });

                enviados++;
            }
        }

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

        this.logger.log(`🏁 Campaña ${idCampania} finalizada. Total enviados: ${enviados}/${total}`);
    }
}