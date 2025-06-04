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

let sesiones = {}; // { id: client }

// ====================== CONECTAR SESIÓN ======================
app.get('/api/conectar', async (req, res) => {
    const sessionId = 'session-' + Date.now();
    const client = new Client({ authStrategy: new LocalAuth({ clientId: sessionId }) });

    sesiones[sessionId] = { client, estado: 'inicializando' };

    let qrRespondido = false;

    client.on('qr', (qr) => {
        sesiones[sessionId].qr = qr;
        sesiones[sessionId].estado = 'esperando escaneo';
        logger.info(`QR generado para ${sessionId}`);
        if (!qrRespondido) {
            qrRespondido = true;
            res.json({ id: sessionId, qr });
        }
    });

    client.on('ready', async () => {
        try {
            if (!sesiones[sessionId]) return;
            sesiones[sessionId].estado = 'conectado';
            sesiones[sessionId].ani = `${client.info.wid.user}-${client.info.pushname}`;
            await prisma.sesion.upsert({
                where: { sessionId },
                update: { estado: 'conectado', ani: `${client.info.wid.user}-${client.info.pushname}` },
                create: { sessionId, estado: 'conectado', ani: `${client.info.wid.user}-${client.info.pushname}` }
            });
            logger.info(`Sesión ${sessionId} conectada como ${client.info.wid.user}`);
        } catch (error) {
            logger.error(`Error en client ready (${sessionId}): ${error.message}`);
        }
    });

    client.on('auth_failure', (msg) => {
        logger.warn(`Fallo de autenticación en ${sessionId}: ${msg}`);
    });

    client.on('disconnected', async () => {
        try {
            sesiones[sessionId].estado = 'desconectado';
            await prisma.sesion.update({
                where: { sessionId },
                data: { estado: 'desconectado' }
            });
            logger.info(`Sesión ${sessionId} desconectada.`);
        } catch (err) {
            logger.error(`Error al actualizar desconexión de ${sessionId}: ${err.message}`);
        }
    });

    try {
        await client.initialize();
    } catch (error) {
        logger.error(`Error al inicializar sesión ${sessionId}: ${error.message}`);
        res.status(500).json({ error: 'Error al conectar sesión.' });
    }
});

// ====================== ESTADO DE SESIONES ======================
app.get('/api/status', async (req, res) => {
    try {
        const estados = Object.entries(sesiones).map(([id, { estado, ani }]) => ({ id, estado, ani }));
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

                    // Eliminar el archivo CSV
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
        // Intentamos eliminar el archivo incluso si falla la campaña
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
    const { batchSize = 10, delayBetweenMessages = 1500, delayAfterBatch = 60000 } = config;

    const sesionesValidas = sessionIds.map(id => ({ id, sesion: sesiones[id] }))
        .filter(({ sesion }) => sesion && sesion.estado === 'conectado');

    if (sesionesValidas.length === 0) {
        return res.status(400).json({ error: 'Ninguna sesión válida o conectada.' });
    }

    // 🔁 Respondemos al cliente inmediatamente
    res.status(200).json({ mensaje: 'Envío iniciado en segundo plano' });

    // 🔧 Proceso asincrónico en segundo plano
    setImmediate(async () => {
        try {
            await prisma.campaña.update({ where: { id: campaña }, data: { estado: 'procesando' } });

            const camp = await prisma.campaña.findFirst({
                where: { id: campaña },
                include: { contactos: true }
            });
            if (!camp) return;

            const totalContactos = camp.contactos.length;
            const cantidadPorSesion = Math.ceil(totalContactos / sesionesValidas.length);
            const grupos = sesionesValidas.map(({ sesion }, i) => {
                const start = i * cantidadPorSesion;
                const end = start + cantidadPorSesion;
                return { sesion, contactos: camp.contactos.slice(start, end) };
            });

            for (const { sesion, contactos } of grupos) {
                const client = sesion.client;

                for (let i = 0; i < contactos.length; i++) {
                    const { numero, mensaje } = contactos[i];
                    const jid = numero + '@c.us';
                    const enviadoAt = new Date();

                    try {
                        const tieneWhatsapp = await client.isRegisteredUser(jid);
                        const estado = tieneWhatsapp ? 'enviado' : 'no_whatsapp';

                        if (tieneWhatsapp) await client.sendMessage(jid, mensaje);

                        await prisma.reporte.create({
                            data: { numero, mensaje, estado, enviadoAt, campañaId: camp.id }
                        });
                    } catch (err) {
                        await prisma.reporte.create({
                            data: { numero, mensaje, estado: 'error', enviadoAt, campañaId: camp.id }
                        });
                    }

                    const waitTime = ((i + 1) % batchSize === 0) ? delayAfterBatch : delayBetweenMessages;
                    await new Promise(r => setTimeout(r, waitTime));
                }
            }

            await prisma.campaña.update({
                where: { id: camp.id },
                data: { estado: 'finalizada', enviadoAt: new Date() }
            });
        } catch (error) {
            console.error('Error en el envío de mensajes en segundo plano:', error);
            await prisma.campaña.update({ where: { id: campaña }, data: { estado: 'pendiente' } });
        }
    });
});


// ====================== OBTENER REPORTES ======================
// backend/endpoints.js o donde tengas definido tu app
app.get('/api/reports', async (req, res) => {
    const { campañaId } = req.query;

    try {
        const where = campañaId ? { campañaId: Number(campañaId) } : {};

        const reportes = await prisma.reporte.findMany({
            where,
            include: { campaña: true }
        });

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

// ====================== OBTENER CAMPAÑAS PARA REPORTES ======================
app.get('/api/campanias-con-reportes', async (req, res) => {
    try {
        const reportes = await prisma.reporte.findMany({
            include: { campaña: true }
        });

        const campañasUnicas = Array.from(
            new Map(
                reportes
                    .filter(r => r.campaña !== null)
                    .map(r => [r.campaña.id, r.campaña])
            ).values()
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
        sesiones = {};
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
    const cliente = sesiones[id];

    if (!cliente) {
        logger.warn(`Consulta de estado para sesión no encontrada: ${id}`);
        return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    res.json({
        id,
        estado: cliente.estado,
        ani: cliente.ani
    });
});

// ====================== ELIMINAR CAMPAÑAS POR ID ======================

app.delete('/api/campanias/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const campaña = await prisma.campaña.findUnique({ where: { id: parseInt(id) } });

        if (!campaña) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }

        if (campaña.estado === 'procesando') {
            return res.status(400).json({ error: 'No se puede eliminar una campaña en proceso de envío' });
        }

        // Borramos contactos, pero NO los reportes
        await prisma.contacto.deleteMany({ where: { campañaId: campaña.id } });

        // Eliminamos la campaña manteniendo los reportes que referencian su nombre
        await prisma.campaña.update({
            where: { id: campaña.id },
            data: { archivada: true }
        });

        res.json({ message: 'Campaña eliminada con contactos. Reportes conservados.' });
    } catch (error) {
        console.error('Error al eliminar campaña:', error);
        res.status(500).json({ error: 'Error interno al eliminar campaña' });
    }
});

// ====================== RECUPERAR SESIONES ACTIVAS AL ARRANCAR ======================
async function cargarSesionesActivas() {
    try {
        const sesionesDB = await prisma.sesion.findMany({ where: { estado: 'conectado' } });

        for (const sesionDB of sesionesDB) {
            const sessionId = sesionDB.sessionId;

            const client = new Client({
                authStrategy: new LocalAuth({ clientId: sessionId }),
                puppeteer: { headless: true }
            });

            sesiones[sessionId] = { client, estado: 'conectando' };

            client.on('ready', async () => {
                sesiones[sessionId].estado = 'conectado';
                sesiones[sessionId].ani = `${client.info.wid.user}-${client.info.pushname}`;

                await prisma.sesion.update({
                    where: { sessionId },
                    data: { estado: 'conectado' }
                });
                logger.info(`Sesión ${sessionId} reconectada y lista.`);
            });

            client.on('auth_failure', () => {
                sesiones[sessionId].estado = 'fallo de autenticación';

                logger.warn(`Error de autenticación en sesión ${sessionId}`);
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
        }

        logger.info('Sesiones activas cargadas correctamente.');
    } catch (err) {
        logger.error(`Error cargando sesiones activas: ${err.message}`);
    }
}

cargarSesionesActivas();

app.listen(PORT, () => logger.info(`Servidor backend corriendo en http://localhost:${PORT}`));