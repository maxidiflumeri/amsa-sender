const logger = require('../logger');
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener campañas con reportes
router.get('/campanias-con-reportes', async (req, res) => {
    try {
        const reportes = await prisma.reporte.findMany({ include: { campaña: true } });
        const campañasUnicas = Array.from(
            new Map(reportes.filter(r => r.campaña !== null).map(r => [r.campaña.id, r.campaña])).values()
        );
        res.json(campañasUnicas);
    } catch (err) {
        logger.error(`Error al obtener campañas con reportes: ${err.message}`);
        res.status(500).json({ error: 'Error al obtener campañas con reportes.' });
    }
});

// Obtener reportes
router.get('/', async (req, res) => {
    const { campañaId } = req.query;
    try {
        const where = campañaId ? { campañaId: Number(campañaId) } : {};
        const reportes = await prisma.reporte.findMany({ where, include: { campaña: true } });
        logger.info(`Reportes consultados (${reportes.length})${campañaId ? ` para campaña ID ${campañaId}` : ''}.`);
        res.json(reportes);
    } catch (err) {
        logger.error(`Error al obtener reportes: ${err.message}`);
        res.status(500).json({ error: 'Error al obtener reportes.' });
    }
});

module.exports = router;