import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GuardarWapiConfigDto } from './dtos/guardar-wapi-config.dto';

@Injectable()
export class WapiConfigService {
  private readonly logger = new Logger(WapiConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async obtenerConfig() {
    const config = await this.prisma.waApiConfig.findFirst({
      where: { activo: true },
    });
    if (!config) return null;
    // No exponer el token completo en el listado
    return {
      ...config,
      token: config.token ? `${config.token.slice(0, 8)}...` : null,
      appSecret: config.appSecret ? '****' : null,
    };
  }

  async guardarConfig(dto: GuardarWapiConfigDto) {
    this.logger.log('Guardando configuración de WhatsApp API');
    const existente = await this.prisma.waApiConfig.findFirst({ where: { activo: true } });

    if (existente) {
      return this.prisma.waApiConfig.update({
        where: { id: existente.id },
        data: dto,
      });
    }

    return this.prisma.waApiConfig.create({ data: { ...dto } });
  }

  /** Uso interno: devuelve config completa con token real */
  async obtenerConfigCompleta() {
    const config = await this.prisma.waApiConfig.findFirst({ where: { activo: true } });
    if (!config) throw new NotFoundException('No hay configuración de WhatsApp API guardada');
    return config;
  }
}
