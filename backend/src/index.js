// ====================== DEPENDENCIAS ======================
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const logger = require('./logger');
const requestLogger = require('./middleware/requestLogger');
const colaEnvios = require('./queues/colaEnvios');
const {
    conectarNuevaSesion,
    cargarSesionesActivas,
    getSesionesActivas,
    limpiarSesiones,
    getSesion
} = require('./sesionManager');
const templatesRoutes = require('./routes/templates');
const campañasRoutes = require('./routes/campañas');
require('dotenv').config();
const { Server } = require('socket.io');
const Redis = require('ioredis');
const http = require('http');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// ====================== MANEJO DE ERRORES GLOBALES ======================
process.on('unhandledRejection', (reason, promise) => {
    logger.error('🚨 Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
    logger.error('💥 Uncaught Exception:', err);
});

// ====================== MIDDLEWARE ======================
app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use('/api/templates', templatesRoutes);
app.use('/api/campanias', campañasRoutes);

// ====================== CONFIGURAR MULTER ======================
const storage = multer.diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// ====================== ENDPOINTS ======================

// Conectar sesión

app.post('/api/conectar', async (req, res) => {
    const sessionId = 'session-' + Date.now();

    conectarNuevaSesion(sessionId); // 🔁 No se espera el resolve
    res.status(200).json({ sessionId }); // ✅ responde al frontend rápido
});

// Estado de sesiones
app.get('/api/status', async (req, res) => {
    try {
        const estados = getSesionesActivas();
        res.json(estados);
    } catch (err) {
        logger.error(`Error al obtener estado de sesiones: ${err.message}`);
        res.status(500).json({ error: 'Error interno al obtener sesiones' });
    }
});

// Subida de CSV
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
                if (!numero) return;

                // Separar mensaje si viene como columna, y quitarlo de los datos
                const mensaje = data['mensaje']?.trim();
                const { mensaje: _, numero: __, ...otrosCampos } = data;

                contactos.push({
                    numero,
                    mensaje: mensaje || null,
                    datos: otrosCampos
                });
            })
            .on('end', async () => {
                try {
                    for (const c of contactos) {
                        await prisma.contacto.create({
                            data: {
                                numero: c.numero,
                                mensaje: c.mensaje,
                                datos: c.datos,
                                campañaId: nuevaCampaña.id
                            }
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

// Envío de mensajes
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
        logger.error('Error al encolar campaña', err);
        await prisma.campaña.update({ where: { id: campaña }, data: { estado: 'pendiente' } });
        return res.status(500).json({ error: 'No se pudo encolar la campaña' });
    }
});

// Obtener reportes
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

// Obtener campañas
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

// Obtener campaña por ID
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

// Obtener campañas con reportes
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

// Eliminar todas las sesiones
app.delete('/api/sessions/clear', async (req, res) => {
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
app.get('/api/status/:id', (req, res) => {
    const { id } = req.params;
    const cliente = getSesion(id);

    if (!cliente) {
        logger.warn(`Consulta de estado para sesión no encontrada: ${id}`);
        return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    res.json({ id, estado: cliente.estado, ani: cliente.ani });
});

// Eliminar campaña por ID
app.delete('/api/campanias/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const campaña = await prisma.campaña.findUnique({ where: { id: parseInt(id) } });
        if (!campaña) return res.status(404).json({ error: 'Campaña no encontrada' });
        if (campaña.estado === 'procesando') return res.status(400).json({ error: 'No se puede eliminar una campaña en proceso de envío' });
        if (campaña?.jobId) {
            const job = await colaEnvios.getJob(campaña.jobId);            
            if (job) {
                await job.remove();
                logger.info(`🗑️ Job ${campaña.jobId} eliminado de la cola.`);
            }
        }
        await prisma.contacto.deleteMany({ where: { campañaId: campaña.id } });
        await prisma.campaña.update({ where: { id: campaña.id }, data: { archivada: true } });
        res.json({ message: 'Campaña eliminada con contactos. Reportes conservados.' });
    } catch (error) {
        logger.error('Error al eliminar campaña:', error);
        res.status(500).json({ error: 'Error interno al eliminar campaña' });
    }
});

// Pausar campaña
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

// Reanudar campaña
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

// ====================== RECUPERAR SESIONES ACTIVAS ======================
cargarSesionesActivas();

// ====================== ESCUCHA DE PUBSUB ======================
require('./sesionPubSub');

// ====================== SOCKET.IO + REDIS PROGRESO EN VIVO ======================
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});

io.on('connection', (socket) => {
    logger.info('🔌 Cliente WebSocket conectado');

    socket.on('join_campaña', (campañaId) => {
        socket.join(`campaña_${campañaId}`);
        logger.info(`🧩 Cliente se unió a sala campaña_${campañaId}`);
    });

    socket.on('disconnect', () => {
        logger.info('❌ Cliente WebSocket desconectado');
    });
});

const redisSub = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null
});

redisSub.subscribe('progreso-envio', (err, count) => {
    if (err) {
        logger.error('❌ Error al suscribirse a progreso-envio:', err);
    } else {
        logger.info(`📡 Subscrito a progreso-envio (${count} canales)`);
    }
});

redisSub.subscribe('campania-finalizada', (err, count) => {
    if (err) {
        logger.error('❌ Error al suscribirse a campania-finalizada:', err);
    } else {
        logger.info(`📡 Subscrito a campania-finalizada (${count} canales)`);
    }
});

redisSub.subscribe('campania-pausada', (err, count) => {
    if (err) {
        logger.error('❌ Error al suscribirse a campania-pausada:', err);
    } else {
        logger.info(`📡 Subscrito a campania-pausada (${count} canales)`);
    }
});

redisSub.subscribe('campania-estado', (err, count) => {
    if (err) {
        logger.error('❌ Error al suscribirse a campania-estado:', err);
    } else {
        logger.info(`📡 Subscrito a campania-estado (${count} canales)`);
    }
});

redisSub.subscribe('estado-sesion', (err, count) => {
    if (err) {
        logger.error('❌ Error al suscribirse a estado-sesion:', err);
    } else {
        logger.info(`📡 Subscrito a estado-sesion (${count} canales)`);
    }
});

redisSub.on('message', (channel, message) => {
    if (channel === 'campania-estado') {
        const { campaña, estado } = JSON.parse(message);
        io.emit('campania_estado', { campaña, estado });
    }

    if (channel === 'campania-finalizada') {
        const { campañaId } = JSON.parse(message);
        io.emit('campania_finalizada', { campañaId });
    }

    if (channel === 'campania-pausada') {
        const { campañaId } = JSON.parse(message);
        io.emit('campania_pausada', { campañaId });
    }

    if (channel === 'estado-sesion') {
        const { estado, qr, ani, sessionId } = JSON.parse(message);
        io.emit('estado_sesion', { estado, qr, ani, sessionId });
    }

    if (channel === 'progreso-envio') {
        try {
            const { campañaId, enviados, total } = JSON.parse(message);
            io.to(`campaña_${campañaId}`).emit('progreso', {
                campañaId, enviados, total
            });
        } catch (err) {
            logger.warn('⚠️ Mensaje mal formado en canal progreso-envio');
        }
    }
});

// ====================== INICIAR SERVIDOR HTTP ======================
httpServer.listen(PORT, () => {
    logger.info(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});