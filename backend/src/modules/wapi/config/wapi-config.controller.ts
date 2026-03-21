import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';
import { WapiConfigService } from './wapi-config.service';
import { GuardarWapiConfigDto } from './dtos/guardar-wapi-config.dto';

@Controller('wapi/config')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('wapi.config')
export class WapiConfigController {
  constructor(private readonly wapiConfigService: WapiConfigService) {}

  @Get()
  obtenerConfig() {
    return this.wapiConfigService.obtenerConfig();
  }

  @Post()
  guardarConfig(@Body() dto: GuardarWapiConfigDto) {
    return this.wapiConfigService.guardarConfig(dto);
  }
}
