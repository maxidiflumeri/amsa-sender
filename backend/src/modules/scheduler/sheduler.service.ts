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

    async addOrReplaceRepeatable(id: number, cron: string, tz?: string) {
        const name = this.jobNameFor('REPORTE_EMAIL_DIARIO');
        // limpia cualquier schedule previo de esa tarea
        await this.removeRepeatablesByTaskId(id);

        await this.reportesQueue.add(
            name,
            { tareaId: id },
            { repeat: { pattern: cron, tz, jobId: String(id) } }
        );
    }

    private jobNameFor(tipo: string) {
        // ajustá según tu mapping real
        return 'reportesEmail';
    }

    async removeRepeatablesByTaskId(tareaId: number) {
        const name = this.jobNameFor(/* tipo si lo necesitás */ 'REPORTE_EMAIL_DIARIO');
        const id = String(tareaId);

        // A) borrar SCHEDULES (la forma correcta)
        const reps = await this.reportesQueue.getRepeatableJobs();
        for (const r of reps) {
            if (r.name === name && r.id === id) {
                await this.reportesQueue.removeRepeatableByKey(r.key);
            }
        }

        // B) limpiar pendings, evitando instancias repeat:
        const pendings = await this.reportesQueue.getJobs(['wait', 'delayed']);
        for (const j of pendings) {
            if (j.name !== name) continue;
            if (j?.data?.tareaId !== tareaId) continue;

            // ⚠️ NO intentes borrar instancias repeat
            if (typeof j.id === 'string' && j.id.startsWith('repeat:')) {
                this.logger.debug(`[Scheduler] Omito eliminar instancia repeat ${j.id} (tarea ${tareaId})`);
                continue;
            }

            try {
                await j.remove();
            } catch (e: any) {
                // si justo BullMQ te avisa que pertenece al scheduler, lo ignorás
                if (!/belongs to a job scheduler/.test(e?.message)) throw e;
                this.logger.debug(`[Scheduler] Omito ${j.id}: ${e.message}`);
            }
        }
    }
}