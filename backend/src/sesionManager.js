// backend/sesionManager.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

const prisma = new PrismaClient();
const sesiones = {}; // Mapa en memoria de sesiones activas

// Conecta una sesión desde cero (nuevo QR)
function conectarNuevaSesion(sessionId) {
    return new Promise(async (resolve, reject) => {
        try {
            const client = new Client({ authStrategy: new LocalAuth({ clientId: sessionId }) });
            sesiones[sessionId] = { client, estado: 'inicializando' };

            let qrRespondido = false;

            client.on('qr', (qr) => {
                sesiones[sessionId].qr = qr;
                sesiones[sessionId].estado = 'esperando escaneo';
                if (!qrRespondido) {
                    qrRespondido = true;
                    resolve({ id: sessionId, qr });  // <<< importante
                }
            });

            client.on('ready', async () => {
                sesiones[sessionId].estado = 'conectado';
                sesiones[sessionId].ani = `${client.info.wid.user}-${client.info.pushname}`;
                await prisma.sesion.upsert({
                    where: { sessionId },
                    update: { estado: 'conectado', ani: sesiones[sessionId].ani },
                    create: { sessionId, estado: 'conectado', ani: sesiones[sessionId].ani }
                });
                logger.info(`Sesión ${sessionId} conectada como ${client.info.wid.user}`);
            });

            client.on('auth_failure', (msg) => {
                logger.warn(`Fallo de autenticación en ${sessionId}: ${msg}`);
            });

            client.on('disconnected', async () => {
                sesiones[sessionId].estado = 'desconectado';
                await prisma.sesion.update({
                    where: { sessionId },
                    data: { estado: 'desconectado' }
                });
                logger.info(`Sesión ${sessionId} desconectada.`);
            });

            await client.initialize();
        } catch (error) {
            logger.error(`Error al inicializar sesión ${sessionId}: ${error.message}`);
            reject(error);
        }
    });
}


// Reconecta todas las sesiones activas desde la base
async function cargarSesionesActivas() {
    const sesionesDB = await prisma.sesion.findMany({ where: { estado: 'conectado' } });
    for (const { sessionId } of sesionesDB) {
        try {
            await reconectarSesion(sessionId);
        } catch (err) {
            logger.error(`⚠️ Error reconectando ${sessionId}: ${err.message}`);
        }
    }
}

// Reconecta una sesión usando LocalAuth
async function reconectarSesion(sessionId) {
    const client = new Client({ authStrategy: new LocalAuth({ clientId: sessionId }) });
    sesiones[sessionId] = { client, estado: 'reconectando' };

    client.on('ready', async () => {
        const ani = `${client.info.wid.user}-${client.info.pushname}`;
        sesiones[sessionId] = { client, estado: 'conectado', ani };
        await prisma.sesion.update({
            where: { sessionId },
            data: { estado: 'conectado', ani }
        });
        logger.info(`🔁 Sesión ${sessionId} reconectada (${ani})`);
    });

    client.on('auth_failure', (msg) => {
        sesiones[sessionId].estado = 'fallo de autenticación';
        logger.warn(`❌ Auth failure ${sessionId}: ${msg}`);
    });

    client.on('disconnected', async () => {
        sesiones[sessionId].estado = 'desconectado';
        await prisma.sesion.update({
            where: { sessionId },
            data: { estado: 'desconectado' }
        });
        logger.info(`🔌 Sesión ${sessionId} desconectada.`);
    });

    await client.initialize();
    return sesiones[sessionId];
}

// Acceso a sesión desde otros módulos
function getSesion(id) {
    return sesiones[id];
}

function getSesionesActivas() {
    return Object.entries(sesiones).map(([id, s]) => ({ id, estado: s.estado, ani: s.ani }));
}

function limpiarSesiones() {
    for (const id of Object.keys(sesiones)) {
        try {
            sesiones[id].client.destroy();
        } catch (e) {
            logger.warn(`Error al destruir sesión ${id}: ${e.message}`);
        }
        delete sesiones[id];
    }
    logger.info('🧹 Sesiones en memoria limpiadas.');
}


module.exports = {
    conectarNuevaSesion,
    cargarSesionesActivas,
    reconectarSesion,
    getSesion,
    getSesionesActivas,
    limpiarSesiones
};
