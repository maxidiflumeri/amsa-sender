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

// GET /api/mensajes/metricas/:campañaId
router.get('/campania/:campaniaId/metricas', async (req, res) => {
    const { campaniaId } = req.params;

    try {
        const enviados = await prisma.mensaje.count({
            where: { campañaId: Number(campaniaId), fromMe: true }
        });

        const respuestas = await prisma.mensaje.findMany({
            where: {
                campañaId: Number(campaniaId),
                fromMe: false
            },
            select: { numero: true }
        });

        const contactosRespondieron = new Set(respuestas.map(r => r.numero)).size;
        const totalRespuestas = respuestas.length;

        res.json({
            enviados,
            contactosRespondieron,
            totalRespuestas,
            porcentajeRespondieron: enviados > 0
                ? (contactosRespondieron / enviados) * 100
                : 0
        });
    } catch (error) {
        console.error('Error al obtener métricas:', error);
        res.status(500).json({ error: 'No se pudo obtener métricas.' });
    }
});

// POST /api/mensajes
router.post('/', async (req, res) => {
    const { numero, campañaId, ani, mensaje, fromMe, fecha, tipo } = req.body;

    try {
        const nuevo = await prisma.mensaje.create({
            data: {
                numero,
                campañaId: campañaId ? Number(campañaId) : null,
                ani,
                mensaje,
                fromMe,
                fecha: new Date(fecha),
                tipo,
            }
        });

        res.json(nuevo);
    } catch (error) {
        logger.error('Error al guardar mensaje:', error);
        res.status(500).json({ error: 'No se pudo guardar el mensaje.' });
    }
});

// GET /api/mensajes?campañaId=123
router.get('/', async (req, res) => {
    const { campañaId } = req.query;

    try {
        const mensajes = await prisma.mensaje.findMany({
            where: {
                campañaId: campañaId ? Number(campañaId) : undefined
            },
            orderBy: {
                fecha: 'asc'
            }
        });

        res.json(mensajes);
    } catch (error) {
        logger.error('Error al obtener mensajes:', error);
        res.status(500).json({ error: 'No se pudo obtener mensajes.' });
    }
});

module.exports = router;