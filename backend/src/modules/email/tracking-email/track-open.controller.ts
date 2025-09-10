import { Controller, Get, Header, Param, Req, Res } from '@nestjs/common';
import { Response, Request } from 'express';
import { TrackingEmailService } from './tracking-email.service';

const TRANSPARENT_PX = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0c2sUAAAAASUVORK5CYII=',
    'base64'
);

@Controller('email/t/o')
export class TrackOpenController {
    constructor(private readonly svc: TrackingEmailService) { }

    @Get(':token.png')
    @Header('Content-Type', 'image/png')
    @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    async open(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
        await this.svc.registrarOpen(token, req);
        res.end(TRANSPARENT_PX);
    }
}