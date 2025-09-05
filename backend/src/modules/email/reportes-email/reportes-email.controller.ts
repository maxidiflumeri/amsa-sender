// reportes-email.controller.ts
import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ReportesEmailService } from './reportes-email.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Response } from 'express';

@Controller('email/reportes')
@UseGuards(JwtAuthGuard)

export class ReportesEmailController {
    constructor(private svc: ReportesEmailService) { }

    @Get('overview')
    async overview(
        @Query('since') since?: string,
        @Query('until') until?: string,
        @Query('q') q?: string,
        @Query('includeSparkline') includeSparkline?: string,
        @Query('page') page = '0',
        @Query('size') size = '12', // 12 cards por página
    ) {
        const end = until ? new Date(until) : new Date();
        const start = since ? new Date(since) : new Date(Date.now() - 24 * 3600 * 1000);
        return this.svc.overview({
            since: start, until: end, q,
            includeSparkline: includeSparkline === 'true',
            page: Number(page), size: Number(size),
        });
    }

    @Get('campanias/:id/engagement')
    async detail(
        @Param('id') id: string,
        @Query('since') since?: string,
        @Query('until') until?: string,
        @Query('pageOpen') pageOpen = '0',
        @Query('sizeOpen') sizeOpen = '25',
        @Query('pageClick') pageClick = '0',
        @Query('sizeClick') sizeClick = '25',
    ) {
        const end = until ? new Date(until) : new Date();
        const start = since ? new Date(since) : new Date(Date.now() - 24 * 3600 * 1000);

        return this.svc.campaignDetail({
            campañaId: Number(id),
            since: start,
            until: end,
            pageOpen: Number(pageOpen),
            sizeOpen: Number(sizeOpen),
            pageClick: Number(pageClick),
            sizeClick: Number(sizeClick),
        });
    }

    @Get('events/today')
    async today(@Query('limit') limit = '200', @Query('afterId') afterId?: string) {
        return this.svc.todayEvents({ limit: Number(limit), afterId: afterId ? Number(afterId) : undefined });
    }

    @Get('actividades.csv')
    async descargarCsv(
        @Res() res: Response,
        @Query('campaniaId') campaniaId?: string,
        @Query('desde') desde?: string,
        @Query('hasta') hasta?: string,
        @Query('tipo') tipo?: 'open' | 'click' | 'all',
    ) {
        const csv = await this.svc.generarCsvActividades({
            campaniaId: campaniaId ? Number(campaniaId) : undefined,
            desde: desde ? new Date(desde) : undefined,
            hasta: hasta ? new Date(hasta) : undefined,
            tipo: (tipo as any) ?? 'all',
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            'attachment; filename="actividades_email.csv"',
        );
        res.send(csv);
    }
}
