import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GuardarWapiConfigDto } from './dtos/guardar-wapi-config.dto';

@Injectable()
export class WapiConfigService {
  private readonly logger = new Logger(WapiConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listarConfigs() {
    const configs = await this.prisma.waApiConfig.findMany({
      orderBy: { creadoAt: 'asc' },
    });
    return configs.map(c => ({
      ...c,
      token: c.token ? `${c.token.slice(0, 8)}...` : null,
      appSecret: c.appSecret ? '****' : null,
    }));
  }

  async obtenerConfig(id: number) {
    const config = await this.prisma.waApiConfig.findUnique({ where: { id } });
    if (!config) return null;
    return {
      ...config,
      token: config.token ? `${config.token.slice(0, 8)}...` : null,
      appSecret: config.appSecret ? '****' : null,
    };
  }

  async crearConfig(dto: GuardarWapiConfigDto) {
    this.logger.log(`Creando nueva configuración: ${dto.nombre}`);
    return this.prisma.waApiConfig.create({ data: dto as any });
  }

  async actualizarConfig(id: number, dto: GuardarWapiConfigDto) {
    this.logger.log(`Actualizando configuración ${id}`);
    const data: any = { ...dto };
    if (!data.token) delete data.token;
    if (!data.appSecret) delete data.appSecret;
    return this.prisma.waApiConfig.update({ where: { id }, data });
  }

  async eliminarConfig(id: number) {
    return this.prisma.waApiConfig.delete({ where: { id } });
  }

  async toggleActivo(id: number) {
    const config = await this.prisma.waApiConfig.findUniqueOrThrow({ where: { id } });
    return this.prisma.waApiConfig.update({
      where: { id },
      data: { activo: !config.activo },
    });
  }

  /** Uso interno: obtiene config completa (con token real) por id. Fallback a primera activa. */
  async obtenerConfigCompleta(id?: number) {
    if (id) {
      const config = await this.prisma.waApiConfig.findUnique({ where: { id } });
      if (config) return config;
    }
    const config = await this.prisma.waApiConfig.findFirst({
      where: { activo: true },
      orderBy: { creadoAt: 'asc' },
    });
    if (!config) throw new NotFoundException('No hay configuración de WhatsApp API guardada');
    return config;
  }
}
