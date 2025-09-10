import { Controller, Get, Param, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('mailing/vista')
export class EmailPublicController {
    constructor(private prisma: PrismaService) { }

    @Get(':id')
    async verHtml(@Param('id') id: string) {
        try {
            const reporte = await this.prisma.reporteEmail.findUnique({
                where: { id: parseInt(id) },
            });

            if (!reporte || !reporte.html) {
                throw new NotFoundException('Mensaje no encontrado');
            }

            return { html: reporte.html };
        } catch (error) {
            throw new InternalServerErrorException(`Error al obtener el mensaje: ${error.message}`);
        }
    }
}