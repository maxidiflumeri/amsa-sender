// backend/sesionManager.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const sesiones = {}; // Mapa en memoria de sesiones activas

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

// Conecta una sesión desde cero (nuevo QR)
function conectarNuevaSesion(sessionId) {
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionId }),
        puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    });

    sesiones[sessionId] = { client, estado: 'inicializando' };
    let qrTimer = null;

    client.on('qr', (qr) => {
        sesiones[sessionId].qr = qr;
        sesiones[sessionId].estado = 'esperando escaneo';

        redis.publish('estado-sesion', JSON.stringify({ estado: 'qr', qr, ani: '', sessionId }));
    });

    client.on('authenticated', async () => {
        sesiones[sessionId].estado = 'iniciando_sesion';

        await redis.publish('estado-sesion', JSON.stringify({
            estado: 'iniciando_sesion',
            qr: '',
            ani: '',
            sessionId
        }));
    });

    client.on('ready', async () => {
        if (qrTimer) clearTimeout(qrTimer);
        const ani = `${client.info.wid.user}-${client.info.pushname}`;
        sesiones[sessionId].estado = 'conectado';
        sesiones[sessionId].ani = ani;

        await redis.publish('estado-sesion', JSON.stringify({
            estado: 'conectado',
            qr: '',
            ani,
            sessionId
        }));

        await prisma.sesion.upsert({
            where: { sessionId },
            update: { estado: 'conectado', ani },
            create: { sessionId, estado: 'conectado', ani },
        });

        logger.info(`Sesión ${sessionId} conectada como ${client.info.wid.user}`);
    });

    client.on('message', async (msg) => {
        await registrarMensaje({ msg, client, sessionId });
    });

    client.on('auth_failure', (msg) => {
        logger.warn(`Fallo de autenticación en ${sessionId}: ${msg}`);
        redis.publish('estado-sesion', JSON.stringify({
            estado: 'fallo_autenticacion',
            sessionId,
            mensaje: msg
        }));
    });

    client.on('disconnected', async () => {
        sesiones[sessionId].estado = 'desconectado';
        await prisma.sesion.update({
            where: { sessionId },
            data: { estado: 'desconectado' },
        });
        logger.info(`Sesión ${sessionId} desconectada.`);
        redis.publish('estado-sesion', JSON.stringify({
            estado: 'desconectado',
            qr: '',
            ani: '',
            sessionId
        }));

        logger.info(`🔌 Sesión ${sessionId} desconectada.`);
    });

    client.initialize().catch(error => {
        logger.error(`Error al inicializar sesión ${sessionId}: ${error.message}`);
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
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionId }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });
    sesiones[sessionId] = { client, estado: 'reconectando' };

    client.on('ready', async () => {
        const ani = `${client.info.wid.user}-${client.info.pushname}`;
        sesiones[sessionId] = { client, estado: 'conectado', ani };
        await prisma.sesion.update({
            where: { sessionId },
            data: { estado: 'conectado', ani }
        });
        await redis.publish('estado-sesion', JSON.stringify({
            estado: 'conectado',
            qr: '',
            ani,
            sessionId
        }));
        logger.info(`🔁 Sesión ${sessionId} reconectada (${ani})`);
    });

    client.on('message', async (msg) => {
        await registrarMensaje({ msg, client, sessionId });
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

async function limpiarSesiones() {
    for (const id of Object.keys(sesiones)) {
        const sesion = sesiones[id];
        const estado = sesion?.estado || 'desconocido';

        try {
            if (estado !== 'desconectado' && sesion?.client) {
                logger.info(`🧼 Cerrando sesión activa ${id}...`);

                // Cerramos el navegador manualmente si está conectado
                if (sesion.client.pupBrowser?.isConnected()) {
                    await sesion.client.pupBrowser.close().catch(err => {
                        logger.warn(`⚠️ Error cerrando browser Puppeteer en sesión ${id}: ${err.message}`);
                    });
                }

                // Ejecutamos destroy para cerrar bien la sesión
                await sesion.client.destroy();
                logger.info(`✅ Sesión ${id} destruida correctamente.`);
            } else {
                logger.info(`ℹ️ Sesión ${id} ya estaba desconectada, no se ejecuta destroy().`);
            }
        } catch (err) {
            if (err.code === 'EBUSY') {
                logger.warn(`⚠️ Archivo bloqueado al destruir sesión ${id}: ${err.message}`);
            } else {
                logger.error(`💥 Error inesperado al destruir sesión ${id}: ${err.message}`);
            }
        }

        delete sesiones[id];
    }

    logger.info('🧹 Todas las sesiones en memoria fueron limpiadas.');
}

async function eliminarSesionPorId(sessionId) {
    const sesion = sesiones[sessionId];
    const estado = sesion?.estado || 'desconocido';

    try {
        if (estado !== 'desconectado' && sesion?.client) {
            logger.info(`🧼 Cerrando sesión activa ${sessionId}...`);

            if (sesion.client.pupBrowser?.isConnected()) {
                await sesion.client.pupBrowser.close().catch(err => {
                    logger.warn(`⚠️ Error cerrando browser Puppeteer en sesión ${sessionId}: ${err.message}`);
                });
            }

            await sesion.client.destroy();
            logger.info(`✅ Sesión ${sessionId} destruida correctamente.`);
        } else {
            logger.info(`ℹ️ Sesión ${sessionId} ya estaba desconectada, no se ejecuta destroy().`);
        }
    } catch (err) {
        if (err.code === 'EBUSY') {
            logger.warn(`⚠️ Archivo bloqueado al destruir sesión ${sessionId}: ${err.message}`);
        } else {
            logger.error(`💥 Error inesperado al destruir sesión ${sessionId}: ${err.message}`);
        }
    }

    delete sesiones[sessionId];
    logger.info(`🗑️ Sesión ${sessionId} eliminada de memoria.`);
}

async function borrarCarpetaSesion(sessionId) {
    const nombreCarpeta = `session-${sessionId}`;
    const ruta = path.join(__dirname, '..', '.wwebjs_auth', nombreCarpeta);

    if (fs.existsSync(ruta)) {
        await fs.promises.rm(ruta, { recursive: true, force: true });
    }
};

async function borrarTodasLasCarpetasSesion() {
    const basePath = path.join(__dirname, '..', '.wwebjs_auth');
    const archivos = await fs.promises.readdir(basePath);

    const carpetasSesion = archivos.filter(nombre => nombre.startsWith('session-'));

    for (const carpeta of carpetasSesion) {
        const ruta = path.join(basePath, carpeta);
        await fs.promises.rm(ruta, { recursive: true, force: true });
    }
};

function normalizarNumero(numeroRaw) {
    return numeroRaw.replace('@c.us', '').replace('@s.whatsapp.net', '');
}

async function registrarMensaje({ msg, client, sessionId }) {
    try {
        const fromMe = msg.fromMe;
        const numeroRaw = msg.fromMe ? msg.to : msg.from;
        const numero = normalizarNumero(numeroRaw);
        const ani = `${client.info.wid.user}-${client.info.pushname}`;
        const mensaje = msg.body;
        const fecha = msg.timestamp ? new Date(msg.timestamp * 1000) : new Date();
        const tipo = msg.type;

        let campañaId = null;

        if (!fromMe) {
            // Buscar el último mensaje enviado a este número, con campaña
            const ultimoEnviado = await prisma.mensaje.findFirst({
                where: {
                    numero,
                    fromMe: true,
                    campañaId: { not: null }
                },
                orderBy: { fecha: 'desc' }
            });

            if (ultimoEnviado) {
                // Verificamos si ya hay una respuesta posterior
                const yaRespondido = await prisma.mensaje.findFirst({
                    where: {
                        numero,
                        fromMe: false,
                        campañaId: ultimoEnviado.campañaId,
                        fecha: { gt: ultimoEnviado.fecha }
                    }
                });

                if (!yaRespondido) {
                    campañaId = ultimoEnviado.campañaId;
                }
            }
        }

        await prisma.mensaje.create({
            data: {
                numero,
                mensaje,
                fromMe,
                fecha,
                tipo,
                ani,
                campañaId
            }
        });

        logger.info(`💬 [${fromMe ? 'ENVIADO' : 'RECIBIDO'}] ${numero}: ${mensaje} ${campañaId ? `(Campaña ${campañaId})` : ''}`);
    } catch (err) {
        logger.error(`❌ Error registrando mensaje: ${err.message}`);
    }
}

module.exports = {
    conectarNuevaSesion,
    cargarSesionesActivas,
    reconectarSesion,
    getSesion,
    getSesionesActivas,
    limpiarSesiones,
    eliminarSesionPorId,
    borrarCarpetaSesion,
    borrarTodasLasCarpetasSesion
};
