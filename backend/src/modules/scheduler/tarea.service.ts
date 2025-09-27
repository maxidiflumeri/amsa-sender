// src/scheduler/tareas.service.ts
import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { SchedulerService } from './sheduler.service';

@Injectable()
export class TareasService {
    private readonly logger = new Logger(TareasService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly scheduler: SchedulerService,
        @InjectQueue('reportesEmail') private readonly reportesQueue: Queue,
    ) { }

    listar() {
        return this.prisma.tareaProgramada.findMany({ orderBy: { id: 'desc' } });
    }

    async crear(dto: any) {
        const t = await this.prisma.tareaProgramada.create({
            data: {
                ...dto,
                destinatarios: dto.destinatarios,
                configuracion: dto.configuracion ?? {},
            },
        });
        await this.scheduler.upsertRepeatable(t.id);
        return t;
    }

    async actualizar(id: number, dto: any) {
        try {
            const t = await this.prisma.tareaProgramada.update({
                where: { id },
                data: {
                    ...dto,
                    ...(dto.destinatarios ? { destinatarios: dto.destinatarios } : {}),
                    ...(dto.configuracion ? { configuracion: dto.configuracion } : {}),
                },
            });
            await this.scheduler.upsertRepeatable(t.id);
            return t;
        } catch (error) {
            this.logger.error(`Error al actualizar tarea: ${error.message}`);
            throw new InternalServerErrorException(`Error al actualizar tarea: ${error.message}`);
        }
    }

    async alternar(id: number) {
        try {
            const t = await this.prisma.tareaProgramada.findUnique({ where: { id } });
            const updated = await this.prisma.tareaProgramada.update({
                where: { id },
                data: { habilitada: !t!!.habilitada },
            });
            await this.scheduler.upsertRepeatable(updated.id);
            return updated;
        } catch (error) {
            this.logger.error(`Error al pausar/reanudar tarea: ${error.message}`);
            throw new InternalServerErrorException(`Error al pausar/reanudar tarea: ${error.message}`);
        }
    }

    async ejecutarAhora(id: number) {
        const t = await this.prisma.tareaProgramada.findUnique({ where: { id } });
        return this.reportesQueue.add(
            'reportesEmail',
            { tareaId: t!!.id, force: true },
            {
                jobId: `manual:${t!!.id}:${Date.now()}`,    // 👈 id único (evita dedupe)
                removeOnComplete: 50,                      // limpia para que puedas volver a ejecutar
                removeOnFail: 100,
                priority: 1,
                delay: 0,
            }
        );
    }

    ejecuciones(id: number) {
        return this.prisma.ejecucionTarea.findMany({
            where: { tareaId: id },
            orderBy: { id: 'desc' },
            take: 100,
        });
    }

    async eliminarTarea(id: number) {
        const t = await this.prisma.tareaProgramada.findUnique({ where: { id } });
        if (!t) {
            throw new NotFoundException('Tarea no encontrada');
        }

        if (t.habilitada) {
            await this.alternar(id)
        }
        return await this.prisma.tareaProgramada.delete({ where: { id } });
    }
}