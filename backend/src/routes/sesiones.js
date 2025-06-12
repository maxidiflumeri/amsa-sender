const logger = require('../logger');
const express = require('express');
const router = express.Router();
const {
    conectarNuevaSesion,    
    getSesionesActivas,
    limpiarSesiones,
    eliminarSesionPorId,
    getSesion
} = require('../sesionManager');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Eliminar sesion por id
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const sesion = await prisma.sesion.findUnique({
            where: { sessionId: id },
        });

        if (sesion) {
            await prisma.sesion.delete({
                where: { sessionId: id },
            });
        }

        await eliminarSesionPorId(id);

        logger.info(`Sesión ${id} eliminada correctamente.`);
        res.json({ message: `Sesión ${id} eliminada correctamente.` });
    } catch (error) {
        logger.error(`Error al eliminar sesión ${id}: ${error.message}`);
        res.status(500).json({ error: 'Error al eliminar la sesión.' });
    }
});

// Eliminar todas las sesiones
router.delete('/clear', async (req, res) => {
    try {
        await prisma.sesion.deleteMany();
        await limpiarSesiones();
        logger.info('Todas las sesiones eliminadas.');
        res.json({ message: 'Todas las sesiones han sido eliminadas.' });
    } catch (error) {
        logger.error(`Error al borrar sesiones: ${error.message}`);
        res.status(500).json({ error: 'Error al eliminar sesiones.' });
    }
});

// Estado de sesión por ID
router.get('/status/:id', (req, res) => {
    const { id } = req.params;
    const cliente = getSesion(id);

    if (!cliente) {
        logger.warn(`Consulta de estado para sesión no encontrada: ${id}`);
        return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    res.json({ id, estado: cliente.estado, ani: cliente.ani });
});

// Estado de sesiones
router.get('/status', async (req, res) => {
    try {
        const estados = getSesionesActivas();
        res.json(estados);
    } catch (err) {
        logger.error(`Error al obtener estado de sesiones: ${err.message}`);
        res.status(500).json({ error: 'Error interno al obtener sesiones' });
    }
});

// Conectar sesión
router.post('/conectar', async (req, res) => {
    const sessionId = 'session-' + Date.now();

    conectarNuevaSesion(sessionId); // 🔁 No se espera el resolve
    res.status(200).json({ sessionId }); // ✅ responde al frontend rápido
});

module.exports = router;