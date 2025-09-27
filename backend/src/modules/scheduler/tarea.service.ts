// src/scheduler/tareas.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { SchedulerService } from './sheduler.service';

@Injectable()
export class TareasService {
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
    }

    async alternar(id: number) {
        const t = await this.prisma.tareaProgramada.findUnique({ where: { id } });
        const updated = await this.prisma.tareaProgramada.update({
            where: { id },
            data: { habilitada: t!!.habilitada },
        });
        await this.scheduler.upsertRepeatable(updated.id);
        return updated;
    }

    async ejecutarAhora(id: number) {
        const t = await this.prisma.tareaProgramada.findUnique({ where: { id } });
        return this.reportesQueue.add(
            'reportesEmail',
            { tareaId: t!!.id },
            { jobId: `manual:${t!!.id}` },
        );
    }

    ejecuciones(id: number) {
        return this.prisma.ejecucionTarea.findMany({
            where: { tareaId: id },
            orderBy: { id: 'desc' },
            take: 100,
        });
    }
}