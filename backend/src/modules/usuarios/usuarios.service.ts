import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsuariosService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll() {
        return this.prisma.usuario.findMany({
            orderBy: { creadoAt: 'asc' },
            select: {
                id: true,
                email: true,
                nombre: true,
                foto: true,
                rol: true,
                rolId: true,
                activo: true,
                creadoAt: true,
                rolObj: { select: { id: true, nombre: true } },
            },
        });
    }

    async create(data: { email: string; nombre: string; rolId: number }) {
        const existe = await this.prisma.usuario.findUnique({ where: { email: data.email } });
        if (existe) throw new BadRequestException('Ya existe un usuario con ese email.');

        const rol = await this.prisma.rol.findUnique({ where: { id: data.rolId } });
        if (!rol) throw new NotFoundException('Rol no encontrado.');

        return this.prisma.usuario.create({
            data: {
                email: data.email.toLowerCase().trim(),
                nombre: data.nombre.trim(),
                rolId: data.rolId,
                rol: rol.nombre,
                activo: true,
                creadoAt: new Date(),
            },
        });
    }

    async update(id: number, data: { nombre?: string; rolId?: number; activo?: boolean }) {
        const usuario = await this.prisma.usuario.findUnique({ where: { id } });
        if (!usuario) throw new NotFoundException('Usuario no encontrado.');

        let rolNombre = usuario.rol;
        if (data.rolId !== undefined) {
            const rol = await this.prisma.rol.findUnique({ where: { id: data.rolId } });
            if (!rol) throw new NotFoundException('Rol no encontrado.');
            rolNombre = rol.nombre;
        }

        return this.prisma.usuario.update({
            where: { id },
            data: {
                ...(data.nombre !== undefined && { nombre: data.nombre.trim() }),
                ...(data.rolId !== undefined && { rolId: data.rolId, rol: rolNombre }),
                ...(data.activo !== undefined && { activo: data.activo }),
            },
            include: { rolObj: { select: { id: true, nombre: true } } },
        });
    }

    async remove(id: number, requesterId: number) {
        if (id === requesterId) {
            throw new BadRequestException('No podés eliminar tu propia cuenta.');
        }
        const usuario = await this.prisma.usuario.findUnique({ where: { id } });
        if (!usuario) throw new NotFoundException('Usuario no encontrado.');
        return this.prisma.usuario.delete({ where: { id } });
    }
}
