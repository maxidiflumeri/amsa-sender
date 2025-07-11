import { Body, Controller, Post } from '@nestjs/common';
import { EnvioEmailService } from './envio-email.service';

@Controller('email/envio')
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