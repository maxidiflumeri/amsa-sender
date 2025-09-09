// src/gmail/gmail.controller.ts
import { Controller, Get, Post, Query, Res } from '@nestjs/common';
import { GmailService } from './gmail.service';

@Controller('gmail')

export class GmailController {
    constructor(private readonly gmail: GmailService) { }

    // 1) Genera la URL de autorización
    @Get('oauth2/auth')
    async auth(@Res() res) {
        const { url } = this.gmail.getAuthUrl();
        console.log('AUTH URL:', url)
        return res.redirect(url);
    }

    // 2) Callback que guarda tokens
    @Get('oauth2/callback')
    async callback(@Query('code') code: string) {
        await this.gmail.exchangeCodeForTokens(code);
        return '¡Listo! Tokens guardados. Ya podés leer rebotes.';
    }

    // 3) Ejecución manual (además del cron)
    @Post('poll')
    async poll() {
        const results = await this.gmail.pollBouncesOnce();
        return { processed: results.length, results };
    }
}