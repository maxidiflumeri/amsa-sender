import { Queue } from 'bullmq';

export const connection = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const colaEnvios = new Queue('colaEnvios', {
    connection,
});