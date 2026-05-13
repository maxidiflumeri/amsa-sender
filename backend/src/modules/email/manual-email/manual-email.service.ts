import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailDesuscribirService } from 'src/modules/email/desuscribir-email/desuscribir-email.service';
import { insertHeaderAndFooter, renderTemplate } from 'src/common/renderTemplate';
import { prepararHtmlConTracking_safe } from 'src/common/inyectEmailTracking';
import { generarTrackingTok } from 'src/common/generateTrackingTok';
import { buildAmsaHeader, injectHtmlMarker } from 'src/common/bounce.common';
import { randomUUID } from 'node:crypto';
import * as nodemailer from 'nodemailer';
import { EnvioManualDto } from './dtos/envio-manual.dto';
import { ExtractVarsDto } from './dtos/extract-vars.dto';
import { GuardarTemplateDto } from './dtos/guardar-template.dto';

const NOMBRE_CAMPANA_MANUAL = '__envios_manuales__';
const TENANT_ID = 'amsa-sender';
const BOUNCE_DOMAIN = 'anamayasa.com.ar';

type NmAttachment = { filename: string; content: Buffer; contentType: string };

@Injectable()
export class ManualEmailService {
    private readonly logger = new Logger(ManualEmailService.name);

    constructor(
        private prisma: PrismaService,
        private descService: EmailDesuscribirService,
    ) { }

    private getApiBaseUrl(): string {
        return process.env.PUBLIC_API_BASE_URL || 'http://localhost:5001/api';
    }

    // Extrae variables {{varName}} del html y del asunto, devuelve array único
    extractVariables(dto: ExtractVarsDto): string[] {
        const regex = /{{\s*(\w+)\s*}}/g;
        const found = new Set<string>();
        const combined = `${dto.html || ''}${dto.asunto || ''}`;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(combined)) !== null) {
            found.add(match[1]);
        }
        return Array.from(found);
    }

    // Obtiene o crea la campaña reservada para envíos manuales del usuario
    private async obtenerOCrearCampanaManual(userId: number): Promise<number> {
        const existente = await this.prisma.campañaEmail.findFirst({
            where: { nombre: NOMBRE_CAMPANA_MANUAL, userId },
            select: { id: true },
        });
        if (existente) return existente.id;

        const nueva = await this.prisma.campañaEmail.create({
            data: {
                nombre: NOMBRE_CAMPANA_MANUAL,
                estado: 'finalizada',
                userId,
                createdAt: new Date(),
            },
        });
        this.logger.log(`📁 Campaña manual creada para userId=${userId}: id=${nueva.id}`);
        return nueva.id;
    }

    private async enviarADestinatario(params: {
        email: string;
        toNombre?: string;
        campañaId: number;
        htmlBase: string;
        subject: string;
        smtp: any;
        transporter: nodemailer.Transporter;
        attachments: NmAttachment[];
        deudorId?: number;
    }): Promise<{ ok: boolean; reporteId: number; error?: string }> {
        const { email, toNombre, campañaId, htmlBase, subject, smtp, transporter, attachments, deudorId } = params;

        const contacto = await this.prisma.contactoEmail.create({
            data: {
                email,
                nombre: toNombre || '',
                datos: {},
                campañaId,
                ...(deudorId ? { deudorId } : {}),
            },
        });

        const reporte = await this.prisma.reporteEmail.create({
            data: {
                campañaId,
                contactoId: contacto.id,
                estado: 'pendiente',
                asunto: subject,
                html: htmlBase,
                creadoAt: new Date(),
            },
        });

        const tok = generarTrackingTok();
        await this.prisma.reporteEmail.update({
            where: { id: reporte.id },
            data: { trackingTok: tok },
        });

        try {
            const apiBase = this.getApiBaseUrl();

            const tokenUnsub = this.descService.signUnsubToken({
                tenantId: TENANT_ID,
                email,
                scope: 'global',
            });
            const unsubUrl = `${apiBase}/email/desuscripciones/u?u=${encodeURIComponent(tokenUnsub)}`;
            const verEnNavegadorUrl = `${process.env.FRONT_BASE_URL}/mailing/vista/${reporte.id}`;

            const htmlConLayout = insertHeaderAndFooter(htmlBase, verEnNavegadorUrl, unsubUrl);
            const htmlFinal = prepararHtmlConTracking_safe(htmlConLayout, apiBase, tok);

            const secret = process.env.AMSA_BOUNCE_SECRET || '';
            const messageId = `<${reporte.id}.${randomUUID()}@${BOUNCE_DOMAIN}>`;
            const xHeader = buildAmsaHeader(reporte.id, email, messageId, secret);
            const htmlConMarker = injectHtmlMarker(htmlFinal, xHeader);

            await transporter.sendMail({
                from: `"${smtp.remitente}" <${smtp.emailFrom || smtp.usuario}>`,
                to: email,
                subject,
                html: htmlConMarker,
                replyTo: smtp.usuario,
                messageId,
                attachments,
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

            this.logger.log(`✅ Envío manual enviado a ${email} (reporteId=${reporte.id})`);
            return { ok: true, reporteId: reporte.id };

        } catch (err: any) {
            this.logger.warn(`⚠️ Fallo envío manual a ${email}: ${err.message}`);
            await this.prisma.reporteEmail.update({
                where: { id: reporte.id },
                data: { estado: 'fallo', error: err.message, enviadoAt: new Date() },
            });
            return { ok: false, error: err.message, reporteId: reporte.id };
        }
    }

    async enviarManual(
        dto: EnvioManualDto,
        userId: number,
        archivos: Express.Multer.File[] = [],
        deudorId?: number,
    ): Promise<{
        ok: boolean;
        total: number;
        enviados: number;
        reporteIds: number[];
        errores?: { email: string; error: string }[];
    }> {
        if (!dto.to?.length) throw new BadRequestException('Debe indicar al menos un destinatario');

        // 1. Cargar cuenta SMTP
        const smtp = await this.prisma.cuentaSMTP.findUnique({ where: { id: dto.smtpId } });
        if (!smtp) throw new NotFoundException(`Cuenta SMTP id=${dto.smtpId} no encontrada`);

        // 2. Resolver HTML y asunto finales
        let htmlBase: string;
        let subject: string;

        if (dto.templateId) {
            const template = await this.prisma.templateEmail.findUnique({ where: { id: dto.templateId } });
            if (!template) throw new NotFoundException(`Template id=${dto.templateId} no encontrado`);
            const vars = { nombre: dto.toNombre || '', ...dto.variables };
            htmlBase = renderTemplate(template.html, vars);
            subject = renderTemplate(template.asunto, vars);
        } else {
            if (!dto.html?.trim()) throw new BadRequestException('html es requerido cuando no se usa templateId');
            htmlBase = dto.html;
            subject = dto.subject;
        }

        // 3. Obtener campaña reservada
        const campañaId = await this.obtenerOCrearCampanaManual(userId);

        // 4. Crear transporter una sola vez
        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.puerto,
            secure: smtp.puerto === 465,
            auth: { user: smtp.usuario, pass: smtp.password },
        });

        // 5. Preparar adjuntos para nodemailer
        const attachments: NmAttachment[] = archivos.map(f => ({
            filename: f.originalname,
            content: f.buffer,
            contentType: f.mimetype,
        }));

        // 6. Enviar a cada destinatario
        const reporteIds: number[] = [];
        const errores: { email: string; error: string }[] = [];

        for (const email of dto.to) {
            const result = await this.enviarADestinatario({
                email: email.trim(),
                toNombre: dto.toNombre,
                campañaId,
                htmlBase,
                subject,
                smtp,
                transporter,
                attachments,
                deudorId,
            });
            reporteIds.push(result.reporteId);
            if (!result.ok) {
                errores.push({ email, error: result.error || 'Error desconocido' });
            }
        }

        const enviados = dto.to.length - errores.length;
        return {
            ok: errores.length === 0,
            total: dto.to.length,
            enviados,
            reporteIds,
            ...(errores.length > 0 ? { errores } : {}),
        };
    }

    async guardarComoTemplate(dto: GuardarTemplateDto) {
        return this.prisma.templateEmail.create({
            data: {
                nombre: dto.nombre,
                asunto: dto.asunto,
                html: dto.html,
                design: dto.design ?? {},
                creadoAt: new Date(),
            },
        });
    }
}
