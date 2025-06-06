const Handlebars = require('handlebars');
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

module.exports = router;