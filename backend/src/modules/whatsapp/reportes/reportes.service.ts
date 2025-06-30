import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReportesService {
    private readonly logger = new Logger(ReportesService.name);

    constructor(private readonly prisma: PrismaService) { }

    async obtenerCampaniasConReportes() {
        this.logger.log('📊 Buscando campañas con reportes...');
        try {
            const reportes = await this.prisma.reporte.findMany({ include: { campaña: true } });

            const campañasUnicas = Array.from(
                new Map(
                    reportes
                        .filter((r) => r.campaña !== null)
                        .map((r) => [r.campaña!!.id, r.campaña]),
                ).values(),
            );

            this.logger.log(`✅ Campañas con reportes obtenidas: ${campañasUnicas.length}`);
            return campañasUnicas;
        } catch (error) {
            this.logger.error(`❌ Error al obtener campañas con reportes: ${error.message}`, error.stack);
            throw error;
        }
    }

    async obtenerReportes(campañaId?: string) {
        this.logger.log(`📄 Obteniendo reportes${campañaId ? ` para campaña ID ${campañaId}` : ''}`);
        try {
            const where = campañaId ? { campañaId: Number(campañaId) } : {};
            const reportes = await this.prisma.reporte.findMany({ where, include: { campaña: true } });

            this.logger.log(`✅ Reportes obtenidos: ${reportes.length}`);
            return reportes;
        } catch (error) {
            this.logger.error(`❌ Error al obtener reportes: ${error.message}`, error.stack);
            throw error;
        }
    }
}