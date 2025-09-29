import {
    Controller,
    Post,
    Body,
    UseGuards,
    Get,
    Logger,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    Delete,
    Param,
    Query
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CampaniasEmailService } from './campanias-email.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Controller('email/campanias')
@UseGuards(JwtAuthGuard)

export class CampaniasEmailController {
    private readonly logger = new Logger(CampaniasEmailController.name); // Corregido: antes usaba mal el nombre
    constructor(private readonly campaniasService: CampaniasEmailService) { }

    @Post()
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
    async crearCampaña(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
        this.logger.log(`📥 POST / - Crear campaña: ${body.nombre}`);
        if (!file) {
            this.logger.warn('❌ Archivo CSV no encontrado en la solicitud');
            throw new BadRequestException('Archivo CSV requerido.');
        }

        const filePath = file.path;
        return this.campaniasService.crearCampañaEmail(body, filePath);
    }

    @Get()
    async obtenerCampañas(@Query('lite') lite?: string) {
        this.logger.log('📥 GET / - Obtener todas las campañas');
        if (lite === '1' || lite === 'true') {
            return this.campaniasService.obtenerCampañasLite();
        }
        return this.campaniasService.obtenerCampañas();
    }

    @Get(':id/contactos')
    async getContactosPorCampania(
        @Param('id') id: string,
        @Query('page') page?: string,
        @Query('size') size?: string,
        @Query('q') q?: string,
    ) {
        return this.campaniasService.contactosPorCampania(Number(id), { page, size, q });
    }

    @Delete(':id')
    async eliminarCampaña(@Param('id') id: string) {
        this.logger.log(`🗑️ DELETE /${id} - Eliminar campaña`);
        return this.campaniasService.eliminarCampaña(+id);
    }
}
