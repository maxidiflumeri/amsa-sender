import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as Handlebars from 'handlebars';
import { Prisma } from '@prisma/client';

@Injectable()
export class TemplatesService {
    private readonly logger = new Logger(TemplatesService.name);

    constructor(private readonly prisma: PrismaService) { }

    async previewTemplate(data: { templateId?: number; contenido?: string; ejemplo: any }) {
        const { templateId, contenido, ejemplo } = data;

        if (!ejemplo || typeof ejemplo !== 'object') {
            throw new Error('Debe enviar un objeto ejemplo válido');
        }

        let contenidoTemplate = contenido;

        if (templateId) {
            const template = await this.prisma.template.findUnique({ where: { id: templateId } });
            if (!template) throw new Error('Template no encontrado');
            contenidoTemplate = template.contenido;
        }

        if (!contenidoTemplate || typeof contenidoTemplate !== 'string') {
            throw new Error('Falta el contenido del template');
        }

        const compiled = Handlebars.compile(contenidoTemplate);
        return { mensaje: compiled(ejemplo) };
    }

    async previewReal(body: any) {
        const { templateId, campañaId } = body
        const template = await this.prisma.template.findUnique({ where: { id: templateId } });
        if (!template) throw new Error('Template no encontrado');

        const contacto = await this.prisma.contacto.findFirst({
            where: { campañaId, datos: { not: Prisma.JsonNull } },
            orderBy: { id: 'asc' },
        });

        if (!contacto || !contacto.datos) {
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
        const { nombre, contenido } = body
        return this.prisma.template.create({ data: { nombre, contenido } });
    }

    async listarTemplates() {
        return this.prisma.template.findMany({ orderBy: { createdAt: 'desc' } });
    }

    async eliminarTemplate(id: number) {
        await this.prisma.template.delete({ where: { id } });
        return { mensaje: 'Template eliminado' };
    }

    async editarTemplate(id: number, body: any) {
        const { nombre, contenido } = body
        return this.prisma.template.update({
            where: { id },
            data: { nombre, contenido },
        });
    }
}