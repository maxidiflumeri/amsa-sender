const Handlebars = require('handlebars');
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../logger');
const colaEnvios = require('../queues/colaEnvios');

router.get('/:id/primer-contacto', async (req, res) => {
    const { id } = req.params;

    try {
        const contacto = await prisma.contacto.findFirst({
            where: {
                campañaId: Number(id),
                datos: {
                    not: null
                }
            },
            orderBy: { id: 'asc' },
            select: {
                numero: true,
                datos: true
            }
        });

        if (!contacto) {
            return res.status(404).json({ error: 'No se encontró un contacto con datos en esta campaña.' });
        }

        res.json(contacto);
    } catch (err) {
        console.error('Error obteniendo contacto:', err);
        res.status(500).json({ error: 'Error obteniendo contacto de ejemplo' });
    }
});

router.get('/:id/variables', async (req, res) => {
    const { id } = req.params;

    try {
        const contactos = await prisma.contacto.findMany({
            where: {
                campañaId: Number(id),
                datos: {
                    not: null
                }
            },
            select: {
                datos: true
            },
            take: 50
        });

        const variablesSet = new Set();

        contactos.forEach(c => {
            if (c.datos && typeof c.datos === 'object') {
                Object.keys(c.datos).forEach(k => variablesSet.add(k));
            }
        });

        res.json(Array.from(variablesSet));
    } catch (err) {
        console.error('Error obteniendo variables:', err);
        res.status(500).json({ error: 'Error obteniendo variables' });
    }
});

// Aplicar template a los contactos de una campaña
router.post('/:id/aplicar-template', async (req, res) => {
    const campañaId = parseInt(req.params.id);
    const { templateId } = req.body;

    if (!templateId) {
        return res.status(400).json({ error: 'Debe indicar un templateId' });
    }

    try {
        const template = await prisma.template.findUnique({ where: { id: templateId } });
        if (!template) {
            return res.status(404).json({ error: 'Template no encontrado' });
        }

        const campaña = await prisma.campaña.findUnique({
            where: { id: campañaId },
            include: { contactos: true }
        });

        if (!campaña) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }

        const compiled = Handlebars.compile(template.contenido);

        // Recorremos los contactos y generamos los mensajes
        const updates = campaña.contactos.map((contacto) => {
            const data = contacto.datos || {};
            let mensajeGenerado = '';

            try {
                mensajeGenerado = compiled(data);
            } catch (e) {
                mensajeGenerado = '[Error al generar mensaje: variables faltantes]';
            }

            return prisma.contacto.update({
                where: { id: contacto.id },
                data: { mensaje: mensajeGenerado }
            });
        });

        // Ejecutamos todos los updates
        await Promise.all(updates);

        // Guardamos el template en la campaña
        await prisma.campaña.update({
            where: { id: campañaId },
            data: { templateId }
        });

        res.json({ mensaje: 'Template aplicado correctamente a los contactos' });
    } catch (error) {
        console.error('Error al aplicar template:', error);
        res.status(500).json({ error: 'Error al aplicar template a la campaña' });
    }
});

router.post('/:id/agendar', async (req, res) => {
    const { id } = req.params;
    const { fechaAgenda, sessionIds, config } = req.body;

    if (!fechaAgenda) return res.status(400).json({ error: 'Fecha de agendado requerida' });

    try {
        const delay = Math.max(new Date(new Date(fechaAgenda)) - new Date(), 0);
        const job = await colaEnvios.add('enviar', { sessionIds, campaña: parseInt(id), config }, { delay });

        await prisma.campaña.update({
            where: { id: parseInt(id) },
            data: { agendadoAt: new Date(fechaAgenda), estado: 'programada', sesiones: JSON.stringify(sessionIds), config, jobId: job.id }
        });

        res.json({ ok: true, message: 'Campaña agendada correctamente' });
    } catch (err) {
        logger.error('Error al agendar campaña', err);
        res.status(500).json({ error: 'Error al agendar campaña' });
    }
});

// Obtener campañas
router.get('/', async (req, res) => {
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
router.get('/:id', async (req, res) => {
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

// Eliminar campaña por ID
router.delete('/:id', async (req, res) => {
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
router.post('/:id/pausar', async (req, res) => {
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
router.post('/:id/reanudar', async (req, res) => {
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

module.exports = router;