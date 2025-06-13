// backend/worker.js
const { Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const logger = require('../logger');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

const redisSub = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();

const worker = new Worker('envios-whatsapp', async job => {
    const { sessionIds, campaña, config } = job.data;
    const {
        batchSize,
        delayEntreMensajes,
        delayEntreLotes
    } = config;

    logger.info(`📢 Procesando campaña ID ${campaña} con sesiones: ${sessionIds.join(', ')} // batchSize: ${batchSize} // delayEntreMensajes: ${delayEntreMensajes} // delayEntreLotes: ${delayEntreLotes}`);

    // Obtener la campaña actual
    const campañaActual = await prisma.campaña.findUnique({
        where: { id: campaña },
        select: { estado: true }
    });

    if (campañaActual?.estado === 'pausa_pendiente') {
        await prisma.campaña.update({
            where: { id: campaña },
            data: { estado: 'pausada' }
        });

        await redis.publish('campania-pausada', JSON.stringify({
            campañaId: campaña
        }));

        logger.warn(`⏸️ Campaña ${campaña} fue marcada para pausar antes de comenzar. No se enviará.`);
        return;
    }

    if (campañaActual?.estado === 'programada') {
        // Cambiar a "procesando" en BD
        await prisma.campaña.update({
            where: { id: campaña },
            data: { estado: 'procesando' }
        });

        // Emitir por Redis
        await redis.publish(
            'campania-estado',
            JSON.stringify({
                campaña,
                estado: 'procesando'
            })
        );
    }

    // Obtener IDs de contactos ya procesados
    const reportes = await prisma.reporte.findMany({
        where: { campañaId: campaña },
        select: { numero: true }
    });
    const numerosProcesados = new Set(reportes.map(r => r.numero));

    // Filtrar solo contactos no procesados
    const contactos = await prisma.contacto.findMany({
        where: {
            campañaId: campaña,
            numero: { notIn: Array.from(numerosProcesados) }
        },
        orderBy: { id: 'asc' }
    });


    const total = contactos.length;
    logger.info(`📊 Total de contactos a enviar: ${total}`);
    let enviados = 0;

    // Distribuir contactos entre sesiones
    const contactosPorSesion = {};
    sessionIds.forEach(id => contactosPorSesion[id] = []);
    contactos.forEach((contacto, i) => {
        const sessionId = sessionIds[i % sessionIds.length];
        contactosPorSesion[sessionId].push(contacto);
    });

    for (const sessionId of sessionIds) {
        const contactosSesion = contactosPorSesion[sessionId];
        const campañaActual = await prisma.campaña.findUnique({ where: { id: campaña } });
        if (campañaActual.estado === 'pausada') {
            await prisma.campaña.update({
                where: { id: parseInt(campaña) },
                data: { estado: 'pausada' }
            });

            await redis.publish('campania-pausada', JSON.stringify({
                campañaId: campaña
            }));

            logger.warn(`⏸️ Campaña ${campaña} fue pausada manualmente. Envío detenido.`);
            return;
        }

        for (let i = 0; i < contactosSesion.length; i += batchSize) {
            const campañaActual = await prisma.campaña.findUnique({ where: { id: campaña } });
            if (campañaActual.estado === 'pausada') {
                await prisma.campaña.update({
                    where: { id: parseInt(campaña) },
                    data: { estado: 'pausada' }
                });

                await redis.publish('campania-pausada', JSON.stringify({
                    campañaId: campaña
                }));

                logger.warn(`⏸️ Campaña ${campaña} fue pausada manualmente. Envío detenido.`);
                return;
            }

            const lote = contactosSesion.slice(i, i + batchSize);

            for (const contacto of lote) {
                if (campañaActual.estado === 'pausada') {
                    await prisma.campaña.update({
                        where: { id: parseInt(campaña) },
                        data: { estado: 'pausada' }
                    });

                    await redis.publish('campania-pausada', JSON.stringify({
                        campañaId: campaña
                    }));

                    logger.warn(`⏸️ Campaña ${campaña} fue pausada manualmente. Envío detenido.`);
                    return;
                }

                const messageId = uuidv4();

                const respuesta = await new Promise((resolve, reject) => {
                    const handler = (channel, message) => {
                        try {
                            const data = JSON.parse(message);
                            if (data.messageId === messageId) {
                                redisSub.removeListener('message', handler);
                                resolve(data);
                            }
                        } catch (err) {
                            reject(err);
                        }
                    };

                    redisSub.on('message', handler);
                    redisSub.subscribe('respuesta-envio');

                    redis.publish('solicitar-sesion', JSON.stringify({
                        sessionId,
                        numero: contacto.numero,
                        mensaje: contacto.mensaje,
                        messageId
                    }));

                    setTimeout(() => {
                        redisSub.removeListener('message', handler);
                        resolve({ estado: 'timeout' });
                    }, 8000);
                });

                if (respuesta.estado === 'enviado') {
                    enviados++;

                    await redis.publish('progreso-envio', JSON.stringify({
                        campañaId: campaña,
                        enviados,
                        total
                    }));

                    const sesion = await prisma.sesion.findUnique({
                        where: { sessionId },
                        select: { ani: true }
                    });

                    await prisma.reporte.create({
                        data: {
                            numero: contacto.numero,
                            estado: 'enviado',
                            mensaje: contacto.mensaje,
                            campañaId: campaña,
                            enviadoAt: new Date(),
                            aniEnvio: sesion?.ani || null
                        }
                    });
                    logger.info(`✅ [${sessionId}] Mensaje enviado a ${contacto.numero}`);
                } else {
                    await prisma.reporte.create({
                        data: {
                            numero: contacto.numero,
                            estado: 'fallo',
                            mensaje: contacto.mensaje,
                            campañaId: campaña,
                            enviadoAt: new Date()
                        }
                    });
                    logger.warn(`⚠️ [${sessionId}] Fallo al enviar a ${contacto.numero}: ${respuesta.error || 'desconocido'}`);
                }

                await new Promise(r => setTimeout(r, delayEntreMensajes));
            }

            await new Promise(r => setTimeout(r, delayEntreLotes));
        }
    }

    const campañaActualizada = await prisma.campaña.findUnique({ where: { id: campaña } });
    if (campañaActualizada.estado === 'pausada') {
        logger.warn(`⏸️ Campaña ${campaña} fue pausada manualmente durante el envío. No se actualiza estado a finalizada.`);
        return;
    }

    if (enviados === 0) {
        await prisma.campaña.update({
            where: { id: campaña },
            data: { estado: 'pendiente' }
        });
        logger.warn(`🔁 Campaña ${campaña} no pudo ser enviada. Estado vuelto a 'pendiente'.`);
    } else {
        await prisma.campaña.update({
            where: { id: campaña },
            data: { estado: 'finalizada', enviadoAt: new Date() }
        });
        logger.info(`🏁 Campaña ${campaña} finalizada con ${enviados} mensajes enviados`);
        // Emitir evento vía Redis
        await redis.publish('campania-finalizada', JSON.stringify({
            campañaId: campaña
        }));
    }
}, {
    connection: redis
});

worker.on('failed', (job, err) => {
    logger.error(`❌ Job ${job.id} falló: ${err.message}`);
});

logger.info('👷 Worker escuchando cola de envíos...');