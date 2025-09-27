// src/scheduler/tareas.controller.ts
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CrearTareaDto } from './dto/crear-tarea.dto';
import { TareasService } from './tarea.service';

@Controller('tareas-programadas')
export class TareasController {
    constructor(private readonly svc: TareasService) { }

    @Get()
    listar() { return this.svc.listar(); }

    @Post()
    crear(@Body() dto: CrearTareaDto) {
        return this.svc.crear(dto);
    }

    @Put(':id')
    actualizar(@Param('id') id: string, @Body() dto: Partial<CrearTareaDto>) {
        return this.svc.actualizar(Number(id), dto);
    }

    @Post(':id/alternar')
    alternar(@Param('id') id: string) {
        return this.svc.alternar(Number(id));
    }

    @Post(':id/ejecutar-ahora')
    ejecutarAhora(@Param('id') id: string) {
        return this.svc.ejecutarAhora(Number(id));
    }

    @Get(':id/ejecuciones')
    ejecuciones(@Param('id') id: string) {
        return this.svc.ejecuciones(Number(id));
    }
}