import {
    Controller,
    Get,
    Query,
    InternalServerErrorException,
    Logger,
    UseGuards,
} from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('whatsapp/reportes')
@UseGuards(JwtAuthGuard)
export class ReportesController {
    private readonly logger = new Logger(ReportesController.name);

    constructor(private readonly reportesService: ReportesService) { }

    @Get('campanias-con-reportes')
    async getCampaniasConReportes() {
        this.logger.log('📥 GET /campanias-con-reportes - Obteniendo campañas con reportes');
        try {
            const result = await this.reportesService.obtenerCampaniasConReportes();
            this.logger.log(`✅ Campañas con reportes obtenidas: ${result.length}`);
            return result;
        } catch (error) {
            this.logger.error(`❌ Error al obtener campañas con reportes: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al obtener campañas con reportes.');
        }
    }

    @Get()
    async getReportes(@Query('campañaId') campañaId: string) {
        this.logger.log(`📥 GET /?campañaId=${campañaId} - Obteniendo reportes`);
        try {
            const result = await this.reportesService.obtenerReportes(campañaId);
            this.logger.log(`✅ Reportes obtenidos para campaña ${campañaId}: ${result.length}`);
            return result;
        } catch (error) {
            this.logger.error(`❌ Error al obtener reportes: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al obtener reportes.');
        }
    }
}  