import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateTemplateEmailDto } from './dtos/update-template-email.dto';

@Injectable()
export class TemplatesEmailService {
    constructor(private prisma: PrismaService) { }

    async crear(data: {
        nombre: string;
        asunto: string;
        html: string;
        design: any;
        creadoAt: Date;
        cuentaSmtpId?: number | null;
    }) {
        return this.prisma.templateEmail.create({ data });
    }

    async obtenerTodos(smtpId?: number) {
        const where = smtpId
            ? { OR: [{ cuentaSmtpId: smtpId }, { cuentaSmtpId: null }] }
            : {};
        return this.prisma.templateEmail.findMany({
            where,
            orderBy: { creadoAt: 'desc' },
            include: {
                cuentaSmtp: {
                    select: { id: true, nombre: true, emailFrom: true },
                },
            },
        });
    }

    async obtenerUno(id: number) {
        return this.prisma.templateEmail.findUnique({
            where: { id },
            include: {
                cuentaSmtp: {
                    select: { id: true, nombre: true, emailFrom: true },
                },
            },
        });
    }

    async update(id: number, data: UpdateTemplateEmailDto) {
        return this.prisma.templateEmail.update({
            where: { id },
            data,
        });
    }

    async eliminarTemplate(id: number) {
        try {
            await this.prisma.templateEmail.delete({ where: { id } });
            return { mensaje: 'Template eliminado' };
        } catch (error) {
            throw new NotFoundException(`Template con ID ${id} no encontrado`);
        }
    }
}
