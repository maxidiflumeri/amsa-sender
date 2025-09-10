import { Controller, Get, Query, Param, Req, Res } from '@nestjs/common';
import { Response, Request } from 'express';
import { TrackingEmailService } from './tracking-email.service';

@Controller('email/t/c')
export class TrackClickController {
    constructor(private readonly svc: TrackingEmailService) { }

    @Get(':token')
    async click(@Param('token') token: string, @Query('u') u: string, @Req() req: Request, @Res() res: Response) {
        const destino = u ? decodeURIComponent(u) : '/';
        await this.svc.registrarClick(token, destino, req);
        res.redirect(destino);
    }
}