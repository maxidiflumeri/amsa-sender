import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { chunk } from 'lodash';
import * as fs from 'fs/promises';
import { PrismaService } from 'src/prisma/prisma.service';
import { CrearWapiCampaniaDto } from './dtos/crear-wapi-campania.dto';
import { parseCsvWapi } from './utils/csv-parser-wapi';

@Injectable()
export class WapiCampaniasService {
  private readonly logger = new Logger(WapiCampaniasService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('wapiEnvios') private readonly wapiQueue: Queue,
  ) {}

  async crearCampania(dto: CrearWapiCampaniaDto, filePath: string, userId: number) {
    this.logger.log(`Creando campaña WA API: ${dto.nombre}`);

    const contactosRaw = await parseCsvWapi(filePath);
    await fs.unlink(filePath).catch(() => null);

    if (contactosRaw.length === 0) {
      throw new Error('El CSV no contiene contactos válidos (columna "numero" requerida).');
    }

    // Obtener números en bajas para filtrar
    const bajasSet = await this.obtenerBajasSet(contactosRaw.map(c => c.numero));

    const campaña = await this.prisma.waApiCampaña.create({
      data: {
        nombre: dto.nombre,
        templateId: dto.templateId,
        userId,
        configId: dto.configId ?? null,
        createdAt: new Date(),
        config: {
          variableMapping: dto.variableMapping ?? {},
          delayMs: dto.delayMs ?? 1200,
          batchSize: dto.batchSize ?? 50,
        },
      },
    });

    // Crear contactos en bloques (excluyendo bajas)
    const contactosFiltrados = contactosRaw.filter(c => !bajasSet.has(c.numero));
    const bloques = chunk(contactosFiltrados, 5000);
    for (const bloque of bloques) {
      await this.prisma.waApiContacto.createMany({
        data: bloque.map(c => ({
          campañaId: campaña.id,
          numero: c.numero,
          nombre: c.nombre ?? null,
          variables: c.datos,
        })),
      });
    }

    const omitidos = contactosRaw.length - contactosFiltrados.length;

    this.logger.log(
      `Campaña ${campaña.id} creada: ${contactosFiltrados.length} contactos, ${omitidos} omitidos por baja`,
    );

    return {
      id: campaña.id,
      totalContactos: contactosFiltrados.length,
      omitidosPorBaja: omitidos,
      mensaje: 'Campaña creada correctamente',
    };
  }

  async enviarCampania(id: number) {
    const campaña = await this.prisma.waApiCampaña.findUniqueOrThrow({ where: { id } });
    if (!['pendiente', 'error'].includes(campaña.estado)) {
      throw new Error(`No se puede enviar una campaña en estado "${campaña.estado}"`);
    }

    const job = await this.wapiQueue.add(
      'enviar-campania',
      { campañaId: id },
      { removeOnComplete: true, removeOnFail: false },
    );

    await this.prisma.waApiCampaña.update({
      where: { id },
      data: { estado: 'procesando', enviadoAt: new Date(), jobId: job.id as string },
    });

    this.logger.log(`Campaña ${id} encolada. Job: ${job.id}`);
    return { jobId: job.id };
  }

  async agendarCampania(id: number, agendadoAt: string) {
    const fecha = new Date(agendadoAt);
    const delay = fecha.getTime() - Date.now();
    if (delay < 0) throw new Error('La fecha de agendamiento debe ser futura.');

    const job = await this.wapiQueue.add(
      'enviar-campania',
      { campañaId: id },
      { delay, removeOnComplete: true, removeOnFail: false },
    );

    await this.prisma.waApiCampaña.update({
      where: { id },
      data: { estado: 'agendada', agendadoAt: fecha, jobId: job.id as string },
    });

    return { jobId: job.id, agendadoAt: fecha };
  }

  async listarCampanias() {
    return this.prisma.waApiCampaña.findMany({
      where: { archivada: false },
      select: {
        id: true,
        nombre: true,
        estado: true,
        pausada: true,
        createdAt: true,
        enviadoAt: true,
        agendadoAt: true,
        template: { select: { metaNombre: true, categoria: true } },
        _count: { select: { contactos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async obtenerCampania(id: number) {
    return this.prisma.waApiCampaña.findUniqueOrThrow({
      where: { id },
      include: { template: true },
    });
  }

  async obtenerReportes(id: number) {
    const [enviados, entregados, leidos, fallidos, total] = await Promise.all([
      this.prisma.waApiReporte.count({ where: { campañaId: id, estado: { in: ['sent', 'delivered', 'read'] } } }),
      this.prisma.waApiReporte.count({ where: { campañaId: id, estado: { in: ['delivered', 'read'] } } }),
      this.prisma.waApiReporte.count({ where: { campañaId: id, estado: 'read' } }),
      this.prisma.waApiReporte.count({ where: { campañaId: id, estado: 'failed' } }),
      this.prisma.waApiReporte.count({ where: { campañaId: id } }),
    ]);
    return { total, enviados, entregados, leidos, fallidos };
  }

  async pausarCampania(id: number) {
    const campaña = await this.prisma.waApiCampaña.findUniqueOrThrow({ where: { id } });
    if (campaña.jobId) {
      const job: Job | undefined = await this.wapiQueue.getJob(campaña.jobId);
      if (job) {
        const state = await job.getState();
        if (['waiting', 'delayed'].includes(state)) await job.remove();
      }
    }
    return this.prisma.waApiCampaña.update({
      where: { id },
      data: { pausada: true, estado: 'pausada' },
    });
  }

  async forzarCierre(id: number, nuevoEstado: 'finalizada' | 'error') {
    const campaña = await this.prisma.waApiCampaña.findUniqueOrThrow({ where: { id } });
    if (campaña.jobId) {
      const job: Job | undefined = await this.wapiQueue.getJob(campaña.jobId);
      if (job) {
        const state = await job.getState();
        if (['waiting', 'delayed', 'active'].includes(state)) await job.remove().catch(() => null);
      }
    }
    return this.prisma.waApiCampaña.update({
      where: { id },
      data: { estado: nuevoEstado },
    });
  }

  async eliminarCampania(id: number) {
    return this.prisma.waApiCampaña.update({
      where: { id },
      data: { archivada: true },
    });
  }

  private async obtenerBajasSet(numeros: string[]): Promise<Set<string>> {
    const bajas = await this.prisma.waApiBaja.findMany({
      where: { numero: { in: numeros } },
      select: { numero: true },
    });
    return new Set(bajas.map(b => b.numero));
  }
}
