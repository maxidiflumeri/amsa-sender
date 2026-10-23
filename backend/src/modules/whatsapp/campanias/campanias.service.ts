import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseCsv } from './utils/csv-parser';
import * as fs from 'fs/promises';
import { Prisma } from '@prisma/client';
import * as Handlebars from 'handlebars';
import { AgendarCampañaDto } from './dtos/agendar-campaña.dto';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { DeudoresService } from 'src/modules/deudores/deudores.service';

@Injectable()
export class CampaniasService {
    private readonly logger = new Logger(CampaniasService.name);

    constructor(
        private prisma: PrismaService,
        @InjectQueue('colaEnvios') private readonly colaEnvios: Queue,
        private deudoresService: DeudoresService,
    ) { }

    async procesarCsv(filePath: string, nombreCampaña: string) {
        try {
            const contactos = await parseCsv(filePath);
            this.logger.log(`📄 CSV parseado: ${contactos.length} contactos`);

            const campaña = await this.prisma.campaña.create({
                data: { nombre: nombreCampaña, createdAt: new Date() },
            });
            this.logger.log(`📦 Campaña creada con ID: ${campaña.id} (${nombreCampaña})`);

            for (const c of contactos) {
                const deudor = await this.deudoresService.upsertDesdeImport(c.rawRow);
                await this.prisma.contacto.create({
                    data: {
                        numero: c.numero,
                        mensaje: c.mensaje,
                        datos: c.datos,
                        campañaId: campaña.id,
                        deudorId: deudor?.id ?? null,
                    },
                });
            }

            await fs.unlink(filePath);
            this.logger.log(`🧹 Archivo CSV eliminado: ${filePath}`);

            return {
                total: contactos.length,
                campaña: nombreCampaña,
            };
        } catch (err) {
            this.logger.error(`❌ Error procesando CSV: ${err.message}`, err.stack);
            await fs.unlink(filePath).catch(() => { });
            throw new InternalServerErrorException('Error al procesar el archivo CSV.');
        }
    }

    async obtenerCampañas() {
        this.logger.log('🔍 Buscando campañas activas...');
        return this.prisma.campaña.findMany({
            where: { archivada: false },
            include: { contactos: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Las campañas que están enviando o en pausa, livianas: sin contactos, con cuántos tiene y cuántos ya se intentaron
     * (los reportes). Las pide el Inicio cada minuto; `obtenerCampañas` trae todas con todos sus contactos.
     */
    async obtenerCampañasEnCurso() {
        return this.prisma.campaña.findMany({
            where: { archivada: false, estado: { in: ['procesando', 'pausada', 'pausa_pendiente'] } },
            select: {
                id: true,
                nombre: true,
                estado: true,
                createdAt: true,
                enviadoAt: true,
                _count: { select: { contactos: true, reportes: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async obtenerCampañaPorId(id: number) {
        this.logger.log(`🔍 Buscando campaña por ID: ${id}`);
        return this.prisma.campaña.findUnique({ where: { id } });
    }

    async obtenerPrimerContacto(campañaId: number) {
        this.logger.log(`🔍 Obteniendo primer contacto con datos para campaña ${campañaId}`);
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

        if (!contacto) {
            this.logger.warn(`⚠️ No se encontró contacto con datos para campaña ${campañaId}`);
            throw new NotFoundException('No se encontró un contacto con datos');
        }

        return contacto;
    }

    async obtenerVariables(campañaId: number) {
        this.logger.log(`📊 Obteniendo variables usadas en campaña ${campañaId}`);
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

        this.logger.debug(`🔡 Variables encontradas: ${Array.from(variablesSet).join(', ')}`);
        return Array.from(variablesSet);
    }

    async aplicarTemplate(campañaId: number, templateId: number) {
        this.logger.log(`📝 Aplicando template ${templateId} a campaña ${campañaId}`);
        const template = await this.prisma.template.findUnique({ where: { id: templateId } });
        if (!template) {
            this.logger.warn(`⚠️ Template ${templateId} no encontrado`);
            throw new NotFoundException('Template no encontrado');
        }

        const campaña = await this.prisma.campaña.findUnique({
            where: { id: campañaId },
            include: { contactos: true },
        });

        if (!campaña) {
            this.logger.warn(`⚠️ Campaña ${campañaId} no encontrada`);
            throw new NotFoundException('Campaña no encontrada');
        }

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

        this.logger.log(`✅ Template ${templateId} aplicado a ${updates.length} contactos`);
        return { mensaje: 'Template aplicado correctamente a los contactos' };
    }

    async agendarCampaña(id: number, dto: AgendarCampañaDto) {
        const delay = Math.max(new Date(dto.fechaAgenda).getTime() - Date.now(), 0);
        this.logger.log(`⏱️ Agendando campaña ${id} para ${dto.fechaAgenda} (delay: ${delay} ms)`);

        const job = await this.colaEnvios.add(
            'enviar',
            {
                sessionIds: dto.sessionIds,
                campaña: id,
                config: dto.config,
            },
            { delay },
        );

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

        this.logger.log(`📨 Campaña ${id} agendada como job ${job.id}`);
        return { ok: true, message: 'Campaña agendada correctamente' };
    }

    async pausarCampaña(id: number) {
        this.logger.log(`⏸️ Solicitando pausa de campaña ${id}`);
        const campaña = await this.prisma.campaña.findUnique({
            where: { id },
            select: { estado: true },
        });

        if (!campaña) {
            this.logger.warn(`⚠️ Campaña ${id} no encontrada`);
            throw new NotFoundException('Campaña no encontrada');
        }

        // Pausar dos veces no cambia nada. Antes la segunda pausa la pasaba a 'pausa_pendiente': si el envío ya se había
        // detenido nadie la sacaba de ahí (solo un job que arranca la convierte en 'pausada') y quedaba trabada; si
        // seguía enviando, el worker no la tomaba como pausa y mandaba todo igual.
        if (campaña.estado === 'pausada' || campaña.estado === 'pausa_pendiente') {
            this.logger.log(`ℹ️ Campaña ${id} ya estaba en pausa (${campaña.estado})`);
            return { message: 'La campaña ya estaba en pausa' };
        }

        // 'pausa_pendiente' es solo para una agendada: su job todavía no arrancó y la pasa a 'pausada' cuando arranca.
        const nuevoEstado =
            campaña.estado === 'procesando' ? 'pausada' : campaña.estado === 'programada' ? 'pausa_pendiente' : null;
        if (!nuevoEstado) {
            this.logger.warn(`⚠️ No se puede pausar campaña ${id} - Estado actual: ${campaña.estado}`);
            throw new BadRequestException('La campaña no está enviando: no hay nada que pausar.');
        }

        await this.prisma.campaña.update({
            where: { id },
            data: { estado: nuevoEstado },
        });

        this.logger.log(`✅ Campaña ${id} actualizada a estado: ${nuevoEstado}`);
        return { message: `Campaña marcada como ${nuevoEstado} correctamente` };
    }

    /**
     * Reanuda una campaña en pausa. `sessionIdsElegidas` reemplaza las sesiones con las que salió: una línea que se
     * desconecta vuelve con otro id de sesión, y sin esto la campaña no se podía seguir enviando.
     */
    async reanudarCampaña(id: number, sessionIdsElegidas?: unknown) {
        if (sessionIdsElegidas !== undefined
            && (!Array.isArray(sessionIdsElegidas) || !sessionIdsElegidas.every((s) => typeof s === 'string' && s))) {
            throw new BadRequestException('sessionIds tiene que ser una lista de sesiones');
        }
        const elegidas = (sessionIdsElegidas as string[] | undefined) ?? [];
        this.logger.log(`▶️ Solicitando reanudación de campaña ${id}${elegidas.length ? ` con sesiones ${JSON.stringify(elegidas)}` : ''}`);
        const campaña = await this.prisma.campaña.findUnique({ where: { id } });

        if (!campaña || !['pausada', 'pausa_pendiente'].includes(campaña.estado)) {
            this.logger.warn(`⚠️ No se puede reanudar campaña ${id} - Estado actual: ${campaña?.estado}`);
            throw new BadRequestException('Campaña no válida o no pausada');
        }

        // Si la pausa llegó antes de que arrancara su job (agendada, o esperando turno en la cola), ese job sigue ahí:
        // alcanza con devolverle el estado. Encolar otro mandaría la campaña dos veces.
        const enCola = await this.jobSinArrancar(id);
        if (enCola) {
            const estado = enCola === 'delayed' ? 'programada' : 'procesando';
            await this.prisma.campaña.update({ where: { id }, data: { estado, pausada: false } });
            this.logger.log(`✅ Campaña ${id} reanudada: su job seguía en la cola (${enCola}), vuelve a ${estado}`);
            return { ok: true };
        }

        const sessionIds: string[] = elegidas.length ? elegidas : JSON.parse(campaña.sesiones || '[]');
        const config = campaña.config;

        if (!sessionIds.length || !config) {
            this.logger.warn(`⚠️ Faltan datos para reanudar campaña ${id}`);
            throw new BadRequestException('Faltan datos para reanudar la campaña');
        }

        // Con sesiones caídas el envío falla contacto por contacto y los deja como fallidos: se sigue solo con las
        // conectadas y, si no queda ninguna, se le pide al usuario que elija con cuál.
        const conectadas = await this.prisma.sesion.findMany({
            where: { sessionId: { in: sessionIds }, estado: 'conectado' },
            select: { sessionId: true },
        });
        const usar = sessionIds.filter((s) => conectadas.some((c) => c.sessionId === s));
        if (!usar.length) {
            this.logger.warn(`⚠️ Campaña ${id} sin sesiones conectadas para reanudar: ${JSON.stringify(sessionIds)}`);
            throw new BadRequestException({
                message: 'La línea con la que salió esta campaña ya no está conectada. Elegí con cuál seguir.',
                codigo: 'SIN_SESIONES_CONECTADAS',
            });
        }

        await this.colaEnvios.add('enviar', { sessionIds: usar, campaña: id, config });

        await this.prisma.campaña.update({
            where: { id },
            data: { estado: 'procesando', pausada: false, sesiones: JSON.stringify(usar) },
        });

        this.logger.log(`✅ Campaña ${id} reanudada con ${usar.length} sesión(es)`);
        return { ok: true };
    }

    /** Si la campaña tiene un job que todavía no arrancó: 'delayed' (agendado) o 'waiting' (esperando turno). */
    private async jobSinArrancar(id: number): Promise<'delayed' | 'waiting' | null> {
        try {
            for (const tipo of ['delayed', 'waiting'] as const) {
                const jobs = await this.colaEnvios.getJobs([tipo]);
                if (jobs.some((j) => Number(j?.data?.campaña) === id)) return tipo;
            }
        } catch (e) {
            this.logger.warn(`⚠️ No se pudo revisar la cola para la campaña ${id}: ${e.message}`);
        }
        return null;
    }

    async forzarCierre(id: number, nuevoEstado: 'finalizada' | 'error') {
        this.logger.log(`🔧 Forzando cierre de campaña WA ${id} → ${nuevoEstado}`);
        const campaña = await this.prisma.campaña.findUnique({ where: { id }, select: { id: true, jobId: true } });
        if (!campaña) throw new NotFoundException('Campaña no encontrada');

        if (campaña.jobId) {
            try {
                const job: Job | undefined = await this.colaEnvios.getJob(campaña.jobId);
                if (job) {
                    const state = await job.getState();
                    if (['waiting', 'delayed', 'active'].includes(state)) await job.remove();
                }
            } catch (e) {
                this.logger.warn(`⚠️ No se pudo cancelar job ${campaña.jobId}: ${e.message}`);
            }
        }

        await this.prisma.campaña.update({ where: { id }, data: { estado: nuevoEstado } });
        return { ok: true };
    }

    async eliminarCampaña(id: number) {
        this.logger.log(`🗑️ Eliminando campaña ${id}`);
        const campaña = await this.prisma.campaña.findUnique({ where: { id } });

        if (!campaña) throw new NotFoundException('Campaña no encontrada');
        if (campaña.estado === 'procesando') {
            this.logger.warn(`❌ No se puede eliminar campaña ${id} porque está procesando`);
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
                this.logger.warn(`⚠️ No se pudo eliminar el job ${campaña.jobId}: ${err.message}`);
            }
        }

        await this.prisma.contacto.deleteMany({ where: { campañaId: campaña.id } });
        await this.prisma.campaña.update({
            where: { id: campaña.id },
            data: { archivada: true },
        });

        this.logger.log(`✅ Campaña ${id} archivada y contactos eliminados`);
        return { message: 'Campaña eliminada con contactos. Reportes conservados.' };
    }
}  