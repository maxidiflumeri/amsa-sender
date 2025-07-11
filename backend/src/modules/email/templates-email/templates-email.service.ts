import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateTemplateEmailDto } from './dtos/update-template-email.dto';

@Injectable()
export class TemplatesEmailService {
    constructor(private prisma: PrismaService) { }

    async crear(data: Prisma.TemplateEmailCreateInput) {
        return this.prisma.templateEmail.create({ data });
    }

    async obtenerTodos() {
        return this.prisma.templateEmail.findMany({
            orderBy: { creadoAt: 'desc' }
        });
    }

    async obtenerUno(id: number) {
        return this.prisma.templateEmail.findUnique({ where: { id } });
    }

    // template-email.service.ts
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