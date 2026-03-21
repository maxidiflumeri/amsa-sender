import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
  listar(@Query('configId') configId?: string) {
    return this.wapiTemplatesService.listarTemplates(configId ? Number(configId) : undefined);
  }

  @Post('sincronizar')
  sincronizar(@Query('configId') configId?: string) {
    return this.wapiTemplatesService.sincronizarDesideMeta(configId ? Number(configId) : undefined);
  }

  @Patch(':id/button-actions')
  actualizarButtonActions(
    @Param('id') id: string,
    @Body() dto: ActualizarButtonActionsDto,
  ) {
    return this.wapiTemplatesService.actualizarButtonActions(+id, dto);
  }
}
