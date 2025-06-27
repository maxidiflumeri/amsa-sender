import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { MensajesService } from './mensajes.service';
import { InternalServerErrorException } from '@nestjs/common';

@Controller('whatsapp/mensajes')
export class MensajesController {
    constructor(private readonly mensajesService: MensajesService) { }

    @Post('send-messages')
    async sendMessages(@Body() body) {
        try {
            return await this.mensajesService.encolarEnvio(body);
        } catch (error) {
            throw new InternalServerErrorException('No se pudo encolar la campaña');
        }
    }

    @Get('campania/:campaniaId/metricas')
    async getMetricas(@Param('campaniaId') campaniaId: string) {
        try {
            return await this.mensajesService.obtenerMetricas(Number(campaniaId));
        } catch (error) {
            throw new InternalServerErrorException('No se pudo obtener métricas.');
        }
    }

    @Post()
    async crearMensaje(@Body() body) {
        try {
            return await this.mensajesService.crearMensaje(body);
        } catch (error) {
            throw new InternalServerErrorException('No se pudo guardar el mensaje.');
        }
    }

    @Get()
    async getMensajes(@Query('campañaId') campañaId: string) {
        try {
            return await this.mensajesService.obtenerMensajes(parseInt(campañaId));
        } catch (error) {
            throw new InternalServerErrorException('No se pudo obtener mensajes.');
        }
    }
}