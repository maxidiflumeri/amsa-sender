import {
    Controller,
    Get,
    Post,
    Delete,
    Put,
    Param,
    Body,
    HttpException,
    HttpStatus,
    Logger,
    UseGuards,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import {
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    validateOrReject,
} from 'class-validator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';

class PreviewDto {
    @IsOptional()
    @IsNumber()
    templateId?: number;

    @IsOptional()
    @IsString()
    contenido?: string;

    @IsNotEmpty()
    @IsObject()
    ejemplo: object;
}

class PreviewRealDto {
    @IsNotEmpty()
    @IsNumber()
    templateId: number;

    @IsNotEmpty()
    @IsNumber()
    campañaId: number;
}

class CrearEditarDto {
    @IsNotEmpty()
    @IsString()
    nombre: string;

    @IsNotEmpty()
    @IsString()
    contenido: string;
}

@Controller('whatsapp/templates')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('whatsapp.templates')
export class TemplatesController {
    private readonly logger = new Logger(TemplatesController.name);

    constructor(private readonly templatesService: TemplatesService) { }

    @Post('preview')
    async preview(@Body() body: PreviewDto) {
        this.logger.log(`📥 POST /preview - Generando vista previa de template`);
        try {
            await validateOrReject(Object.assign(new PreviewDto(), body));
            return await this.templatesService.previewTemplate(body);
        } catch (error) {
            this.logger.warn(`❌ Error en preview: ${error.message}`, error.stack);
            throw new HttpException(
                error.message || 'Error al generar la vista previa del template',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    @Post('preview-real')
    async previewReal(@Body() body: PreviewRealDto) {
        this.logger.log(
            `📥 POST /preview-real - Vista previa real para templateId: ${body.templateId}, campañaId: ${body.campañaId}`,
        );
        try {
            await validateOrReject(Object.assign(new PreviewRealDto(), body));
            return await this.templatesService.previewReal(body);
        } catch (error) {
            this.logger.warn(`❌ Error en preview-real: ${error.message}`, error.stack);
            throw new HttpException(
                error.message || 'Error generando preview real',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    @Post()
    async crear(@Body() body: CrearEditarDto) {
        this.logger.log(`📝 POST / - Creando nuevo template: ${body.nombre}`);
        try {
            await validateOrReject(Object.assign(new CrearEditarDto(), body));
            return await this.templatesService.crearTemplate(body);
        } catch (error) {
            this.logger.warn(`❌ Error al crear template: ${error.message}`, error.stack);
            throw new HttpException(
                error.message || 'Error al crear template',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    @Get()
    async listar() {
        this.logger.log(`📥 GET / - Listando templates`);
        try {
            return await this.templatesService.listarTemplates();
        } catch (error) {
            this.logger.error(`❌ Error al listar templates: ${error.message}`, error.stack);
            throw new HttpException(
                error.message || 'Error al obtener templates',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Delete(':id')
    async eliminar(@Param('id') id: string) {
        this.logger.log(`🗑️ DELETE /${id} - Eliminando template`);
        try {
            const parsedId = parseInt(id);
            if (isNaN(parsedId)) throw new Error('ID inválido');
            return await this.templatesService.eliminarTemplate(parsedId);
        } catch (error) {
            this.logger.warn(`❌ Error al eliminar template ${id}: ${error.message}`, error.stack);
            throw new HttpException(
                error.message || 'Error al eliminar template',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    @Put(':id')
    async editar(@Param('id') id: string, @Body() body: CrearEditarDto) {
        this.logger.log(`✏️ PUT /${id} - Editando template`);
        try {
            const parsedId = parseInt(id);
            if (isNaN(parsedId)) throw new Error('ID inválido');
            await validateOrReject(Object.assign(new CrearEditarDto(), body));
            return await this.templatesService.editarTemplate(parsedId, body);
        } catch (error) {
            this.logger.warn(`❌ Error al editar template ${id}: ${error.message}`, error.stack);
            throw new HttpException(
                error.message || 'Error al editar el template',
                HttpStatus.BAD_REQUEST,
            );
        }
    }
}  