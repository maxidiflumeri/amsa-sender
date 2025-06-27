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
    Delete
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CampaniasService } from './campanias.service';
import { AplicarTemplateDto } from './dtos/aplicar-template.dto';
import { AgendarCampañaDto } from './dtos/agendar-campaña.dto';

@Controller('whatsapp/campanias')
export class CampaniasController {
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
        if (!file) {
            throw new BadRequestException('Archivo CSV requerido.');
        }

        const nombreCampaña = body.campaña || 'Campaña sin nombre';
        const filePath = file.path;

        return this.campaniasService.procesarCsv(filePath, nombreCampaña);
    }

    @Get()
    async obtenerCampañas() {
        return this.campaniasService.obtenerCampañas();
    }

    @Get(':id')
    async obtenerCampañaPorId(@Param('id') id: string) {
        const campaña = await this.campaniasService.obtenerCampañaPorId(+id);
        if (!campaña) throw new NotFoundException('Campaña no encontrada');
        return campaña;
    }

    @Get(':id/primer-contacto')
    async obtenerPrimerContacto(@Param('id') id: string) {
        return this.campaniasService.obtenerPrimerContacto(+id);
    }

    @Get(':id/variables')
    async obtenerVariables(@Param('id') id: string) {
        return this.campaniasService.obtenerVariables(+id);
    }

    @Post(':id/aplicar-template')
    async aplicarTemplate(@Param('id') id: string, @Body() dto: AplicarTemplateDto) {
        return this.campaniasService.aplicarTemplate(+id, dto.templateId);
    }

    @Post(':id/agendar')
    async agendarCampaña(@Param('id') id: string, @Body() dto: AgendarCampañaDto) {
        return this.campaniasService.agendarCampaña(+id, dto);
    }

    @Post(':id/pausar')
    async pausarCampaña(@Param('id') id: string) {
        return this.campaniasService.pausarCampaña(+id);
    }

    @Post(':id/reanudar')
    async reanudarCampaña(@Param('id') id: string) {
        return this.campaniasService.reanudarCampaña(+id);
    }

    @Delete(':id')
    async eliminarCampaña(@Param('id') id: string) {
        return this.campaniasService.eliminarCampaña(+id);
    }
}  