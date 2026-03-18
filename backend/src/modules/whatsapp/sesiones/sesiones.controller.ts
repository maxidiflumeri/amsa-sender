import {
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Logger,
    NotFoundException,
    InternalServerErrorException,
    UseGuards,
} from '@nestjs/common';
import { SesionesService } from './sesiones.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';

@Controller('whatsapp/sesiones')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('whatsapp.sesiones')
export class SesionesController {
    private readonly logger = new Logger(SesionesController.name);

    constructor(
        private readonly sesionesService: SesionesService,
        private readonly prisma: PrismaService,
    ) { }

    @Delete('clear')
    async clearAll() {
        this.logger.log('🧹 DELETE /clear - Eliminando todas las sesiones');
        try {
            await this.prisma.sesion.deleteMany();
            await this.sesionesService.limpiarSesiones();
            await this.sesionesService.borrarTodasLasCarpetasSesion();
            this.logger.log('✅ Todas las sesiones eliminadas correctamente');
            return { message: 'Todas las sesiones han sido eliminadas.' };
        } catch (error) {
            this.logger.error('❌ Error al eliminar todas las sesiones', error.stack);
            throw new InternalServerErrorException('Error al eliminar sesiones.');
        }
    }

    @Delete(':id')
    async deleteById(@Param('id') id: string) {
        this.logger.log(`🗑️ DELETE /${id} - Eliminando sesión`);
        try {
            const sesion = await this.prisma.sesion.findUnique({
                where: { sessionId: id },
            });
            if (sesion) {
                await this.prisma.sesion.delete({ where: { sessionId: id } });
            }
            await this.sesionesService.eliminarSesionPorId(id);
            await this.sesionesService.borrarCarpetaSesion(id);
            this.logger.log(`✅ Sesión ${id} eliminada correctamente`);
            return { message: `Sesión ${id} eliminada correctamente.` };
        } catch (error) {
            this.logger.error(`❌ Error al eliminar sesión ${id}`, error.stack);
            throw new InternalServerErrorException('Error al eliminar la sesión.');
        }
    }

    @Get('status')
    getStatus() {
        this.logger.log('📥 GET /status - Solicitando estado de todas las sesiones');
        return this.sesionesService.getSesionesActivas();
    }

    @Get('status/:id')
    getStatusById(@Param('id') id: string) {
        this.logger.log(`📥 GET /status/${id} - Solicitando estado de sesión`);
        const sesion = this.sesionesService.getSesion(id);
        if (!sesion) {
            this.logger.warn(`⚠️ Sesión ${id} no encontrada`);
            throw new NotFoundException('Sesión no encontrada');
        }
        this.logger.log(`✅ Estado de sesión ${id}: ${sesion.estado}`);
        return { id, estado: sesion.estado, ani: sesion.ani };
    }

    @Post('conectar')
    async conectarNueva() {
        const sessionId = 'session-' + Date.now();
        this.logger.log(`🔌 POST /conectar - Conectando nueva sesión: ${sessionId}`);
        this.sesionesService.conectarNuevaSesion(sessionId);
        this.logger.log(`✅ Sesión ${sessionId} en proceso de conexión`);
        return { sessionId };
    }
}  