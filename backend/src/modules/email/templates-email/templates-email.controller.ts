import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { TemplatesEmailService } from './templates-email.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UpdateTemplateEmailDto } from './dtos/update-template-email.dto';

@Controller('email/templates')
@UseGuards(JwtAuthGuard)

export class TemplatesEmailController {
    constructor(private readonly service: TemplatesEmailService) { }

    @Post()
    crear(@Body() body: any) {
        return this.service.crear({
            nombre: body.nombre,
            asunto: body.asunto,
            html: body.html,
            design: body.design,
            creadoAt: new Date()
        });
    }

    @Get()
    listar() {
        return this.service.obtenerTodos();
    }

    @Get(':id')
    obtener(@Param('id') id: string) {
        return this.service.obtenerUno(Number(id));
    }

    // email-templates.controller.ts
    @Put(':id')
    async updateTemplate(@Param('id') id: string, @Body() updateDto: UpdateTemplateEmailDto) {
        return this.service.update(+id, updateDto);
    }

    @Post('preview')
    renderPreview(@Body() body: { html: string; datos: Record<string, any>, asunto: string }) {
        let html = body.html;
        let asunto = body.asunto

        for (const [key, value] of Object.entries(body.datos)) {
            const tag = `{{${key}}}`;
            html = html.replaceAll(tag, value ?? '');
            asunto = asunto.replaceAll(tag, value ?? '')
        }

        return { html, asunto };
    }

    @Delete(':id')
    async eliminar(@Param('id') id: string) {
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) throw new Error('ID inválido');
        return await this.service.eliminarTemplate(parsedId);
    }
}