const logger = require('../logger');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const colaEnvios = require('../queues/colaEnvios');

const router = express.Router();
const prisma = new PrismaClient();

// Envío de mensajes
router.post('/send-messages', async (req, res) => {
    const { sessionIds, campaña, config = {} } = req.body;
    try {
        await prisma.campaña.update({
            where: { id: campaña },
            data: {
                estado: 'procesando',
                sesiones: JSON.stringify(sessionIds),
                config
            }
        });
        await colaEnvios.add('enviar', { sessionIds, campaña, config });
        return res.status(200).json({ message: 'Envío encolado correctamente' });
    } catch (err) {
        logger.error('Error al encolar campaña', err);
        await prisma.campaña.update({ where: { id: campaña }, data: { estado: 'pendiente' } });
        return res.status(500).json({ error: 'No se pudo encolar la campaña' });
    }
});

module.exports = router;