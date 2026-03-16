import {
    Controller,
    Post,
    Get,
    Param,
    NotFoundException,
    UploadedFile,
    UseInterceptors,
    Body,
    BadRequestException,
    Delete,
    Logger,
    UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CampaniasService } from './campanias.service';
import { AplicarTemplateDto } from './dtos/aplicar-template.dto';
import { AgendarCampañaDto } from './dtos/agendar-campaña.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('whatsapp/campanias')
@UseGuards(JwtAuthGuard)
export class CampaniasController {
    private readonly logger = new Logger(CampaniasController.name); // Corregido: antes usaba mal el nombre

    constructor(private readonly campaniasService: CampaniasService) { }

    @Post('upload-csv')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: './uploads',
                filename: (_req, file, cb) => {
                    const filename = `${Date.now()}-${file.originalname}`;
                    cb(null, filename);
                },
            }),
        }),
    )
    async uploadCsv(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
        this.logger.log(`📥 POST /upload-csv - Archivo recibido: ${file?.originalname}`);
        if (!file) {
            this.logger.warn('❌ Archivo CSV no encontrado en la solicitud');
            throw new BadRequestException('Archivo CSV requerido.');
        }

        const nombreCampaña = body.campania || 'Campaña sin nombre';
        const filePath = file.path;
        this.logger.debug(`📄 Guardando archivo en: ${filePath} | Nombre campaña: ${nombreCampaña}`);

        return this.campaniasService.procesarCsv(filePath, nombreCampaña);
    }

    @Get()
    async obtenerCampañas() {
        this.logger.log('📥 GET / - Obtener todas las campañas');
        return this.campaniasService.obtenerCampañas();
    }

    @Get(':id')
    async obtenerCampañaPorId(@Param('id') id: string) {
        this.logger.log(`📥 GET /${id} - Buscar campaña por ID`);
        const campaña = await this.campaniasService.obtenerCampañaPorId(+id);
        if (!campaña) {
            this.logger.warn(`⚠️ Campaña con ID ${id} no encontrada`);
            throw new NotFoundException('Campaña no encontrada');
        }
        return campaña;
    }

    @Get(':id/primer-contacto')
    async obtenerPrimerContacto(@Param('id') id: string) {
        this.logger.log(`📥 GET /${id}/primer-contacto - Primer contacto de campaña`);
        return this.campaniasService.obtenerPrimerContacto(+id);
    }

    @Get(':id/variables')
    async obtenerVariables(@Param('id') id: string) {
        this.logger.log(`📥 GET /${id}/variables - Variables de campaña`);
        return this.campaniasService.obtenerVariables(+id);
    }

    @Post(':id/aplicar-template')
    async aplicarTemplate(@Param('id') id: string, @Body() dto: AplicarTemplateDto) {
        this.logger.log(`📥 POST /${id}/aplicar-template - Aplicar template ID: ${dto.templateId}`);
        return this.campaniasService.aplicarTemplate(+id, dto.templateId);
    }

    @Post(':id/agendar')
    async agendarCampaña(@Param('id') id: string, @Body() dto: AgendarCampañaDto) {
        this.logger.log(`📥 POST /${id}/agendar - Agendar campaña: ${JSON.stringify(dto)}`);
        return this.campaniasService.agendarCampaña(+id, dto);
    }

    @Post(':id/pausar')
    async pausarCampaña(@Param('id') id: string) {
        this.logger.log(`📥 POST /${id}/pausar - Pausar campaña`);
        return this.campaniasService.pausarCampaña(+id);
    }

    @Post(':id/reanudar')
    async reanudarCampaña(@Param('id') id: string) {
        this.logger.log(`📥 POST /${id}/reanudar - Reanudar campaña`);
        return this.campaniasService.reanudarCampaña(+id);
    }

    @Post(':id/forzar-cierre')
    async forzarCierre(@Param('id') id: string, @Body() body: { estado: 'finalizada' | 'error' }) {
        this.logger.log(`📥 POST /${id}/forzar-cierre → ${body.estado}`);
        return this.campaniasService.forzarCierre(+id, body.estado ?? 'error');
    }

    @Delete(':id')
    async eliminarCampaña(@Param('id') id: string) {
        this.logger.log(`🗑️ DELETE /${id} - Eliminar campaña`);
        return this.campaniasService.eliminarCampaña(+id);
    }
}