// src/queues/bullmq.config.ts
export const connection = {
  host: process.env.REDIS_HOST?.trim() || 'redis',
  port: parseInt(process.env.REDIS_PORT?.trim() || '6379', 10),
};