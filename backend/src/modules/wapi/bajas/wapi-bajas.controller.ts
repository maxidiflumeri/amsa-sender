import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';
import { WapiBajasService } from './wapi-bajas.service';

@Controller('wapi/bajas')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('wapi.bajas')
export class WapiBajasController {
  constructor(private readonly bajasService: WapiBajasService) {}

  @Get()
  listar(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('q') q?: string,
  ) {
    return this.bajasService.listarBajas(
      page ? +page : 1,
      size ? +size : 50,
      q,
    );
  }

  @Post()
  agregarManual(@Body() body: { numero: string }) {
    return this.bajasService.agregarBajaManual(body.numero);
  }

  @Delete(':numero')
  eliminar(@Param('numero') numero: string) {
    return this.bajasService.eliminarBaja(numero);
  }
}
