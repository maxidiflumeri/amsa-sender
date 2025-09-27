// src/scheduler/scheduler.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, RepeatOptions, RepeatableJob } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue('reportesEmail') private readonly reportesQueue: Queue,
    ) { }

    async onModuleInit() {
        await this.syncAll();
    }

    /**
     * Sincroniza TODAS las tareas habilitadas con la cola repeatable.
     */
    async syncAll() {
        const tareas = await this.prisma.tareaProgramada.findMany({
            where: { habilitada: true, tipo: 'REPORTE_EMAIL_DIARIO' },
        });

        const existentes = await this.reportesQueue.getRepeatableJobs();

        // Remover repeatables que ya no existan en BD
        await Promise.all(
            existentes.map(async (rj) => {
                const id = Number(rj.id?.replace('tarea:', ''));
                const sigue = tareas.find((t) => t.id === id);
                if (!sigue) {
                    await this.reportesQueue.removeRepeatableByKey(rj.key);
                }
            }),
        );

        // Registrar/actualizar repeatables existentes
        for (const t of tareas) {
            await this.addOrReplaceRepeatable(t.id, t.expresionCron, t.zonaHoraria);
            this.logger.log(`Programada "${t.nombre}" (${t.id}) -> ${t.expresionCron} [${t.zonaHoraria}]`);
        }
    }

    /**
     * Actualiza SOLO la tarea indicada (se usa desde el CRUD).
     */
    async upsertRepeatable(tareaId: number) {
        const t = await this.prisma.tareaProgramada.findUnique({ where: { id: tareaId } });
        if (!t) return;

        // Si está deshabilitada, borrar su repeatable y salir
        if (!t.habilitada) {
            await this.removeRepeatablesByTaskId(tareaId);
            this.logger.log(`Desprogramada tarea (${tareaId}) por estar deshabilitada.`);
            return;
        }

        await this.addOrReplaceRepeatable(t.id, t.expresionCron, t.zonaHoraria);
        this.logger.log(`Reprogramada tarea (${t.id}) -> ${t.expresionCron} [${t.zonaHoraria}]`);
    }

    /**
     * Encola ejecución inmediata (manual) sin tocar el repeatable.
     */
    async enqueueNow(tareaId: number) {
        return this.reportesQueue.add(
            'reportesEmail',
            { tareaId },
            { jobId: `manual:${tareaId}` },
        );
    }

    // ----------------- Helpers privados -----------------

    private async addOrReplaceRepeatable(id: number, cron: string, tz?: string) {
        await this.removeRepeatablesByTaskId(id); // limpiamos claves viejas por si cambió el cron/tz

        const repeat: RepeatOptions = {
            pattern: cron,
            tz: tz || 'America/Argentina/Buenos_Aires',
        };

        await this.reportesQueue.add(
            'reportesEmail',
            { tareaId: id },
            {
                jobId: `tarea:${id}`, // identificador estable
                repeat,
            },
        );
    }

    private async removeRepeatablesByTaskId(id: number) {
        const existentes: RepeatableJob[] = await this.reportesQueue.getRepeatableJobs();
        await Promise.all(
            existentes
                .filter((rj) => (rj.id?.replace('tarea:', '') ?? '') === String(id))
                .map((rj) => this.reportesQueue.removeRepeatableByKey(rj.key)),
        );
    }
}