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

    async enviarManual(dto: EnvioManualDto, userId: number): Promise<{ ok: boolean; reporteId: number; error?: string }> {
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

        // 3. Obtener campaña reservada y crear contacto efímero
        const campañaId = await this.obtenerOCrearCampanaManual(userId);

        const contacto = await this.prisma.contactoEmail.create({
            data: {
                email: dto.to,
                nombre: dto.toNombre || '',
                datos: {},
                campañaId,
            },
        });

        // 4. Crear ReporteEmail inicial
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

        // 5. Generar token de tracking
        const tok = generarTrackingTok();
        await this.prisma.reporteEmail.update({
            where: { id: reporte.id },
            data: { trackingTok: tok },
        });

        try {
            const apiBase = this.getApiBaseUrl();

            // 6. Token y URL de desuscripción
            const tokenUnsub = this.descService.signUnsubToken({
                tenantId: TENANT_ID,
                email: dto.to,
                scope: 'global',
            });
            const unsubUrl = `${apiBase}/email/desuscripciones/u?u=${encodeURIComponent(tokenUnsub)}`;
            const verEnNavegadorUrl = `${process.env.FRONT_BASE_URL}/mailing/vista/${reporte.id}`;

            // 7. Inyectar header/footer + tracking
            const htmlConLayout = insertHeaderAndFooter(htmlBase, verEnNavegadorUrl, unsubUrl);
            const htmlFinal = prepararHtmlConTracking_safe(htmlConLayout, apiBase, tok);

            // 8. Construir headers de bounce
            const secret = process.env.AMSA_BOUNCE_SECRET || '';
            const messageId = `<${reporte.id}.${randomUUID()}@${BOUNCE_DOMAIN}>`;
            const xHeader = buildAmsaHeader(reporte.id, dto.to, messageId, secret);
            const htmlConMarker = injectHtmlMarker(htmlFinal, xHeader);

            // 9. Crear transporter con la cuenta SMTP seleccionada
            const transporter = nodemailer.createTransport({
                host: smtp.host,
                port: smtp.puerto,
                secure: smtp.puerto === 465,
                auth: { user: smtp.usuario, pass: smtp.password },
            });

            // 10. Enviar
            await transporter.sendMail({
                from: `"${smtp.remitente}" <${smtp.emailFrom || smtp.usuario}>`,
                to: dto.to,
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

            // 11. Actualizar reporte como enviado
            await this.prisma.reporteEmail.update({
                where: { id: reporte.id },
                data: {
                    estado: 'enviado',
                    enviadoAt: new Date(),
                    html: htmlConMarker,
                    smtpMessageId: messageId,
                },
            });

            this.logger.log(`✅ Envío manual enviado a ${dto.to} (reporteId=${reporte.id})`);
            return { ok: true, reporteId: reporte.id };

        } catch (err: any) {
            this.logger.warn(`⚠️ Fallo envío manual a ${dto.to}: ${err.message}`);
            await this.prisma.reporteEmail.update({
                where: { id: reporte.id },
                data: { estado: 'fallo', error: err.message, enviadoAt: new Date() },
            });
            return { ok: false, error: err.message, reporteId: reporte.id };
        }
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
