import { BadRequestException, Body, Controller, Get, Logger, NotFoundException, Param, ParseIntPipe, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaService } from 'src/prisma/prisma.service';
import { ManualEmailService } from 'src/modules/email/manual-email/manual-email.service';
import { InternalApiKeyGuard } from '../../guards/internal-api-key.guard';
import { InternalScope } from '../../decorators/internal-scope.decorator';
import { InternalActor, InternalActorPayload } from '../../decorators/internal-actor.decorator';
import { InternalManualSendDto } from './dtos/internal-manual-send.dto';

@Controller('internal/email')
@UseGuards(InternalApiKeyGuard)
@InternalScope('email:*')
export class InternalEmailController {
    private readonly logger = new Logger(InternalEmailController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly manualEmailService: ManualEmailService,
    ) { }

    @Get('smtps')
    async listarSmtps() {
        const cuentas = await this.prisma.cuentaSMTP.findMany({
            orderBy: { creadoAt: 'desc' },
            select: {
                id: true,
                nombre: true,
                emailFrom: true,
                remitente: true,
            },
        });
        return cuentas;
    }

    @Get('smtps/:id/templates')
    async templatesPorSmtp(@Param('id', ParseIntPipe) smtpId: number) {
        const smtp = await this.prisma.cuentaSMTP.findUnique({ where: { id: smtpId }, select: { id: true } });
        if (!smtp) throw new NotFoundException(`SMTP id=${smtpId} no encontrada`);

        const templates = await this.prisma.templateEmail.findMany({
            where: { OR: [{ cuentaSmtpId: smtpId }, { cuentaSmtpId: null }] },
            orderBy: { creadoAt: 'desc' },
            select: {
                id: true,
                nombre: true,
                asunto: true,
                cuentaSmtpId: true,
            },
        });

        return templates.map(t => ({
            id: t.id,
            nombre: t.nombre,
            asunto: t.asunto,
            cuentaSmtpId: t.cuentaSmtpId,
            variables: this.extraerVariables(t.asunto ?? ''),
        }));
    }

    @Get('templates/:id')
    async detalleTemplate(@Param('id', ParseIntPipe) id: number) {
        const template = await this.prisma.templateEmail.findUnique({ where: { id } });
        if (!template) throw new NotFoundException(`Template id=${id} no encontrado`);

        const variables = this.extraerVariables(`${template.html || ''}${template.asunto || ''}`);

        return {
            id: template.id,
            nombre: template.nombre,
            asunto: template.asunto,
            html: template.html,
            cuentaSmtpId: template.cuentaSmtpId,
            variables,
        };
    }

    @Post('manual/send')
    @UseInterceptors(FilesInterceptor('archivos', 10, {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
    }))
    async enviar(
        @Body() body: any,
        @UploadedFiles() archivos: Express.Multer.File[],
        @InternalActor() actor: InternalActorPayload,
    ) {
        const toRaw = body.to;
        let to: string[];
        if (Array.isArray(toRaw)) {
            to = toRaw;
        } else if (typeof toRaw === 'string') {
            const trimmed = toRaw.trim();
            if (trimmed.startsWith('[')) {
                try { to = JSON.parse(trimmed); } catch { to = trimmed.split(',').map(s => s.trim()).filter(Boolean); }
            } else {
                to = trimmed.split(',').map(s => s.trim()).filter(Boolean);
            }
        } else {
            to = [];
        }

        if (!to.length) throw new BadRequestException('Debe indicar al menos un destinatario en "to".');

        const dto: InternalManualSendDto = {
            to,
            toNombre: body.toNombre || undefined,
            smtpId: Number(body.smtpId),
            subject: body.subject,
            html: body.html,
            templateId: body.templateId ? Number(body.templateId) : undefined,
            variables: body.variables ? (typeof body.variables === 'string' ? JSON.parse(body.variables) : body.variables) : undefined,
        };

        if (!dto.smtpId) throw new BadRequestException('smtpId es requerido.');
        if (!dto.templateId && !dto.html) throw new BadRequestException('Se requiere templateId o html.');

        let deudorId: number | undefined;
        const documento = typeof body.deudorDocumento === 'string' ? body.deudorDocumento.trim() : '';
        if (documento) {
            const deudor = await this.prisma.deudor.findFirst({
                where: { documento },
                select: { id: true },
            });
            if (deudor) deudorId = deudor.id;
        }

        this.logger.log(`📨 [internal-api/${actor.keyId}] envío manual a ${to.length} destinatario(s) (serviceUserId=${actor.serviceUserId}, deudorId=${deudorId ?? 'none'})`);

        return this.manualEmailService.enviarManual(
            dto as any,
            actor.serviceUserId,
            archivos || [],
            deudorId,
        );
    }

    @Get('reportes/:id')
    async estadoReporte(@Param('id', ParseIntPipe) id: number) {
        const reporte = await this.prisma.reporteEmail.findUnique({
            where: { id },
            select: {
                id: true,
                estado: true,
                asunto: true,
                enviadoAt: true,
                creadoAt: true,
                error: true,
                contacto: { select: { email: true, nombre: true } },
            },
        });
        if (!reporte) throw new NotFoundException(`Reporte id=${id} no encontrado`);

        const rebote = await this.prisma.emailRebote.findFirst({
            where: { reporteId: id },
            orderBy: { fecha: 'desc' },
            select: { codigo: true, descripcion: true, fecha: true, correo: true },
        });

        const aperturas = await this.prisma.emailEvento.count({
            where: { reporteId: id, tipo: 'OPEN' },
        });
        const clics = await this.prisma.emailEvento.count({
            where: { reporteId: id, tipo: 'CLICK' },
        });

        return {
            id: reporte.id,
            estado: reporte.estado,
            asunto: reporte.asunto,
            destinatario: reporte.contacto?.email ?? null,
            enviadoAt: reporte.enviadoAt,
            creadoAt: reporte.creadoAt,
            error: reporte.error,
            aperturas,
            clics,
            rebote: rebote ?? null,
        };
    }

    private extraerVariables(texto: string): string[] {
        const regex = /{{\s*(\w+)\s*}}/g;
        const found = new Set<string>();
        let match: RegExpExecArray | null;
        while ((match = regex.exec(texto)) !== null) {
            found.add(match[1]);
        }
        return Array.from(found);
    }
}
