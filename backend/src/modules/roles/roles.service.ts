import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RolesService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll() {
        const roles = await this.prisma.rol.findMany({
            orderBy: { creadoAt: 'asc' },
            include: { _count: { select: { usuarios: true } } },
        });
        return roles.map(r => ({
            id: r.id,
            nombre: r.nombre,
            permisos: r.permisos as string[],
            creadoAt: r.creadoAt,
            cantidadUsuarios: r._count.usuarios,
        }));
    }

    async create(data: { nombre: string; permisos: string[] }) {
        return this.prisma.rol.create({
            data: { nombre: data.nombre.trim(), permisos: data.permisos },
        });
    }

    async update(id: number, data: { nombre?: string; permisos?: string[] }) {
        const rol = await this.prisma.rol.findUnique({ where: { id } });
        if (!rol) throw new NotFoundException('Rol no encontrado');
        return this.prisma.rol.update({
            where: { id },
            data: {
                ...(data.nombre !== undefined && { nombre: data.nombre.trim() }),
                ...(data.permisos !== undefined && { permisos: data.permisos }),
            },
        });
    }

    async remove(id: number) {
        const rol = await this.prisma.rol.findUnique({
            where: { id },
            include: { _count: { select: { usuarios: true } } },
        });
        if (!rol) throw new NotFoundException('Rol no encontrado');
        if (rol._count.usuarios > 0) {
            throw new BadRequestException(
                `No se puede eliminar: el rol tiene ${rol._count.usuarios} usuario(s) asignado(s).`,
            );
        }
        return this.prisma.rol.delete({ where: { id } });
    }
}
