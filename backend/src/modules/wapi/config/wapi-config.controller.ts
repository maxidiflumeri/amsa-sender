import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';
import { WapiConfigService } from './wapi-config.service';
import { GuardarWapiConfigDto } from './dtos/guardar-wapi-config.dto';

@Controller('wapi/config')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('wapi.config')
export class WapiConfigController {
  constructor(private readonly service: WapiConfigService) {}

  @Get()
  listar() {
    return this.service.listarConfigs();
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtenerConfig(id);
  }

  @Post()
  crear(@Body() dto: GuardarWapiConfigDto) {
    return this.service.crearConfig(dto);
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: GuardarWapiConfigDto) {
    return this.service.actualizarConfig(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminarConfig(id);
  }

  @Post(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.service.toggleActivo(id);
  }
}
