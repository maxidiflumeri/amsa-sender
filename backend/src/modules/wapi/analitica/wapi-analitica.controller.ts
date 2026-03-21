import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';
import { WapiAnaliticaService } from './wapi-analitica.service';

@Controller('wapi/analitica')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('wapi.analitica')
export class WapiAnaliticaController {
  constructor(private readonly analiticaService: WapiAnaliticaService) {}

  @Get('campania/:id')
  metricasCampania(@Param('id') id: string) {
    return this.analiticaService.metricasCampania(+id);
  }

  @Get('campania/:id/contactos')
  contactosCampania(
    @Param('id') id: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('filtro') filtro: string,
  ) {
    return this.analiticaService.contactosCampania(
      +id,
      parseInt(page) || 1,
      parseInt(limit) || 20,
      filtro || 'todos',
    );
  }

  @Get('campania/:id/conversaciones')
  conversacionesCampania(@Param('id') id: string) {
    return this.analiticaService.conversacionesCampania(+id);
  }

  @Get('agentes')
  metricasAgentes(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    const desdeDate = desde ? new Date(desde) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const hastaDate = hasta ? new Date(hasta) : new Date();
    return this.analiticaService.metricasAgentes(desdeDate, hastaDate);
  }

  @Get('agentes/:userId')
  detalleAgente(
    @Param('userId') userId: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    const desdeDate = desde ? new Date(desde) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const hastaDate = hasta ? new Date(hasta) : new Date();
    return this.analiticaService.detalleAgente(+userId, desdeDate, hastaDate);
  }
}
