import {
    Controller,
    Get,
    Post,
    Body,
    Query,
    Param,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { MensajesService } from './mensajes.service';
import { Mensaje } from '@prisma/client';

@Controller('whatsapp/mensajes')
export class MensajesController {
    private readonly logger = new Logger(MensajesController.name);

    constructor(private readonly mensajesService: MensajesService) { }

    @Post('send-messages')
    async sendMessages(@Body() body) {
        this.logger.log('📨 POST /send-messages - Encolando campaña de mensajes');
        try {
            const result = await this.mensajesService.encolarEnvio(body);
            this.logger.log('✅ Campaña encolada correctamente');
            return result;
        } catch (error) {
            this.logger.error(`❌ Error al encolar campaña: ${error.message}`, error.stack);
            throw new InternalServerErrorException('No se pudo encolar la campaña');
        }
    }

    @Get('campania/:campaniaId/metricas')
    async getMetricas(@Param('campaniaId') campaniaId: string) {
        this.logger.log(`📊 GET /campania/${campaniaId}/metricas - Obteniendo métricas`);
        try {
            return await this.mensajesService.obtenerMetricas(Number(campaniaId));
        } catch (error) {
            this.logger.error(`❌ Error al obtener métricas: ${error.message}`, error.stack);
            throw new InternalServerErrorException('No se pudo obtener métricas.');
        }
    }

    @Post()
    async crearMensaje(@Body() body) {
        this.logger.log('📥 POST / - Creando mensaje manual');
        try {
            return await this.mensajesService.crearMensaje(body);
        } catch (error) {
            this.logger.error(`❌ Error al guardar mensaje: ${error.message}`, error.stack);
            throw new InternalServerErrorException('No se pudo guardar el mensaje.');
        }
    }

    @Get()
    async getMensajes(@Query('campañaId') campañaId: string) {
        this.logger.log(`📄 GET /?campañaId=${campañaId} - Obteniendo mensajes`);
        try {
            return await this.mensajesService.obtenerMensajes(parseInt(campañaId));
        } catch (error) {
            this.logger.error(`❌ Error al obtener mensajes: ${error.message}`, error.stack);
            throw new InternalServerErrorException('No se pudo obtener mensajes.');
        }
    }

    @Get('por-campania')
    async obtenerMensajesPorCampaña(
        @Query('campaniaId') campaniaId: string,
        @Query('numero') numero: string,
    ): Promise<Mensaje[]> {
        this.logger.log(
            `📄 GET /por-campania?campaniaId=${campaniaId}&numero=${numero} - Obteniendo mensajes entre envíos`,
        );
        return this.mensajesService.obtenerMensajesEntreEnvios(
            Number(campaniaId),
            numero,
        );
    }
}  