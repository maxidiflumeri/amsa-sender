import { Controller, Get, Post, Delete, Put, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, validateOrReject } from 'class-validator';

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
export class TemplatesController {
    constructor(private readonly templatesService: TemplatesService) { }

    @Post('preview')
    async preview(@Body() body: PreviewDto) {
        try {
            await validateOrReject(Object.assign(new PreviewDto(), body));
            return await this.templatesService.previewTemplate(body);
        } catch (error) {
            throw new HttpException(error.message || 'Error al generar la vista previa del template', HttpStatus.BAD_REQUEST);
        }
    }

    @Post('preview-real')
    async previewReal(@Body() body: PreviewRealDto) {
        try {
            await validateOrReject(Object.assign(new PreviewRealDto(), body));
            return await this.templatesService.previewReal(body);
        } catch (error) {
            throw new HttpException(error.message || 'Error generando preview real', HttpStatus.BAD_REQUEST);
        }
    }

    @Post()
    async crear(@Body() body: CrearEditarDto) {
        try {
            await validateOrReject(Object.assign(new CrearEditarDto(), body));
            return await this.templatesService.crearTemplate(body);
        } catch (error) {
            throw new HttpException(error.message || 'Error al crear template', HttpStatus.BAD_REQUEST);
        }
    }

    @Get()
    async listar() {
        try {
            return await this.templatesService.listarTemplates();
        } catch (error) {
            throw new HttpException(error.message || 'Error al obtener templates', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Delete(':id')
    async eliminar(@Param('id') id: string) {
        try {
            const parsedId = parseInt(id);
            if (isNaN(parsedId)) throw new Error('ID inválido');
            return await this.templatesService.eliminarTemplate(parsedId);
        } catch (error) {
            throw new HttpException(error.message || 'Error al eliminar template', HttpStatus.BAD_REQUEST);
        }
    }

    @Put(':id')
    async editar(@Param('id') id: string, @Body() body: CrearEditarDto) {
        try {
            const parsedId = parseInt(id);
            if (isNaN(parsedId)) throw new Error('ID inválido');
            await validateOrReject(Object.assign(new CrearEditarDto(), body));
            return await this.templatesService.editarTemplate(parsedId, body);
        } catch (error) {
            throw new HttpException(error.message || 'Error al editar el template', HttpStatus.BAD_REQUEST);
        }
    }
}