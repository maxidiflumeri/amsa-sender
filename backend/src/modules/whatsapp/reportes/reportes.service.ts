import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReportesService {
    private readonly logger = new Logger(ReportesService.name);

    constructor(private readonly prisma: PrismaService) { }

    async obtenerCampaniasConReportes() {
        const reportes = await this.prisma.reporte.findMany({ include: { campaña: true } });
        const campañasUnicas = Array.from(
            new Map(reportes.filter(r => r.campaña !== null).map(r => [r.campaña!!.id, r.campaña])).values()
        );
        this.logger.log(`Campañas con reportes obtenidas: ${campañasUnicas.length}`);
        return campañasUnicas;
    }

    async obtenerReportes(campañaId?: string) {
        const where = campañaId ? { campañaId: Number(campañaId) } : {};
        const reportes = await this.prisma.reporte.findMany({ where, include: { campaña: true } });
        this.logger.log(`Reportes obtenidos (${reportes.length})${campañaId ? ` para campaña ID ${campañaId}` : ''}`);
        return reportes;
    }
}