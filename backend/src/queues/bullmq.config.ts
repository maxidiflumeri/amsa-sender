import { Queue } from 'bullmq';

export const connection = {
    host: process.env.REDIS_HOST?.trim() || 'redis',
    port: parseInt(process.env.REDIS_PORT?.trim() || '6379'),
  };

export const colaEnvios = new Queue('colaEnvios', {
    connection,
});