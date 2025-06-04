const { Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const logger = require('../logger');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

const redis = new Redis({ maxRetriesPerRequest: null });
const redisSub = new Redis({ maxRetriesPerRequest: null });

const prisma = new PrismaClient();

const worker = new Worker('envios-whatsapp', async job => {
    const { sessionIds, campaña, config } = job.data;
    const {
        batchSize = 10,
        delayEntreMensajes = 1500,
        delayEntreLotes = 2000
    } = config;

    logger.info(`📢 Procesando campaña ID ${campaña} con sesiones: ${sessionIds.join(', ')}`);

    const contactos = await prisma.contacto.findMany({
        where: { campañaId: campaña },
        orderBy: { id: 'asc' }
    });

    const total = contactos.length;
    logger.info(`📊 Total de contactos a enviar: ${total}`);

    for (const sessionId of sessionIds) {
        const contactosSesion = contactos.splice(0, batchSize);

        for (const contacto of contactosSesion) {
            const messageId = uuidv4();

            // Escuchar la respuesta para este mensaje
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
                
                // Publicar la solicitud de envío
                redis.publish('solicitar-sesion', JSON.stringify({
                    sessionId,
                    numero: contacto.numero,
                    mensaje: contacto.mensaje,
                    messageId
                }));

                // Timeout en caso de que no haya respuesta
                setTimeout(() => {
                    redisSub.removeListener('message', handler);
                    resolve({ estado: 'timeout' });
                }, 8000);
            });

            if (respuesta.estado === 'enviado') {
                await prisma.reporte.create({
                    data: {
                        numero: contacto.numero,
                        estado: 'enviado',
                        mensaje: contacto.mensaje,
                        campañaId: campaña
                    }
                });
                logger.info(`✅ Mensaje enviado a ${contacto.numero}`);
            } else {
                await prisma.reporte.create({
                    data: {
                        numero: contacto.numero,
                        estado: 'fallo',
                        mensaje: contacto.mensaje,
                        campañaId: campaña
                    }
                });
                logger.warn(`⚠️ Fallo al enviar a ${contacto.numero}: ${respuesta.error || 'desconocido'}`);
            }

            await new Promise(r => setTimeout(r, delayEntreMensajes));
        }

        await new Promise(r => setTimeout(r, delayEntreLotes));
    }

    await prisma.campaña.update({
        where: { id: campaña },
        data: { estado: 'finalizada' }
    });

    logger.info(`🏁 Campaña ${campaña} finalizada`);
}, {
    connection: redis
});

worker.on('failed', (job, err) => {
    logger.error(`❌ Job ${job.id} falló: ${err.message}`);
});

logger.info('👷 Worker escuchando cola de envíos...');