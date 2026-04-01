import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';
import { WapiRespuestasRapidasService } from './wapi-respuestas-rapidas.service';
import { CrearRespuestaRapidaDto } from './dtos/crear-respuesta-rapida.dto';

@Controller('wapi/respuestas-rapidas')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class WapiRespuestasRapidasController {
  constructor(private readonly service: WapiRespuestasRapidasService) {}

  /** Lectura para agentes — solo activas */
  @Get()
  @RequiredPermiso('wapi.inbox')
  listar() {
    return this.service.listar();
  }

  /** Lectura para admin — todas (incluyendo inactivas) */
  @Get('todas')
  @RequiredPermiso('wapi.respuestas_rapidas')
  listarTodas() {
    return this.service.listarTodas();
  }

  @Post()
  @RequiredPermiso('wapi.respuestas_rapidas')
  crear(@Body() dto: CrearRespuestaRapidaDto) {
    return this.service.crear(dto);
  }

  @Put(':id')
  @RequiredPermiso('wapi.respuestas_rapidas')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearRespuestaRapidaDto>) {
    return this.service.actualizar(+id, dto);
  }

  @Delete(':id')
  @RequiredPermiso('wapi.respuestas_rapidas')
  eliminar(@Param('id') id: string) {
    return this.service.eliminar(+id);
  }
}
