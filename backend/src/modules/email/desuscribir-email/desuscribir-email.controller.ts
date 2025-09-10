// mailing/unsubscribes.controller.ts
import { Body, Controller, Delete, Get, Post, Query, Param, Req, Res, InternalServerErrorException, Logger, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { EmailDesuscribirService } from './desuscribir-email.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('email/desuscripciones')
export class EmailDesuscribirController {
    private readonly logger = new Logger(EmailDesuscribirController.name);

    constructor(private readonly svc: EmailDesuscribirService) { }

    // 1) Redirección a front de confirmación
    @Get('u')
    async redirectToConfirm(@Query('u') token: string, @Res() res: Response) {
        // Valida superficialmente y redirige a tu front:
        // e.g. https://amsasender.anamayasa.com.ar/mailing/desuscribirse?u=<token>
        const url = `${process.env.FRONT_BASE_URL}/mailing/desuscribirse?u=${encodeURIComponent(token)}`;
        return res.redirect(302, url);
    }

    // 2) One-Click (Gmail/Apple Mail) — procesa desuscripción directa
    @Post('u')
    async oneClick(@Req() req: any, @Res() res: Response, @Query('u') token?: string) {
        // Gmail envía header: List-Unsubscribe=One-Click
        // El token puede venir en query o en body según cliente
        const tok = token ?? req.body?.u;
        if (!tok) return res.status(400).send('Missing token');
        try {
            const { tenantId, email, campaignId, scope = 'global' } = this.svc.verifyUnsubToken(tok);
            await this.svc.add(tenantId, email, scope, campaignId, 'user_click', 'header_oneclick');
            // Debe responder 200 OK con body simple
            return res.status(200).send('You have been unsubscribed');
        } catch {
            return res.status(400).send('Invalid token');
        }
    }

    // 3) Confirmación desde tu front (botón "Confirmar desuscripción")
    @Post('unsubscribes/confirm')
    async confirm(@Body('u') token: string) {
        try {
            const { tenantId, email, campaignId, scope = 'global' } = this.svc.verifyUnsubToken(token);
            return this.svc.add(tenantId, email, scope, campaignId, 'user_click', 'footer_link');
        } catch (error) {
            this.logger.error(`❌ Error al confirmar desuscripcion: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al confirmar desuscripcion.');
        }
    }

    // 4) Listado / Alta / Borrado / Vaciar (protegidos por auth de tu app)
    @UseGuards(JwtAuthGuard)
    @Get('unsubscribes')
    async list(@Req() req: any, @Query('page') page = 0, @Query('size') size = 25, @Query('q') q?: string) {
        try {
            const tenantId = req.user?.tenantId ? req.user.tenantId : 'amsa-sender';
            return this.svc.list(tenantId, Number(page), Number(size), q);
        } catch (error) {
            this.logger.error(`❌ Error al obtener desuscriptos: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al obtener los desuscriptos.');
        }
    }

    @UseGuards(JwtAuthGuard)
    @Post('unsubscribes')
    async add(@Req() req: any, @Body() body: { email: string; scope?: 'global' | 'campaign'; campaignId?: string; reason?: string }) {
        try {
            const tenantId = req.user?.tenantId ? req.user.tenantId : 'amsa-sender';
            return this.svc.add(tenantId, body.email, body.scope ?? 'global', body.campaignId, body.reason ?? 'admin_add', 'admin_ui');
        } catch (error) {
            this.logger.error(`❌ Error al insertar desuscripto: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al insertar desuscripto.');
        }
    }

    @UseGuards(JwtAuthGuard)
    @Delete('unsubscribes/:id')
    async remove(@Req() req: any, @Param('id') id: string) {
        try {
            // Validar tenant si corresponde
            const tenantId = req.user?.tenantId ? req.user.tenantId : 'amsa-sender';
            return this.svc.remove(tenantId, id);
        } catch (error) {
            this.logger.error(`❌ Error al eliminar desuscripto id: ${id}: ${error.message}`, error.stack);
            throw new InternalServerErrorException(`Error al eliminar desuscripto id: ${id}.`);
        }
    }

    @UseGuards(JwtAuthGuard)
    @Delete('unsubscribes')
    async clearAll(@Req() req: any) {
        try {
            const tenantId = req.user?.tenantId ? req.user.tenantId : 'amsa-sender';
            return this.svc.clearAll(tenantId);
        } catch (error) {
            this.logger.error(`❌ Error al eliminar todos los desuscriptos: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al eliminar todos los desuscriptos.');
        }
    }
}