import { Body, Controller, Logger, Post, Request, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ManualEmailService } from './manual-email.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';
import { EnvioManualDto } from './dtos/envio-manual.dto';
import { ExtractVarsDto } from './dtos/extract-vars.dto';
import { GuardarTemplateDto } from './dtos/guardar-template.dto';

@Controller('email/manual')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('email.envio_manual')
export class ManualEmailController {
    private readonly logger = new Logger(ManualEmailController.name);

    constructor(private readonly manualEmailService: ManualEmailService) { }

    @Post('send')
    @UseInterceptors(FilesInterceptor('adjuntos', 10, {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
    }))
    async enviarManual(
        @Body() body: any,
        @UploadedFiles() adjuntos: Express.Multer.File[],
        @Request() req: any,
    ) {
        const toRaw = body.to;
        const to: string[] = Array.isArray(toRaw) ? toRaw : (toRaw ? [toRaw] : []);

        const dto: EnvioManualDto = {
            to,
            toNombre: body.toNombre || undefined,
            smtpId: Number(body.smtpId),
            subject: body.subject,
            html: body.html,
            templateId: body.templateId ? Number(body.templateId) : undefined,
            variables: body.variables ? JSON.parse(body.variables) : undefined,
        };

        const userId = req['usuario']?.sub;
        this.logger.log(`📨 Envío manual a [${to.join(', ')}] por userId=${userId}`);
        return this.manualEmailService.enviarManual(dto, userId, adjuntos || []);
    }

    @Post('extract-vars')
    extractVars(@Body() dto: ExtractVarsDto) {
        const variables = this.manualEmailService.extractVariables(dto);
        return { variables };
    }

    @Post('guardar-template')
    guardarTemplate(@Body() dto: GuardarTemplateDto) {
        return this.manualEmailService.guardarComoTemplate(dto);
    }
}
