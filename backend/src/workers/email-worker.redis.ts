// workers/email-worker.redis.ts
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';

const logger = new Logger('EmailWorkerRedis');

const EmailRedisProvider = {
    provide: 'EMAIL_REDIS_CLIENT',
    useFactory: async () => {
        const client = createClient({
            url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
            socket: {
                reconnectStrategy: (retries) => {
                    const delay = Math.min(retries * 500, 10000);
                    logger.warn(`[EMAIL_REDIS_CLIENT] Reconectando a Redis (intento ${retries}, próximo en ${delay}ms)...`);
                    return delay;
                },
            },
        });
        client.on('error', (err) => logger.error(`[EMAIL_REDIS_CLIENT] Redis error: ${err.message}`));
        client.on('ready', () => logger.log('[EMAIL_REDIS_CLIENT] Conexión a Redis establecida.'));
        await client.connect();
        return client;
    },
};

const EmailRedisSubProvider = {
    provide: 'EMAIL_REDIS_SUB',
    useFactory: async () => {
        const client = createClient({
            url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
            socket: {
                reconnectStrategy: (retries) => {
                    const delay = Math.min(retries * 500, 10000);
                    logger.warn(`[EMAIL_REDIS_SUB] Reconectando a Redis (intento ${retries}, próximo en ${delay}ms)...`);
                    return delay;
                },
            },
        });
        client.on('error', (err) => logger.error(`[EMAIL_REDIS_SUB] Redis error: ${err.message}`));
        client.on('ready', () => logger.log('[EMAIL_REDIS_SUB] Conexión a Redis establecida.'));
        await client.connect();
        return client;
    },
};

export const EmailRedisProviders = [EmailRedisProvider, EmailRedisSubProvider];