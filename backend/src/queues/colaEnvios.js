// backend/queues/colaEnvios.js
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(); // Usa configuración por defecto (localhost:6379)

const colaEnvios = new Queue('envios-whatsapp', { connection });

module.exports = colaEnvios;