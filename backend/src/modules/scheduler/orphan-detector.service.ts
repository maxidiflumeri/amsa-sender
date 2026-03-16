import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

@Injectable()
export class OrphanDetectorService implements OnModuleInit {
    private readonly logger = new Logger(OrphanDetectorService.name);

    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue('colaEnvios') private readonly colaWa: Queue,
        @InjectQueue('emailsEnvios') private readonly colaEmail: Queue,
    ) { }

    onModuleInit() {
        // Primera verificación al iniciar (con delay para que la app esté lista)
        setTimeout(() => this.verificarHuerfanas(), 30_000);
        setInterval(() => this.verificarHuerfanas(), CHECK_INTERVAL_MS);
        this.logger.log('🔍 OrphanDetector iniciado — verificando cada 5 minutos.');
    }

    async verificarHuerfanas() {
        await Promise.allSettled([
            this.verificarCampañasWA(),
            this.verificarCampañasEmail(),
        ]);
    }

    private async verificarCampañasWA() {
        try {
            const procesando = await this.prisma.campaña.findMany({
                where: { estado: 'procesando' },
                select: { id: true, jobId: true },
            });
            if (!procesando.length) return;

            const activosIds = await this.getJobIdsActivos(this.colaWa);

            for (const c of procesando) {
                const esHuerfana = c.jobId
                    ? !activosIds.has(c.jobId)
                    : !(await this.hayJobActivoConDato(this.colaWa, 'campaña', c.id));

                if (esHuerfana) {
                    await this.prisma.campaña.update({ where: { id: c.id }, data: { estado: 'error' } });
                    this.logger.warn(`⚠️ Campaña WA ${c.id} marcada como "error" (job huérfano detectado).`);
                }
            }
        } catch (e) {
            this.logger.error(`❌ Error verificando huérfanas WA: ${e.message}`);
        }
    }

    private async verificarCampañasEmail() {
        try {
            const procesando = await this.prisma.campañaEmail.findMany({
                where: { estado: 'procesando' },
                select: { id: true, jobId: true },
            });
            if (!procesando.length) return;

            const activosIds = await this.getJobIdsActivos(this.colaEmail);

            for (const c of procesando) {
                const esHuerfana = c.jobId
                    ? !activosIds.has(c.jobId)
                    : !(await this.hayJobActivoConDato(this.colaEmail, 'idCampania', c.id));

                if (esHuerfana) {
                    await this.prisma.campañaEmail.update({ where: { id: c.id }, data: { estado: 'error' } });
                    this.logger.warn(`⚠️ Campaña email ${c.id} marcada como "error" (job huérfano detectado).`);
                }
            }
        } catch (e) {
            this.logger.error(`❌ Error verificando huérfanas email: ${e.message}`);
        }
    }

    /** Devuelve el Set de IDs de jobs activos/en espera/delayed de una cola */
    private async getJobIdsActivos(queue: Queue): Promise<Set<string>> {
        const jobs = await queue.getJobs(['active', 'waiting', 'delayed']);
        return new Set(jobs.map(j => j.id).filter(Boolean) as string[]);
    }

    /** Para campañas sin jobId, verifica si hay algún job activo cuyo data[campo] === valor */
    private async hayJobActivoConDato(queue: Queue, campo: string, valor: number): Promise<boolean> {
        const jobs = await queue.getJobs(['active']);
        return jobs.some(j => j.data?.[campo] === valor);
    }
}
