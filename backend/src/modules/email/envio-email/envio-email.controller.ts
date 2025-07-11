import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { EnvioEmailService } from './envio-email.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('email/envio')
@UseGuards(JwtAuthGuard)

export class EnvioEmailController {
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
}