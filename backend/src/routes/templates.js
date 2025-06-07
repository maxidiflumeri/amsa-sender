const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Handlebars = require('handlebars');

router.post('/preview', async (req, res) => {
    const { templateId, contenido, ejemplo } = req.body;

    if (!ejemplo || typeof ejemplo !== 'object') {
        return res.status(400).json({ error: 'Debe enviar un objeto ejemplo válido' });
    }

    try {
        let contenidoTemplate = contenido;

        if (templateId) {
            const template = await prisma.template.findUnique({ where: { id: templateId } });
            if (!template) {
                return res.status(404).json({ error: 'Template no encontrado' });
            }
            contenidoTemplate = template.contenido;
        }

        if (!contenidoTemplate || typeof contenidoTemplate !== 'string') {
            return res.status(400).json({ error: 'Falta el contenido del template' });
        }

        const compiled = Handlebars.compile(contenidoTemplate);
        const mensaje = compiled(ejemplo);

        res.json({ mensaje });
    } catch (error) {
        console.error('Error generando vista previa del template:', error.message);
        res.status(500).json({ error: 'Error al generar la vista previa del template' });
    }
});

router.post('/preview-real', async (req, res) => {
    const { templateId, campañaId } = req.body;

    if (!templateId || !campañaId) {
        return res.status(400).json({ error: 'templateId y campañaId son obligatorios' });
    }

    try {
        const template = await prisma.template.findUnique({
            where: { id: templateId }
        });

        if (!template) {
            return res.status(404).json({ error: 'Template no encontrado' });
        }

        const contacto = await prisma.contacto.findFirst({
            where: {
                campañaId: campañaId,
                datos: {
                    not: null
                }
            },
            orderBy: { id: 'asc' }
        });

        if (!contacto || !contacto.datos) {
            return res.status(404).json({ error: 'No se encontró un contacto válido con datos' });
        }

        const compiled = Handlebars.compile(template.contenido);
        const mensaje = compiled(contacto.datos);

        res.json({
            mensaje,
            contacto: {
                numero: contacto.numero,
                datos: contacto.datos
            }
        });
    } catch (error) {
        console.error('Error en preview-real:', error);
        res.status(500).json({ error: 'Error generando preview real' });
    }
});

// Crear un nuevo template
router.post('/', async (req, res) => {
    const { nombre, contenido } = req.body;

    if (!nombre || !contenido) {
        return res.status(400).json({ error: 'Nombre y contenido son obligatorios' });
    }

    try {
        const nuevoTemplate = await prisma.template.create({
            data: { nombre, contenido }
        });
        res.json(nuevoTemplate);
    } catch (error) {
        console.error('Error al crear template:', error);
        res.status(500).json({ error: 'Error al crear template' });
    }
});

// Listar todos los templates
router.get('/', async (req, res) => {
    try {
        const templates = await prisma.template.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(templates);
    } catch (error) {
        console.error('Error al listar templates:', error);
        res.status(500).json({ error: 'Error al obtener templates' });
    }
});

// Eliminar un template por ID
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.template.delete({
            where: { id: parseInt(id) }
        });
        res.json({ mensaje: 'Template eliminado' });
    } catch (error) {
        console.error('Error al eliminar template:', error);
        res.status(500).json({ error: 'Error al eliminar template' });
    }
});

// Editar un template por ID
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, contenido } = req.body;

    if (!nombre || !contenido) {
        return res.status(400).json({ error: 'Nombre y contenido son obligatorios' });
    }

    try {
        const templateActualizado = await prisma.template.update({
            where: { id: parseInt(id) },
            data: { nombre, contenido }
        });

        res.json(templateActualizado);
    } catch (error) {
        console.error('Error al editar template:', error);
        res.status(500).json({ error: 'Error al editar el template' });
    }
});

module.exports = router;