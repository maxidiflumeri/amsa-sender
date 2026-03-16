import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { insertHeaderAndFooter } from 'src/common/renderTemplate';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EnvioEmailService {
    private readonly logger = new Logger(EnvioEmailService.name);
    private smtpHost = process.env.AWS_SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com';
    private smtpPort = process.env.AWS_SMTP_PORT || '587'
    private smtpUser = process.env.AWS_SMTP_USER || '';
    private smtpPassword = process.env.AWS_SMTP_PASSWORD || '';

    constructor(
        private prisma: PrismaService,
        @InjectQueue('emailsEnvios') private readonly emailsEnvios: Queue
    ) { }

    async enviarCorreo({
        html,
        to,
        subject,
        smtpId,
    }: {
        html: string;
        to: string;
        subject: string;
        smtpId: number;
    }) {

        const smtp = await this.prisma.cuentaSMTP.findUnique({ where: { id: smtpId } });
        if (!smtp) throw new NotFoundException('Cuenta SMTP no encontrada');

        const transporter = nodemailer.createTransport({
            host: this.smtpHost,
            port: parseInt(this.smtpPort),
            secure: false,
            auth: {
                user: this.smtpUser,
                pass: this.smtpPassword,
            },
        });

        try {
            await transporter.sendMail({
                from: `"${smtp.remitente}" <${smtp.usuario}>`,
                to,
                subject,
                html: insertHeaderAndFooter(html, '', ''),
                replyTo: smtp.usuario,
            });

            return { success: true };
        } catch (error) {
            this.logger.error(`📄 Error al enviar el mail: ${error.message}`);
            throw new InternalServerErrorException(`Error al enviar el correo: ${error.message}`);
        }
    }

    async enviarCampania({
        idCampania,
        idTemplate,
        idCuentaSmtp,
    }: {
        idCampania: number;
        idTemplate: number;
        idCuentaSmtp: number;
    }) {

        const job = await this.emailsEnvios.add('enviar-campania', {
            idCampania,
            idTemplate,
            idCuentaSmtp,
        });

        await this.prisma.campañaEmail.update({
            where: { id: idCampania },
            data: {
                estado: 'procesando',
                templateId: idTemplate,
                jobId: job.id,
            }
        });

        return { ok: true, message: 'Campaña programada para envío' };
    }

    async agendarCampania({
        idCampania,
        idTemplate,
        idCuentaSmtp,
        fechaAgenda
    }: {
        idCampania: number;
        idTemplate: number;
        idCuentaSmtp: number;
        fechaAgenda: string;
    }) {
        const delay = Math.max(new Date(fechaAgenda).getTime() - Date.now(), 0);
        this.logger.log(`⏱️ Agendando campaña mail ${idCampania} para ${fechaAgenda} (delay: ${delay} ms)`);

        const job = await this.emailsEnvios.add(
            'enviar-campania',
            {
                idCampania,
                idTemplate,
                idCuentaSmtp,
            },
            { delay },
        );

        await this.prisma.campañaEmail.update({
            where: { id: idCampania },
            data: {
                agendadoAt: new Date(fechaAgenda),
                estado: 'programada',
                templateId: idTemplate,                
                jobId: job.id,
            },
        });

        this.logger.log(`📨 Campaña ${idCampania} agendada como job ${job.id}`);
        return { ok: true, message: 'Campaña agendada correctamente' };
    }
}

