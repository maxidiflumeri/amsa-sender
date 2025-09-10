// workers/email-worker.redis.ts
import { createClient } from 'redis';

const EmailRedisProvider = {
    provide: 'EMAIL_REDIS_CLIENT',
    useFactory: async () => {
        const client = createClient({
            url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
        });
        await client.connect();
        return client;
    },
};

const EmailRedisSubProvider = {
    provide: 'EMAIL_REDIS_SUB',
    useFactory: async () => {
        const client = createClient({
            url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
        });
        await client.connect();
        return client;
    },
};

export const EmailRedisProviders = [EmailRedisProvider, EmailRedisSubProvider];