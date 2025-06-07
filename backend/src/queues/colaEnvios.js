// backend/queues/colaEnvios.js
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
});

const colaEnvios = new Queue('envios-whatsapp', { connection });

module.exports = colaEnvios;