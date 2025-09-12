import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as Handlebars from 'handlebars';
import { Prisma } from '@prisma/client';

@Injectable()
export class TemplatesService {
    private readonly logger = new Logger(TemplatesService.name);

    constructor(private readonly prisma: PrismaService) { }

    async previewTemplate(data: { templateId?: number; contenido?: string; ejemplo: any }) {
        const { templateId, contenido, ejemplo } = data;
        this.logger.log(`🧪 Generando vista previa de template${templateId ? ` (ID ${templateId})` : ''}`);

        if (!ejemplo || typeof ejemplo !== 'object') {
            this.logger.warn('❌ Ejemplo inválido recibido en preview');
            throw new Error('Debe enviar un objeto ejemplo válido');
        }

        let contenidoTemplate = contenido;

        if (templateId) {
            const template = await this.prisma.template.findUnique({ where: { id: templateId } });
            if (!template) {
                this.logger.warn(`⚠️ Template ${templateId} no encontrado`);
                throw new Error('Template no encontrado');
            }
            contenidoTemplate = template.contenido;
        }

        if (!contenidoTemplate || typeof contenidoTemplate !== 'string') {
            this.logger.warn(`⚠️ Contenido de template vacío o inválido`);
            throw new Error('Falta el contenido del template');
        }

        const compiled = Handlebars.compile(contenidoTemplate);
        return { mensaje: compiled(ejemplo) };
    }

    async previewReal(body: any) {
        const { templateId, campañaId } = body;
        this.logger.log(`🔍 Generando preview real para template ${templateId} y campaña ${campañaId}`);

        const template = await this.prisma.template.findUnique({ where: { id: templateId } });
        if (!template) {
            this.logger.warn(`⚠️ Template ${templateId} no encontrado`);
            throw new Error('Template no encontrado');
        }

        const contacto = await this.prisma.contacto.findFirst({
            where: { campañaId, datos: { not: Prisma.JsonNull } },
            orderBy: { id: 'asc' },
        });

        if (!contacto || !contacto.datos) {
            this.logger.warn(`⚠️ No se encontró un contacto válido con datos en campaña ${campañaId}`);
            throw new Error('No se encontró un contacto válido con datos');
        }

        const compiled = Handlebars.compile(template.contenido);
        return {
            mensaje: compiled(contacto.datos),
            contacto: {
                numero: contacto.numero,
                datos: contacto.datos,
            },
        };
    }

    async crearTemplate(body: any) {
        const { nombre, contenido } = body;
        this.logger.log(`📝 Creando template: ${nombre}`);
        const nuevo = await this.prisma.template.create({ data: { nombre, contenido, createdAt: new Date() } });
        this.logger.log(`✅ Template creado con ID: ${nuevo.id}`);
        return nuevo;
    }

    async listarTemplates() {
        this.logger.log('📄 Listando todos los templates');
        const templates = await this.prisma.template.findMany({ orderBy: { createdAt: 'desc' } });
        this.logger.log(`✅ ${templates.length} templates encontrados`);
        return templates;
    }

    async eliminarTemplate(id: number) {
        this.logger.log(`🗑️ Eliminando template ID: ${id}`);
        await this.prisma.template.delete({ where: { id } });
        this.logger.log(`✅ Template ${id} eliminado`);
        return { mensaje: 'Template eliminado' };
    }

    async editarTemplate(id: number, body: any) {
        const { nombre, contenido } = body;
        this.logger.log(`✏️ Editando template ${id} → Nuevo nombre: ${nombre}`);
        const actualizado = await this.prisma.template.update({
            where: { id },
            data: { nombre, contenido },
        });
        this.logger.log(`✅ Template ${id} actualizado`);
        return actualizado;
    }
}