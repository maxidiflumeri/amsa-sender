import { Controller, Delete, Get, Param, Post, Res } from '@nestjs/common';
import { SesionesService } from './sesiones.service';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('whatsapp/sesiones')
export class SesionesController {
    constructor(
        private readonly sesionesService: SesionesService,
        private readonly prisma: PrismaService,
    ) { }

    @Delete('clear')
    async clearAll(@Res() res: Response) {
        try {
            await this.prisma.sesion.deleteMany();
            await this.sesionesService.limpiarSesiones();
            await this.sesionesService.borrarTodasLasCarpetasSesion();
            return res.json({ message: 'Todas las sesiones han sido eliminadas.' });
        } catch (error) {
            return res.status(500).json({ error: 'Error al eliminar sesiones.' });
        }
    }

    @Delete(':id')
    async deleteById(@Param('id') id: string, @Res() res: Response) {
        try {
            const sesion = await this.prisma.sesion.findUnique({ where: { sessionId: id } });
            if (sesion) {
                await this.prisma.sesion.delete({ where: { sessionId: id } });
            }
            await this.sesionesService.eliminarSesionPorId(id);
            await this.sesionesService.borrarCarpetaSesion(id);
            return res.json({ message: `Sesión ${id} eliminada correctamente.` });
        } catch (error) {
            return res.status(500).json({ error: 'Error al eliminar la sesión.' });
        }
    }

    @Get('status')
    getStatus() {
        return this.sesionesService.getSesionesActivas();
    }

    @Get('status/:id')
    getStatusById(@Param('id') id: string, @Res() res: Response) {
        const sesion = this.sesionesService.getSesion(id);
        if (!sesion) {
            return res.status(404).json({ error: 'Sesión no encontrada' });
        }
        return res.json({ id, estado: sesion.estado, ani: sesion.ani });
    }

    @Post('conectar')
    async conectarNueva(@Res() res: Response) {
        const sessionId = 'session-' + Date.now();
        this.sesionesService.conectarNuevaSesion(sessionId);
        return res.status(200).json({ sessionId });
    }
}