const Redis = require('ioredis');
const { getSesion } = require('./sesionManager');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

const redisPub = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

redis.subscribe('solicitar-sesion', (err, count) => {
    if (err) {
        logger.error('❌ Error al suscribirse a solicitar-sesion:', err);
    } else {
        logger.info('✅ Suscripto al canal solicitar-sesion');
    }
});

redis.on('message', async (channel, message) => {
    if (channel !== 'solicitar-sesion') return;

    try {
        const { sessionId, numero, mensaje, messageId } = JSON.parse(message);
        const sesion = getSesion(sessionId);

        if (!sesion || sesion.estado !== 'conectado') {
            return redisPub.publish('respuesta-envio', JSON.stringify({
                estado: 'fallo',
                error: 'sesion no conectada',
                messageId
            }));
        }

        const client = sesion.client;
        const jid = numero + '@c.us';
        const tieneWhatsapp = await client.isRegisteredUser(jid);

        if (!tieneWhatsapp) {
            return redisPub.publish('respuesta-envio', JSON.stringify({
                estado: 'fallo',
                error: 'no registrado en WhatsApp',
                messageId
            }));
        }

        await client.sendMessage(jid, mensaje);

        redisPub.publish('respuesta-envio', JSON.stringify({
            estado: 'enviado',
            messageId
        }));
    } catch (err) {
        logger.error('❌ Error al procesar mensaje PubSub:', err);
        redisPub.publish('respuesta-envio', JSON.stringify({
            estado: 'fallo',
            error: 'error inesperado',
            messageId: JSON.parse(message)?.messageId || uuidv4()
        }));
    }
});