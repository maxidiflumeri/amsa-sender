import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { delay, Worker } from 'bullmq';
import { connection } from 'src/queues/bullmq.config';
import { Job } from 'bullmq';
import { RedisClientType } from 'redis';
import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WhatsappWorkerService implements OnModuleInit {
    private readonly logger = new Logger(WhatsappWorkerService.name);
    private pendientes = new Map<string, (data: any) => void>();

    constructor(
        private prisma: PrismaService,
        @Inject('REDIS_CLIENT') private redis: RedisClientType,
        @Inject('REDIS_SUB') private redisSub: RedisClientType,
    ) { }

    async onModuleInit() {
        const worker = new Worker('colaEnvios', this.procesarJob.bind(this), {
            connection,
        });

        worker.on('failed', (job, err) => {
            this.logger.error(`❌ Job ${job?.id ?? 'unknown'} falló: ${err.message}`);
        });

        this.logger.log('👷 Worker iniciado y escuchando jobs...');

        await this.redisSub.subscribe('respuesta-envio', (message: string) => {
            try {
                const data = JSON.parse(message);
                const { messageId } = data;

                if (this.pendientes.has(messageId)) {
                    const resolver = this.pendientes.get(messageId);
                    resolver?.(data);
                    this.pendientes.delete(messageId);
                }
            } catch (err) {
                this.logger.error('❌ Error parseando mensaje de respuesta-envio:', err.message);
            }
        });

        this.logger.log('📡 Suscripción a canal "respuesta-envio" activa.');
    }

    async procesarJob(job: Job) {
        const { sessionIds, campaña, config } = job.data;
        const { batchSize, delayEntreMensajes, delayEntreLotes } = config;

        const estado = await this.prisma.campaña.findUnique({ where: { id: campaña } });
        if (!estado) throw new Error('Campaña no encontrada');

        if (estado.estado === 'pausa_pendiente') {
            await this.prisma.campaña.update({ where: { id: campaña }, data: { estado: 'pausada' } });
            await this.redis.publish('campania-pausada', JSON.stringify({ campañaId: campaña }));
            this.logger.warn(`⏸️ Campaña ${campaña} pausada antes de iniciar.`);
            return;
        }

        if (estado.estado === 'programada') {
            await this.prisma.campaña.update({ where: { id: campaña }, data: { estado: 'procesando' } });
            await this.redis.publish('campania-estado', JSON.stringify({ campaña, estado: 'procesando' }));
            this.logger.log(`▶️ Campaña ${campaña} marcada como procesando.`);
        }

        const enviadosPrevios = await this.prisma.reporte.findMany({
            where: { campañaId: campaña },
            select: { numero: true },
        });
        const yaEnviados = new Set(enviadosPrevios.map(r => r.numero));

        const contactos = await this.prisma.contacto.findMany({
            where: { campañaId: campaña, numero: { notIn: Array.from(yaEnviados) } },
            orderBy: { id: 'asc' },
        });

        const total = contactos.length;
        let enviados = 0;

        this.logger.log(`📦 Campaña ${campaña}: ${total} contactos a enviar con ${sessionIds.length} sesiones.`);

        const porSesion: Record<string, typeof contactos> = {};
        sessionIds.forEach(id => porSesion[id] = []);
        contactos.forEach((c, i) => {
            const sid = sessionIds[i % sessionIds.length];
            porSesion[sid].push(c);
        });

        for (const sessionId of sessionIds) {
            const contactosSesion = porSesion[sessionId];

            for (let i = 0; i < contactosSesion.length; i += batchSize) {
                const lote = contactosSesion.slice(i, i + batchSize);

                for (const contacto of lote) {
                    const estadoActual = await this.prisma.campaña.findUnique({ where: { id: campaña } });
                    if (estadoActual?.estado === 'pausada') {
                        this.logger.warn(`⏸️ Campaña ${campaña} pausada manualmente. Deteniendo envío.`);
                        await this.redis.publish('campania-pausada', JSON.stringify({ campañaId: campaña }));
                        return;
                    }

                    const messageId = uuidv4();

                    await this.redis.publish('solicitar-sesion', JSON.stringify({
                        sessionId,
                        numero: contacto.numero,
                        mensaje: contacto.mensaje,
                        messageId,
                    }));

                    const respuesta = await this.esperarRespuesta(messageId);

                    if (respuesta.estado === 'enviado') {
                        enviados++;

                        await this.redis.publish('progreso-envio', JSON.stringify({
                            campañaId: campaña,
                            enviados,
                            total,
                        }));

                        const sesion = await this.prisma.sesion.findUnique({
                            where: { sessionId },
                            select: { ani: true },
                        });

                        await this.prisma.reporte.create({
                            data: {
                                numero: contacto.numero,
                                estado: 'enviado',
                                mensaje: contacto.mensaje,
                                campañaId: campaña,
                                enviadoAt: new Date(),
                                aniEnvio: sesion?.ani || null,
                                datos: contacto.datos || undefined,
                            },
                        });

                        await this.prisma.mensaje.create({
                            data: {
                                numero: contacto.numero,
                                campañaId: campaña,
                                ani: sesion?.ani || '',
                                mensaje: contacto.mensaje || '',
                                fromMe: true,
                                fecha: new Date(),
                                tipo: 'texto',
                            },
                        });

                        this.logger.log(`✅ [${sessionId}] Mensaje enviado a ${contacto.numero}`);
                    } else {
                        await this.prisma.reporte.create({
                            data: {
                                numero: contacto.numero,
                                estado: 'fallo',
                                mensaje: contacto.mensaje,
                                campañaId: campaña,
                                enviadoAt: new Date(),
                                datos: contacto.datos || undefined,
                            },
                        });

                        this.logger.warn(`⚠️ [${sessionId}] Fallo al enviar a ${contacto.numero}: ${respuesta.error || 'desconocido'}`);
                    }

                    await delay(delayEntreMensajes);
                }

                await delay(delayEntreLotes);
            }
        }

        const estadoFinal = await this.prisma.campaña.findUnique({ where: { id: campaña } });

        if (estadoFinal?.estado === 'pausada') {
            this.logger.warn(`⏸️ Campaña ${campaña} fue pausada durante el envío. No se finaliza.`);
            return;
        }

        if (enviados === 0) {
            await this.prisma.campaña.update({
                where: { id: campaña },
                data: { estado: 'pendiente' },
            });
            this.logger.warn(`🔁 Campaña ${campaña} no pudo ser enviada. Estado: pendiente.`);
        } else {
            await this.prisma.campaña.update({
                where: { id: campaña },
                data: { estado: 'finalizada', enviadoAt: new Date() },
            });
            await this.redis.publish('campania-finalizada', JSON.stringify({ campañaId: campaña }));
            this.logger.log(`🏁 Campaña ${campaña} finalizada con ${enviados} enviados.`);
        }
    }

    private esperarRespuesta(messageId: string, timeout = 8000): Promise<any> {
        return new Promise((resolve) => {
            this.pendientes.set(messageId, resolve);

            setTimeout(() => {
                if (this.pendientes.has(messageId)) {
                    this.logger.warn(`⚠️ Timeout esperando respuesta para messageId ${messageId}`);
                    this.pendientes.delete(messageId);
                    resolve({ estado: 'timeout' });
                }
            }, timeout);
        });
    }
}