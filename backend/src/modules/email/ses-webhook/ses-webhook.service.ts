import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as MessageValidator from 'sns-validator';
import { PrismaService } from 'src/prisma/prisma.service';

const validator = new (MessageValidator as any)();

@Injectable()
export class SesWebhookService {
    private readonly logger = new Logger(SesWebhookService.name);

    constructor(private readonly prisma: PrismaService) { }

    // --- Firma SNS ---
    async validateSnsSignature(payload: any): Promise<boolean> {
        
        try {
            await new Promise<void>((resolve, reject) => {
                validator.validate(payload, (err: any) => (err ? reject(err) : resolve()));
            });
            return true;
        } catch (e: any) {
            this.logger.warn(`SNS signature validation failed: ${e.message}`);
            return false;
        }
    }

    // --- Confirmación de suscripción SNS ---
    async confirmSubscription(subscribeUrl: string): Promise<boolean> {
        try {
            await axios.get(subscribeUrl);
            this.logger.log('SNS subscription confirmed.');
            return true;
        } catch (e: any) {
            this.logger.error(`Subscription confirm failed: ${e.message}`);
            return false;
        }
    }

    // --- Procesar notificación SES ---
    async processNotification(envelope: any): Promise<boolean> {
        let message: any;
        try {
            message = JSON.parse(envelope.Message); // <- acá sí, el "Message" de SNS es un string JSON (SES)
        } catch {
            this.logger.error('Invalid SNS Message JSON.');
            return false;
        }

        const eventType = message.eventType || message.notificationType;
        const mail = message.mail || {};
        const headersList: Array<{ name: string; value: string }> = mail.headers || [];
        const commonHeaders = mail.commonHeaders || {};

        // Message-Id del original (fallback)
        const msgIdFromCommon = (commonHeaders.messageId as string) || undefined;
        const msgIdFromHeader =
            headersList.find((h) => h.name?.toLowerCase() === 'message-id')?.value;
        const originalMessageId = msgIdFromCommon || msgIdFromHeader || null;

        // Tu header (si viaja)
        const xAmsaSender =
            headersList.find((h) => h.name?.toLowerCase() === 'x-amsasender')?.value ||
            null;

        const match = xAmsaSender ? xAmsaSender.match(/rid=(\d+)/) : null
        const reporteIdFromTag = match ? match[1] : null;

        switch (eventType) {
            case 'Bounce':
                await this.handleBounce(message, {
                    reporteIdFromTag: reporteIdFromTag ? parseInt(reporteIdFromTag) : null,
                    originalMessageId,
                    xAmsaSender,
                });
                return true;

            case 'Complaint':
                await this.handleComplaint(message, {
                    reporteIdFromTag: reporteIdFromTag ? parseInt(reporteIdFromTag) : null,
                    originalMessageId,
                    xAmsaSender,
                });
                return true;

            case 'Delivery':
                await this.handleDelivery(message, {
                    reporteIdFromTag: reporteIdFromTag ? parseInt(reporteIdFromTag) : null,
                    originalMessageId,
                });
                return true;

            default:
                this.logger.log(`Unhandled SES event type: ${eventType}`);
                return true; // no es error, solo no lo manejamos
        }
    }

    // --- Bounce ---
    private async handleBounce(
        msg: any,
        ctx: {
            reporteIdFromTag: number | null;
            originalMessageId: string | null;
            xAmsaSender: string | null;
        },
    ) {
        const bounce = msg.bounce || {};
        const recipients = bounce.bouncedRecipients || [];
        const bounceType = bounce.bounceType as string | undefined; // Permanent / Transient / Undetermined
        const ts = bounce.timestamp ? new Date(bounce.timestamp) : new Date();

        for (const r of recipients) {
            const email = r.emailAddress || null;
            const status = r.status.replace(/\./g, "") || null; // 5.1.1
            const diag = r.diagnosticCode || null;

            const reporteId = await this.resolveReporteId(
                ctx.reporteIdFromTag,
                ctx.originalMessageId,
            );

            // Persistir tal como tu tabla
            await this.prisma.emailRebote.create({
                data: {
                    reporteId: reporteId ?? null,
                    fecha: ts,
                    codigo: status,
                    descripcion: diag ?? bounceType ?? 'Bounce',
                    raw: JSON.stringify(msg).slice(0, 1_000_000), // opcional: limitar tamaño
                    correo: email,
                    smtpMessageId: ctx.originalMessageId,
                    xAmsaSender: ctx.xAmsaSender,
                },
            });

            // Actualizar ReporteEmail (si lo ubicamos)
            if (reporteId) {
                await this.prisma.reporteEmail.updateMany({
                    where: { id: reporteId },
                    data: { estado: 'rebote', error: diag ?? bounceType ?? 'Bounce' },
                });
            }

            // (Opcional) Supresión automática ante Permanent
            // if (bounceType === 'Permanent' && email) { ... }
        }
    }

    // --- Complaint ---
    private async handleComplaint(
        msg: any,
        ctx: {
            reporteIdFromTag: number | null;
            originalMessageId: string | null;
            xAmsaSender: string | null;
        },
    ) {
        const complaint = msg.complaint || {};
        const complained = complaint.complainedRecipients || [];
        const ts = complaint.timestamp ? new Date(complaint.timestamp) : new Date();

        for (const r of complained) {
            const email = r.emailAddress || null;

            const reporteId = await this.resolveReporteId(
                ctx.reporteIdFromTag,
                ctx.originalMessageId,
            );

            await this.prisma.emailRebote.create({
                data: {
                    reporteId: reporteId ?? null,
                    fecha: ts,
                    codigo: 'complaint',
                    descripcion: 'User complaint / spam',
                    raw: JSON.stringify(msg).slice(0, 1_000_000),
                    correo: email,
                    smtpMessageId: ctx.originalMessageId,
                    xAmsaSender: ctx.xAmsaSender,
                },
            });

            if (reporteId) {
                await this.prisma.reporteEmail.updateMany({
                    where: { id: reporteId },
                    data: { estado: 'queja', error: 'Complaint' },
                });
            }

            // (Opcional) Supresión automática
            // if (email) { ... }
        }
    }

    // --- Delivery ---
    private async handleDelivery(
        msg: any,
        ctx: { reporteIdFromTag: number | null; originalMessageId: string | null },
    ) {
        const delivery = msg.delivery || {};
        const ts = delivery.timestamp ? new Date(delivery.timestamp) : new Date();

        const reporteId = await this.resolveReporteId(
            ctx.reporteIdFromTag,
            ctx.originalMessageId,
        );
        if (reporteId) {
            await this.prisma.reporteEmail.updateMany({
                where: { id: reporteId },
                data: { estado: 'enviado', enviadoAt: ts },
            });
        }
    }

    // --- Resolver reporteId: primero tag, luego Message-Id ---
    private async resolveReporteId(
        reporteIdFromTag: number | null,
        originalMessageId: string | null,
    ) {
        if (reporteIdFromTag) return reporteIdFromTag;
        if (!originalMessageId) return null;
        const rep = await this.prisma.reporteEmail.findUnique({
            where: { smtpMessageId: originalMessageId },
            select: { id: true },
        });
        return rep?.id ?? null;
    }
}