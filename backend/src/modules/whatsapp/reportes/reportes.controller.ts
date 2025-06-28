import { Controller, Get, Query, InternalServerErrorException } from '@nestjs/common';
import { ReportesService } from './reportes.service';

@Controller('whatsapp/reportes')
export class ReportesController {
    constructor(private readonly reportesService: ReportesService) { }

    @Get('campanias-con-reportes')
    async getCampaniasConReportes() {
        try {
            return await this.reportesService.obtenerCampaniasConReportes();
        } catch (error) {
            throw new InternalServerErrorException('Error al obtener campañas con reportes.');
        }
    }

    @Get()
    async getReportes(@Query('campañaId') campañaId: string) {
        try {
            return await this.reportesService.obtenerReportes(campañaId);
        } catch (error) {
            throw new InternalServerErrorException('Error al obtener reportes.');
        }
    }
}