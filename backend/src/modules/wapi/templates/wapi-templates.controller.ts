import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';
import { WapiTemplatesService } from './wapi-templates.service';
import { ActualizarButtonActionsDto } from './dtos/actualizar-button-actions.dto';

@Controller('wapi/templates')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('wapi.templates')
export class WapiTemplatesController {
  constructor(private readonly wapiTemplatesService: WapiTemplatesService) {}

  @Get()
  listar() {
    return this.wapiTemplatesService.listarTemplates();
  }

  @Post('sincronizar')
  sincronizar() {
    return this.wapiTemplatesService.sincronizarDesideMeta();
  }

  @Patch(':id/button-actions')
  actualizarButtonActions(
    @Param('id') id: string,
    @Body() dto: ActualizarButtonActionsDto,
  ) {
    return this.wapiTemplatesService.actualizarButtonActions(+id, dto);
  }
}
