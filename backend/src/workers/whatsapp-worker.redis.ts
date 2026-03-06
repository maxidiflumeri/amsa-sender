import { createClient } from 'redis';
import { Logger } from '@nestjs/common';

const logger = new Logger('WhatsappWorkerRedis');

const RedisProvider = {
    provide: 'REDIS_CLIENT',
    useFactory: async () => {
        const client = createClient({
            url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
            socket: {
                reconnectStrategy: (retries) => {
                    const delay = Math.min(retries * 500, 10000);
                    logger.warn(`[REDIS_CLIENT] Reconectando a Redis (intento ${retries}, próximo en ${delay}ms)...`);
                    return delay;
                },
            },
        });
        client.on('error', (err) => logger.error(`[REDIS_CLIENT] Redis error: ${err.message}`));
        client.on('ready', () => logger.log('[REDIS_CLIENT] Conexión a Redis establecida.'));
        await client.connect();
        return client;
    },
};

const RedisSubProvider = {
    provide: 'REDIS_SUB',
    useFactory: async () => {
        const client = createClient({
            url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
            socket: {
                reconnectStrategy: (retries) => {
                    const delay = Math.min(retries * 500, 10000);
                    logger.warn(`[REDIS_SUB] Reconectando a Redis (intento ${retries}, próximo en ${delay}ms)...`);
                    return delay;
                },
            },
        });
        client.on('error', (err) => logger.error(`[REDIS_SUB] Redis error: ${err.message}`));
        client.on('ready', () => logger.log('[REDIS_SUB] Conexión a Redis establecida.'));
        await client.connect();
        return client;
    },
};

export const RedisProviders = [RedisProvider, RedisSubProvider];