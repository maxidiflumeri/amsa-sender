import { createClient } from 'redis';

export const RedisProvider = {
    provide: 'REDIS_CLIENT',
    useFactory: async () => {
        const client = createClient({
            url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
        });
        await client.connect();
        return client;
    },
};

export const RedisSubProvider = {
    provide: 'REDIS_SUB',
    useFactory: async () => {
        const client = createClient({
            url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
        });
        await client.connect();
        return client;
    },
};