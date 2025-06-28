import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseCsv } from './utils/csv-parser';
import * as fs from 'fs/promises';
import { Prisma } from '@prisma/client';
import * as Handlebars from 'handlebars';
import { AgendarCampañaDto } from './dtos/agendar-campaña.dto';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class CampaniasService {
    private readonly logger = new Logger(CampaniasService.name);

    constructor(private prisma: PrismaService, @InjectQueue('colaEnvios') private readonly colaEnvios: Queue) { }

    async procesarCsv(filePath: string, nombreCampaña: string) {
        try {
            const contactos = await parseCsv(filePath);

            const campaña = await this.prisma.campaña.create({
                data: { nombre: nombreCampaña },
            });

            for (const c of contactos) {
                await this.prisma.contacto.create({
                    data: {
                        numero: c.numero,
                        mensaje: c.mensaje,
                        datos: c.datos,
                        campañaId: campaña.id,
                    },
                });
            }

            this.logger.log(`CSV procesado: ${contactos.length} contactos.`);

            await fs.unlink(filePath);

            return {
                total: contactos.length,
                campaña: nombreCampaña,
            };
        } catch (err) {
            this.logger.error(`Error procesando CSV: ${err.message}`);
            await fs.unlink(filePath).catch(() => { });
            throw new InternalServerErrorException('Error al procesar el archivo CSV.');
        }
    }

    async obtenerCampañas() {
        return this.prisma.campaña.findMany({
            where: { archivada: false },
            include: { contactos: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async obtenerCampañaPorId(id: number) {
        return this.prisma.campaña.findUnique({ where: { id } });
    }

    async obtenerPrimerContacto(campañaId: number) {
        const contacto = await this.prisma.contacto.findFirst({
            where: {
                campañaId,
                datos: { not: Prisma.JsonNull },
            },
            orderBy: { id: 'asc' },
            select: {
                numero: true,
                datos: true,
            },
        });

        if (!contacto) throw new NotFoundException('No se encontró un contacto con datos');
        return contacto;
    }

    async obtenerVariables(campañaId: number) {
        const contactos = await this.prisma.contacto.findMany({
            where: {
                campañaId,
                datos: { not: Prisma.JsonNull },
            },
            select: { datos: true },
            take: 50,
        });

        const variablesSet = new Set<string>();
        for (const c of contactos) {
            if (c.datos && typeof c.datos === 'object') {
                Object.keys(c.datos).forEach((k) => variablesSet.add(k));
            }
        }

        return Array.from(variablesSet);
    }

    async aplicarTemplate(campañaId: number, templateId: number) {
        const template = await this.prisma.template.findUnique({ where: { id: templateId } });
        if (!template) throw new NotFoundException('Template no encontrado');

        const campaña = await this.prisma.campaña.findUnique({
            where: { id: campañaId },
            include: { contactos: true },
        });

        if (!campaña) throw new NotFoundException('Campaña no encontrada');

        const compiled = Handlebars.compile(template.contenido);

        const updates = campaña.contactos.map((contacto) => {
            let mensajeGenerado = '';

            try {
                mensajeGenerado = compiled(contacto.datos || {});
            } catch (e) {
                mensajeGenerado = '[Error al generar mensaje: variables faltantes]';
            }

            return this.prisma.contacto.update({
                where: { id: contacto.id },
                data: { mensaje: mensajeGenerado },
            });
        });

        await Promise.all(updates);

        await this.prisma.campaña.update({
            where: { id: campañaId },
            data: { templateId },
        });

        return { mensaje: 'Template aplicado correctamente a los contactos' };
    }

    async agendarCampaña(id: number, dto: AgendarCampañaDto) {
        const delay = Math.max(new Date(dto.fechaAgenda).getTime() - Date.now(), 0);

        const job = await this.colaEnvios.add('enviar', {
            sessionIds: dto.sessionIds,
            campaña: id,
            config: dto.config,
        }, {
            delay,
        });

        await this.prisma.campaña.update({
            where: { id },
            data: {
                agendadoAt: new Date(dto.fechaAgenda),
                estado: 'programada',
                sesiones: JSON.stringify(dto.sessionIds),
                config: dto.config,
                jobId: job.id,
            },
        });

        return { ok: true, message: 'Campaña agendada correctamente' };
    }

    async pausarCampaña(id: number) {
        const campaña = await this.prisma.campaña.findUnique({
            where: { id },
            select: { estado: true },
        });

        if (!campaña) throw new NotFoundException('Campaña no encontrada');

        const nuevoEstado =
            campaña.estado === 'procesando' ? 'pausada' : 'pausa_pendiente';

        await this.prisma.campaña.update({
            where: { id },
            data: { estado: nuevoEstado },
        });

        return { message: `Campaña marcada como ${nuevoEstado} correctamente` };
    }

    async reanudarCampaña(id: number) {
        const campaña = await this.prisma.campaña.findUnique({ where: { id } });

        if (!campaña || campaña.estado !== 'pausada') {
            throw new BadRequestException('Campaña no válida o no pausada');
        }

        const sessionIds = JSON.parse(campaña.sesiones || '[]');
        const config = campaña.config;

        if (!sessionIds.length || !config) {
            throw new BadRequestException('Faltan datos para reanudar la campaña');
        }

        await this.colaEnvios.add('enviar', {
            sessionIds,
            campaña: id,
            config,
        });

        await this.prisma.campaña.update({
            where: { id },
            data: { estado: 'procesando', pausada: false },
        });

        return { ok: true };
    }

    async eliminarCampaña(id: number) {
        const campaña = await this.prisma.campaña.findUnique({ where: { id } });

        if (!campaña) throw new NotFoundException('Campaña no encontrada');
        if (campaña.estado === 'procesando') {
            throw new BadRequestException('No se puede eliminar una campaña en proceso');
        }

        if (campaña.jobId) {
            try {
                const job: Job | undefined = await this.colaEnvios.getJob(campaña.jobId);
                if (job) {
                    await job.remove();
                    this.logger.log(`🗑️ Job ${campaña.jobId} eliminado de la cola.`);
                }
            } catch (err) {
                this.logger.warn(`No se pudo eliminar el job ${campaña.jobId}: ${err.message}`);
            }
        }

        await this.prisma.contacto.deleteMany({ where: { campañaId: campaña.id } });

        await this.prisma.campaña.update({
            where: { id: campaña.id },
            data: { archivada: true },
        });

        return { message: 'Campaña eliminada con contactos. Reportes conservados.' };
    }
}