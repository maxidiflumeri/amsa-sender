import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { delay, Worker, Job } from 'bullmq';
import { connection } from 'src/queues/bullmq.config';
import { RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { waitForLocks, releaseLock, renewLock } from 'src/common/redis-lock.utils';

@Injectable()
export class WhatsappWorkerService implements OnModuleInit {
    private readonly logger = new Logger(WhatsappWorkerService.name);
    private pendientes = new Map<string, (data: any) => void>();

    /** Timeout máximo para esperar reconexión de Redis (ms) */
    private readonly REDIS_RECONNECT_TIMEOUT = 120_000; // 2 minutos

    constructor(
        private prisma: PrismaService,
        @Inject('REDIS_CLIENT') private redis: RedisClientType,
        @Inject('REDIS_SUB') private redisSub: RedisClientType,
    ) { }

    async onModuleInit() {
        const worker = new Worker('colaEnvios', this.procesarJob.bind(this), {
            connection,
            concurrency: Number(process.env.WHATSAPP_CONCURRENCY || 5),
        });

        worker.on('failed', async (job, err) => {
            this.logger.error(`❌ Job ${job?.id ?? 'unknown'} falló: ${err.message}`);
            const campañaId = job?.data?.campaña;
            if (campañaId) {
                try {
                    await this.prisma.campaña.update({
                        where: { id: campañaId },
                        data: { estado: 'error' },
                    });
                    this.logger.warn(`⚠️ Campaña WA ${campañaId} marcada como "error" por fallo del job.`);
                    await this.safePublish('campania-error', JSON.stringify({ campañaId, tipo: 'whatsapp' }));
                } catch (e) {
                    this.logger.error(`❌ No se pudo marcar campaña WA ${campañaId} como error: ${e.message}`);
                }
            }
        });

        // Capturar errores de conexión del Worker (BullMQ/ioredis)
        worker.on('error', (err) => {
            this.logger.error(`❌ Worker connection error: ${err.message}`);
        });

        this.logger.log(`👷 Worker de WhatsApp iniciado (concurrencia: ${process.env.WHATSAPP_CONCURRENCY || 5}) y escuchando jobs en "colaEnvios"...`);

        // Suscripción inicial
        await this.subscribirARespuestas();

        // Re-suscribir cuando el cliente SUB se reconecte
        this.redisSub.on('ready', async () => {
            this.logger.log('🔄 Redis SUB reconectado. Re-suscribiendo a "respuesta-envio"...');
            try {
                await this.subscribirARespuestas();
            } catch (err) {
                this.logger.error(`❌ Error re-suscribiendo a "respuesta-envio": ${err.message}`);
            }
        });

        this.logger.log('📡 Suscripción a canal Redis "respuesta-envio" activa.');
    }

    /**
     * Suscribe al canal "respuesta-envio" para recibir respuestas de envío.
     */
    private async subscribirARespuestas() {
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
                this.logger.error(`❌ Error parseando mensaje de "respuesta-envio": ${err.message}`);
            }
        });
    }

    async procesarJob(job: Job) {
        const { sessionIds, campaña, config } = job.data;
        const { batchSize, delayEntreMensajes, delayEntreLotes } = config;

        this.logger.log(`📨 [Job ${job.id}] Iniciando campaña ${campaña}. Solicitando locks para ${sessionIds.length} sesiones...`);

        // 1. Adquirir locks para las sesiones (espera activa si están ocupadas)
        const SESSION_LOCK_TTL = 300;
        const lockKeys = sessionIds.map((sid: string) => `wa_session_lock:${sid}`);

        await waitForLocks(this.redis, lockKeys, SESSION_LOCK_TTL);
        this.logger.log(`🔒 [Job ${job.id}] Locks adquiridos para campaña ${campaña}. Procesando...`);

        // Intervalo para renovar locks (heartbeat) cada 60s
        const renewalInterval = setInterval(async () => {
            for (const key of lockKeys) {
                await renewLock(this.redis, key, SESSION_LOCK_TTL);
            }
        }, 60000);

        try {
            const estado = await this.prisma.campaña.findUnique({ where: { id: campaña } });
            if (!estado) throw new Error('Campaña no encontrada');

            if (estado.estado === 'pausa_pendiente') {
                await this.prisma.campaña.update({ where: { id: campaña }, data: { estado: 'pausada' } });
                await this.safePublish('campania-pausada', JSON.stringify({ campañaId: campaña }));
                await this.publicarLog(campaña, 'warn', '⏸️ Campaña pausada antes de iniciar.');
                this.logger.warn(`⏸️ Campaña ${campaña} pausada antes de iniciar.`);
                return;
            }

            if (estado.estado === 'programada' || estado.estado === 'pendiente') {
                await this.prisma.campaña.update({ where: { id: campaña }, data: { estado: 'procesando' } });
                await this.safePublish('campania-estado', JSON.stringify({ campaña, estado: 'procesando' }));
                this.logger.log(`▶️ Campaña ${campaña} marcada como "procesando".`);
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

            this.logger.log(`📦 ${total} contactos a enviar para campaña ${campaña}.`);
            // Limpiar logs anteriores de este run
            try { await this.redis.del(`campania-wa-logs:${campaña}`); } catch {}
            await this.publicarLog(campaña, 'info', `▶️ Iniciando: ${total} contactos en ${sessionIds.length} sesión(es)`);

            const porSesion: Record<string, typeof contactos> = {};
            sessionIds.forEach((id: string) => porSesion[id] = []);
            contactos.forEach((c, i) => {
                const sid = sessionIds[i % sessionIds.length];
                porSesion[sid].push(c);
            });

            for (const sessionId of sessionIds) {
                const contactosSesion = porSesion[sessionId];

                for (let i = 0; i < contactosSesion.length; i += batchSize) {
                    const lote = contactosSesion.slice(i, i + batchSize);

                    for (const contacto of lote) {
                        // Verificar que Redis esté listo antes de cada envío
                        await this.waitForRedisReady(campaña);

                        const estadoActual = await this.prisma.campaña.findUnique({ where: { id: campaña } });
                        if (estadoActual?.estado === 'pausada') {
                            this.logger.warn(`⏸️ Campaña ${campaña} pausada manualmente. Deteniendo envío.`);
                            await this.safePublish('campania-pausada', JSON.stringify({ campañaId: campaña }));
                            await this.publicarLog(campaña, 'warn', `⏸️ Campaña pausada manualmente. Enviados hasta ahora: ${enviados}/${total}`);
                            return; // Sale del try, va al finally
                        }

                        const messageId = uuidv4();

                        await this.safePublish('solicitar-sesion', JSON.stringify({
                            sessionId,
                            numero: contacto.numero,
                            mensaje: contacto.mensaje,
                            messageId,
                        }));

                        const respuesta = await this.esperarRespuesta(messageId);

                        if (respuesta.estado === 'enviado') {
                            enviados++;

                            await this.safePublish('progreso-envio', JSON.stringify({
                                campañaId: campaña,
                                enviados,
                                total,
                            }));
                            await this.publicarLog(campaña, 'ok', `✅ Enviado a ${contacto.numero}  (sesión: ${sessionId})`);

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

                            this.logger.log(`✅ [${sessionId}] Enviado a ${contacto.numero}`);
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

                            const motivo = respuesta.error || respuesta.estado || 'desconocido';
                            await this.publicarLog(campaña, 'warn', `⚠️ Fallo: ${contacto.numero} — ${motivo}  (sesión: ${sessionId})`);
                            this.logger.warn(`⚠️ [${sessionId}] Fallo al enviar a ${contacto.numero}: ${motivo}`);
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
                await this.publicarLog(campaña, 'warn', '⚠️ Sin mensajes enviados. Campaña marcada como pendiente.');
                this.logger.warn(`🔁 Campaña ${campaña} sin mensajes enviados. Se marca como pendiente.`);
            } else {
                await this.prisma.campaña.update({
                    where: { id: campaña },
                    data: { estado: 'finalizada', enviadoAt: new Date() },
                });
                await this.safePublish('campania-finalizada', JSON.stringify({ campañaId: campaña }));
                await this.publicarLog(campaña, 'info', `🏁 Finalizada — ${enviados}/${total} enviados correctamente`);
                this.logger.log(`🏁 Campaña ${campaña} finalizada. Total enviados: ${enviados}/${total}.`);
            }
        } finally {
            // Liberar recursos
            clearInterval(renewalInterval);
            for (const key of lockKeys) {
                await releaseLock(this.redis, key);
            }
            this.logger.log(`🔓 [Job ${job.id}] Locks liberados para campaña ${campaña}.`);
        }
    }

    private async publicarLog(campañaId: number, nivel: 'ok' | 'warn' | 'error' | 'info' | 'skip', mensaje: string): Promise<void> {
        const payload = JSON.stringify({ campañaId, nivel, mensaje, timestamp: new Date().toISOString() });
        await this.safePublish('campania-log', payload);
        // Persiste en lista Redis para historial (últimas 200 entradas, TTL 24h)
        try {
            const key = `campania-wa-logs:${campañaId}`;
            await this.redis.rPush(key, payload);
            await this.redis.lTrim(key, -500, -1);
            await this.redis.expire(key, 86400);
        } catch { /* no interrumpir el envío por error de persistencia */ }
    }

    /**
     * Espera hasta que Redis esté listo (reconectado).
     * Si no se reconecta dentro del timeout, lanza un error para que el job falle gracefully.
     * Emite un evento de "reanudado" al frontend cuando se reconecta.
     */
    private async waitForRedisReady(campañaId?: number, timeout?: number): Promise<void> {
        const maxWait = timeout ?? this.REDIS_RECONNECT_TIMEOUT;

        if (this.redis.isReady) return;

        this.logger.warn('⏳ Redis desconectado. Esperando reconexión...');
        const start = Date.now();

        while (!this.redis.isReady) {
            if (Date.now() - start > maxWait) {
                throw new Error(`Redis no se reconectó dentro del timeout (${maxWait / 1000}s). Pausando job.`);
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        const segundosPausado = Math.round((Date.now() - start) / 1000);
        this.logger.log(`✅ Redis reconectado tras ${segundosPausado}s. Reanudando envío.`);

        // Notificar al frontend que el envío se pausó y reanudó
        if (campañaId) {
            await this.safePublish('campania-envio-reanudado', JSON.stringify({
                campañaId,
                segundosPausado,
            }));
        }
    }

    /**
     * Publish seguro: si Redis no está listo, espera reconexión antes de publicar.
     * Si falla después de esperar, loguea el error pero no mata el proceso.
     */
    private async safePublish(channel: string, message: string): Promise<void> {
        try {
            await this.waitForRedisReady();
            await this.redis.publish(channel, message);
        } catch (err) {
            this.logger.error(`❌ Error publicando en "${channel}": ${err.message}`);
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