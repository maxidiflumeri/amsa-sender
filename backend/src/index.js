// backend/index.js
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');
const requestLogger = require('./middleware/requestLogger');
const e = require('express');
const fsPromises = require('fs').promises;
const colaEnvios = require('./queues/colaEnvios');
const { conectarNuevaSesion, cargarSesionesActivas, getSesionesActivas, limpiarSesiones, getSesion } = require('./sesionManager');

const app = express();
const prisma = new PrismaClient();
const PORT = 3001;
app.use(cors());
app.use(express.json());
app.use(requestLogger); // Middleware para registrar las solicitudes

const storage = multer.diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// ====================== CONECTAR SESIÓN ======================
app.get('/api/conectar', async (req, res) => {
    const sessionId = 'session-' + Date.now();

    try {
        const resultado = await conectarNuevaSesion(sessionId);
        res.json(resultado);
    } catch (err) {
        logger.error(`Error al conectar sesión ${sessionId}: ${err.message}`);
        res.status(500).json({ error: 'Error al conectar sesión' });
    }
});

// ====================== ESTADO DE SESIONES ======================
app.get('/api/status', async (req, res) => {
    try {
        const estados = getSesionesActivas();
        res.json(estados);
    } catch (err) {
        logger.error(`Error al obtener estado de sesiones: ${err.message}`);
        res.status(500).json({ error: 'Error interno al obtener sesiones' });
    }
});

// ====================== SUBIDA DE CSV ======================
app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
    if (!req.file) {
        logger.warn('Intento de subir sin archivo CSV.');
        return res.status(400).json({ error: 'Archivo CSV requerido.' });
    }

    const { campaña } = req.body;
    const nombreCampaña = campaña || 'Campaña sin nombre';
    const contactos = [];
    const filePath = req.file.path;

    let nuevaCampaña;

    try {
        nuevaCampaña = await prisma.campaña.create({ data: { nombre: nombreCampaña } });

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                const numero = data['numero']?.trim();
                const mensaje = data['mensaje']?.trim();
                if (numero && mensaje) contactos.push({ numero, mensaje });
            })
            .on('end', async () => {
                try {
                    for (const c of contactos) {
                        await prisma.contacto.create({
                            data: { ...c, campañaId: nuevaCampaña.id }
                        });
                    }

                    logger.info(`CSV procesado: ${contactos.length} contactos guardados.`);

                    try {
                        await fsPromises.unlink(filePath);
                        logger.info(`Archivo CSV eliminado: ${filePath}`);
                    } catch (unlinkErr) {
                        logger.warn(`No se pudo eliminar el archivo ${filePath}: ${unlinkErr.message}`);
                    }

                    res.json({ total: contactos.length, campaña: nombreCampaña });
                } catch (err) {
                    logger.error(`Error guardando contactos del CSV: ${err.message}`);
                    res.status(500).json({ error: 'Error al guardar contactos.' });
                }
            });

    } catch (err) {
        logger.error(`Error creando campaña: ${err.message}`);
        try {
            await fsPromises.unlink(filePath);
            logger.info(`Archivo CSV eliminado tras error: ${filePath}`);
        } catch (unlinkErr) {
            logger.warn(`No se pudo eliminar el archivo tras error: ${unlinkErr.message}`);
        }
        res.status(500).json({ error: 'Error al crear campaña.' });
    }
});

// ====================== ENVÍO DE MENSAJES ======================
app.post('/api/send-messages', async (req, res) => {
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
        console.error('Error al encolar campaña', err);
        await prisma.campaña.update({ where: { id: campaña }, data: { estado: 'pendiente' } });
        return res.status(500).json({ error: 'No se pudo encolar la campaña' });
    }
});

// ====================== OBTENER REPORTES ======================
app.get('/api/reports', async (req, res) => {
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

// ====================== OBTENER CAMPAÑAS ======================
app.get('/api/campanias', async (req, res) => {
    try {
        const camp = await prisma.campaña.findMany({
            where: { archivada: false },
            include: { contactos: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(camp);
    } catch (err) {
        logger.error(`Error al obtener campañas: ${err.message}`);
        res.status(500).json({ error: 'Error al obtener campañas' });
    }
});

// ====================== OBTENER CAMPAÑAS POR ID ======================
app.get('/api/campanias/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const campaña = await prisma.campaña.findUnique({ where: { id: parseInt(id) } });
        if (!campaña) return res.status(404).json({ error: 'Campaña no encontrada' });
        res.json(campaña);
    } catch (err) {
        logger.error(`Error al obtener campañas: ${err.message}`);
        res.status(500).json({ error: 'Error al obtener campañas' });
    }
});

// ====================== OBTENER CAMPAÑAS PARA REPORTES ======================
app.get('/api/campanias-con-reportes', async (req, res) => {
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

// ====================== ELIMINAR TODAS LAS SESIONES ======================
app.delete('/api/sessions/clear', async (req, res) => {
    try {
        await prisma.sesion.deleteMany();
        limpiarSesiones()
        logger.info('Todas las sesiones eliminadas.');
        res.json({ message: 'Todas las sesiones han sido eliminadas.' });
    } catch (error) {
        logger.error(`Error al borrar sesiones: ${error.message}`);
        res.status(500).json({ error: 'Error al eliminar sesiones.' });
    }
});

// ====================== ESTADO DE SESIÓN POR ID ======================
app.get('/api/status/:id', (req, res) => {
    const { id } = req.params;
    const cliente = getSesion(id);

    if (!cliente) {
        logger.warn(`Consulta de estado para sesión no encontrada: ${id}`);
        return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    res.json({ id, estado: cliente.estado, ani: cliente.ani });
});

// ====================== ELIMINAR CAMPAÑAS POR ID ======================
app.delete('/api/campanias/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const campaña = await prisma.campaña.findUnique({ where: { id: parseInt(id) } });
        if (!campaña) return res.status(404).json({ error: 'Campaña no encontrada' });
        if (campaña.estado === 'procesando') return res.status(400).json({ error: 'No se puede eliminar una campaña en proceso de envío' });

        await prisma.contacto.deleteMany({ where: { campañaId: campaña.id } });
        await prisma.campaña.update({ where: { id: campaña.id }, data: { archivada: true } });
        res.json({ message: 'Campaña eliminada con contactos. Reportes conservados.' });
    } catch (error) {
        console.error('Error al eliminar campaña:', error);
        res.status(500).json({ error: 'Error interno al eliminar campaña' });
    }
});

// ====================== PAUSAR CAMPAÑA POR ID ======================
app.post('/api/campanias/:id/pausar', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.campaña.update({
            where: { id: parseInt(id) },
            data: { pausada: true }
        });
        res.json({ message: 'Campaña pausada correctamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error al pausar campaña' });
    }
});

// ====================== REANUDAR CAMPAÑA POR ID ======================
app.post('/api/campanias/:id/reanudar', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const campaña = await prisma.campaña.findUnique({ where: { id } });

        if (!campaña || campaña.estado !== 'pausada') {
            return res.status(400).json({ error: 'Campaña no válida o no pausada' });
        }

        const sessionIds = JSON.parse(campaña.sesiones || '[]');
        const config = campaña.config;

        if (!sessionIds.length || !config) {
            return res.status(400).json({ error: 'Faltan datos para reanudar la campaña' });
        }

        await colaEnvios.add('enviar', { sessionIds, campaña: id, config });

        await prisma.campaña.update({
            where: { id },
            data: { estado: 'procesando', pausada: false }
        });

        res.json({ ok: true });
    } catch (err) {
        logger.error('Error al reanudar campaña:', err);
        res.status(500).json({ error: 'Error interno al reanudar' });
    }
});

// ====================== RECUPERAR SESIONES ACTIVAS AL ARRANCAR ======================
cargarSesionesActivas();

// ====================== INICIAR ESCUCHA PUBSUB ======================
require('./sesionPubSub');

app.listen(PORT, () => logger.info(`Servidor backend corriendo en http://localhost:${PORT}`));