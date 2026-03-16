import { Body, Controller, Logger, Post, Request, UseGuards } from '@nestjs/common';
import { ManualEmailService } from './manual-email.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { EnvioManualDto } from './dtos/envio-manual.dto';
import { ExtractVarsDto } from './dtos/extract-vars.dto';
import { GuardarTemplateDto } from './dtos/guardar-template.dto';

@Controller('email/manual')
@UseGuards(JwtAuthGuard)
export class ManualEmailController {
    private readonly logger = new Logger(ManualEmailController.name);

    constructor(private readonly manualEmailService: ManualEmailService) { }

    @Post('send')
    async enviarManual(@Body() dto: EnvioManualDto, @Request() req: any) {
        const userId = req['usuario']?.sub;
        this.logger.log(`📨 Envío manual a ${dto.to} por userId=${userId}`);
        return this.manualEmailService.enviarManual(dto, userId);
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
