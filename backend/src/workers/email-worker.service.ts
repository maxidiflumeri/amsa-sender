// workers/email-worker.service.ts
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { connection } from 'src/queues/bullmq.config';
import { insertHeaderAndFooter, renderTemplate } from 'src/common/renderTemplate';
import { getDatosFromContacto } from 'src/common/getDatosFromContacto';
import * as nodemailer from 'nodemailer';
import { RedisClientType } from 'redis';

@Injectable()
export class EmailWorkerService implements OnModuleInit {
    private readonly logger = new Logger(EmailWorkerService.name);

    constructor(
        private prisma: PrismaService,
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
            auth: {
                user: smtp.usuario,
                pass: smtp.password,
            },
        });

        for (const contacto of campania.contactos) {
            const datos = getDatosFromContacto(contacto.datos);
            const html = renderTemplate(template.html, datos);
            const subject = renderTemplate(template.asunto, datos);

            const reporte = await this.prisma.reporteEmail.create({
                data: {
                    campañaId: idCampania,
                    contactoId: contacto.id,
                    estado: 'pendiente', // aún no enviado
                    asunto: subject,
                    html, // HTML ya renderizado
                    creadoAt: new Date(),
                },
            });
            const verEnNavegadorUrl = `http://localhost:5173/mailing/vista/${reporte.id}`;
            //const verEnNavegadorUrl = `https://amsasender.anamayasa.com.ar/mailing/vista/${reporte.id}`;

            try {
                await transporter.sendMail({
                    from: smtp.usuario,
                    to: contacto.email,
                    subject,
                    html: insertHeaderAndFooter(html, verEnNavegadorUrl),
                });

                enviados++;

                await this.prisma.reporteEmail.update({
                    where: { id: reporte.id },
                    data: {
                        estado: 'enviado',
                        enviadoAt: new Date(),
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
                    },
                });
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