// ====================== DEPENDENCIAS ======================
const express = require('express');
const cors = require('cors');
const logger = require('./logger');
const requestLogger = require('./middleware/requestLogger');
const { cargarSesionesActivas } = require('./sesionManager');
const templatesRoutes = require('./routes/templates');
const campañasRoutes = require('./routes/campañas');
const sesionesRoutes = require('./routes/sesiones');
const reportesRoutes = require('./routes/reportes');
const mensajesRoutes = require('./routes/mensajes');
require('dotenv').config();
const { Server } = require('socket.io');
const Redis = require('ioredis');
const http = require('http');

const app = express();
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
app.use('/api/sesiones', sesionesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/mensajes', mensajesRoutes);

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
