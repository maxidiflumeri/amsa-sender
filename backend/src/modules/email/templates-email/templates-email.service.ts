import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

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
}