import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { DateTime } from 'luxon';
import { ReportesEmailService } from 'src/modules/email/reportes-email/reportes-email.service';
import { Worker, Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ReportesWorkerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ReportesWorkerService.name);

    private worker: Worker;

    // SMTP (.env o defaults)
    private smtpHost = process.env.AWS_SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com';
    private smtpPort = process.env.AWS_SMTP_PORT || '587';
    private smtpUser = process.env.AWS_SMTP_USER || '';
    private smtpPassword = process.env.AWS_SMTP_PASSWORD || '';

    constructor(
        private readonly prisma: PrismaService,
        private readonly reportes: ReportesEmailService,
        @InjectQueue('reportesEmail') private readonly reportesQueue: Queue, // 👈 tomamos la connection
    ) { }

    // ====== Bootstrap del WORKER, igual que tus otros ======
    async onModuleInit() {
        // Usa la misma conexión Redis que la cola de Nest
        const connection = (this.reportesQueue as any)?.opts?.connection;

        this.worker = new Worker(
            'reportesEmail',
            async (job: Job<{ tareaId: number }>) => {
                return await this.procesarTarea(job); // devolvemos { skipped: boolean } | void
            },
            { connection, concurrency: 1 },
        );

        this.worker.on('failed', (job, err) => {
            this.logger.error(`Job ${job?.id} falló: ${err?.message}`);
        });

        this.worker.on('completed', (job, result: any) => {
            if (result?.skipped) {
                this.logger.debug(`Job ${job?.id} omitido (tarea pausada)`);
            } else {
                this.logger.log(`Job ${job?.id} completado`);
            }
        });

        this.logger.log('ReportesWorker inicializado y escuchando cola "reportesEmail"');
    }

    async onModuleDestroy() {
        if (this.worker) await this.worker.close();
    }

    // ====== LÓGICA DEL JOB (igual a tu versión) ======
    // Cambiá la firma para recibir el job
    async procesarTarea(job: Job<{ tareaId: number }>): Promise<{ skipped: boolean } | void> {
        const tareaId = job.data.tareaId;

        // Guard liviano: solo habilitada
        const estado = await this.prisma.tareaProgramada.findUnique({
            where: { id: tareaId },
            select: { habilitada: true },
        });

        if (!estado?.habilitada) {
            this.logger.debug(`[ReportesWorkerService] Ignoro job por tarea pausada tareaId=${tareaId}`);
            return { skipped: true };
        }

        // Cargamos la tarea completa recién ahora
        const tarea = await this.prisma.tareaProgramada.findUnique({ where: { id: tareaId } });
        if (!tarea) {
            this.logger.warn(`[ReportesWorkerService] Tarea ${tareaId} no existe, omito`);
            return { skipped: true };
        }

        // ✅ Log recién acá (tarea activa)
        this.logger.log(`Procesando reportesEmail jobId=${job.id} tareaId=${tareaId}`);

        const ejec = await this.prisma.ejecucionTarea.create({
            data: { tareaId: tarea.id, estado: 'running', inicioEn: new Date() },
        });

        try {
            const cfg = (tarea.configuracion as any) || {};
            const rep = cfg.reportes ?? { rebotes: true, acciones: true };
            const zone = tarea.zonaHoraria || 'America/Argentina/Buenos_Aires';

            const startLocal = DateTime.now().setZone(zone).minus({ days: 1 }).startOf('day');
            const endLocal = startLocal.endOf('day');
            const desde = startLocal.toJSDate();
            const hasta = endLocal.toJSDate();
            const yyyyMMdd = startLocal.toFormat('yyyy-LL-dd');

            const adjuntos: { filename: string; content: Buffer; contentType: string }[] = [];

            if (rep.rebotes) {
                const r = await this.reportes.generarCsvRebotes({ desde, hasta });
                const buf = Buffer.isBuffer(r) ? r : Buffer.from(r, 'utf8');
                adjuntos.push({ filename: `rebotes_${yyyyMMdd}.csv`, content: buf, contentType: 'text/csv' });
            }

            if (rep.acciones) {
                const r = await this.reportes.generarCsvActividades({ desde, hasta });
                const buf = Buffer.isBuffer(r) ? r : Buffer.from(r, 'utf8');
                adjuntos.push({ filename: `acciones_${yyyyMMdd}.csv`, content: buf, contentType: 'text/csv' });
            }

            const destinatarios: string[] = tarea.destinatarios as any;
            const asuntoTpl = cfg.asuntoTpl ?? 'AMSA Sender – Reportes del ${DATE}';
            const htmlTpl = cfg.htmlTpl ?? `<p>Adjuntamos los reportes del <b>${yyyyMMdd}</b>.</p><p>— AMSA Sender</p>`;
            const asunto = asuntoTpl.replace('${DATE}', yyyyMMdd);
            const html = htmlTpl;

            const fromEmail = process.env.MAIL_FROM_EMAIL || 'reportes@anamayasa.com.ar';
            const fromName = process.env.MAIL_FROM_NAME || 'AMSA Sender';
            const from = `${fromName} <${fromEmail}>`;

            const transporter = nodemailer.createTransport({
                host: this.smtpHost,
                port: parseInt(this.smtpPort, 10),
                secure: false,
                auth: { user: this.smtpUser, pass: this.smtpPassword },
                pool: true,
                maxConnections: 4,
                maxMessages: Infinity,
            });

            await transporter.sendMail({ from, to: destinatarios, subject: asunto, html, attachments: adjuntos });

            await this.prisma.ejecucionTarea.update({
                where: { id: ejec.id },
                data: {
                    estado: 'completed',
                    finEn: new Date(),
                    adjuntos: adjuntos.map(a => ({ archivo: a.filename, bytes: a.content.length })),
                },
            });

            await this.prisma.tareaProgramada.update({
                where: { id: tarea.id },
                data: { ultimaEjecucion: new Date() },
            });
        } catch (err: any) {
            this.logger.error(`Tarea ${tareaId} falló: ${err?.message}`);
            await this.prisma.ejecucionTarea.update({
                where: { id: ejec.id },
                data: { estado: 'failed', finEn: new Date(), error: String(err?.stack || err) },
            });
            throw err;
        }
    }
}