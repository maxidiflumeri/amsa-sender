import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CrearRespuestaRapidaDto } from './dtos/crear-respuesta-rapida.dto';

@Injectable()
export class WapiRespuestasRapidasService {
  private readonly logger = new Logger(WapiRespuestasRapidasService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    return this.prisma.waApiRespuestaRapida.findMany({
      where: { activo: true },
      orderBy: { titulo: 'asc' },
    });
  }

  async listarTodas() {
    return this.prisma.waApiRespuestaRapida.findMany({
      orderBy: { titulo: 'asc' },
    });
  }

  async crear(dto: CrearRespuestaRapidaDto) {
    const rr = await this.prisma.waApiRespuestaRapida.create({
      data: {
        titulo: dto.titulo,
        contenido: dto.contenido,
        tags: dto.tags ?? [],
        activo: dto.activo ?? true,
      },
    });
    this.logger.log(`Respuesta rápida creada: ${rr.id} — ${rr.titulo}`);
    return rr;
  }

  async actualizar(id: number, dto: Partial<CrearRespuestaRapidaDto>) {
    await this.prisma.waApiRespuestaRapida.findUniqueOrThrow({ where: { id } });
    return this.prisma.waApiRespuestaRapida.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined && { titulo: dto.titulo }),
        ...(dto.contenido !== undefined && { contenido: dto.contenido }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
    });
  }

  async eliminar(id: number) {
    await this.prisma.waApiRespuestaRapida.findUniqueOrThrow({ where: { id } });
    await this.prisma.waApiRespuestaRapida.delete({ where: { id } });
    this.logger.log(`Respuesta rápida eliminada: ${id}`);
    return { ok: true };
  }
}
