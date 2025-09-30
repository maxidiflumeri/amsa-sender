import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { EnvioEmailService } from './envio-email.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('email/envio')
@UseGuards(JwtAuthGuard)

export class EnvioEmailController {
    private readonly logger = new Logger(EnvioEmailController.name);

    constructor(private mailService: EnvioEmailService) { }

    @Post('enviar-preview')
    enviarTemplate(@Body() body: {
        html: string;
        subject: string;
        to: string;
        smtpId: number;
    }) {
        return this.mailService.enviarCorreo(body);
    }

    @Post('campania')
    async enviarCampania(@Body() body: { idCampania: number; idTemplate: number; idCuentaSmtp: number }) {
        return this.mailService.enviarCampania(body);
    }

    @Post('campania/agendar')
    async agendarCampania(@Body() body: { idCampania: number; idTemplate: number; idCuentaSmtp: number; fechaAgenda: string; }) {
        this.logger.log(`📥 POST campania/agendar - Agendar campaña email: ${JSON.stringify(body)}`);
        return this.mailService.agendarCampania(body);
    }
}