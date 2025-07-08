import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TemplatesEmailService } from './templates-email.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

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
            design: body.design
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
}