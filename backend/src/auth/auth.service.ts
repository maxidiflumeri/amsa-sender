import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

@Injectable()
export class AuthService {
    constructor(private jwtService: JwtService, private prisma: PrismaService) { }

    async loginWithGoogle(idToken: string) {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload) throw new UnauthorizedException('Token inválido');

        const { email, name, picture } = payload;

        if (!email) throw new UnauthorizedException('No se pudo obtener el email de Google');
        if (!name)  throw new UnauthorizedException('No se pudo obtener el nombre del usuario');

        // Verificar que el usuario exista en el sistema (debe ser dado de alta por un admin)
        const usuarioExistente = await this.prisma.usuario.findUnique({
            where: { email },
            include: { rolObj: { select: { nombre: true, permisos: true } } },
        });

        if (!usuarioExistente) {
            throw new ForbiddenException(
                'No tenés acceso al sistema. Pedile al administrador que te dé de alta.',
            );
        }

        if (!usuarioExistente.activo) {
            throw new ForbiddenException('Tu cuenta está suspendida. Contactá al administrador.');
        }

        // Actualizar nombre y foto (solo si cambiaron)
        const usuario = await this.prisma.usuario.update({
            where: { email },
            data: { nombre: name, foto: picture },
            include: { rolObj: { select: { nombre: true, permisos: true } } },
        });

        const permisos: string[] = Array.isArray(usuario.rolObj?.permisos)
            ? (usuario.rolObj.permisos as string[])
            : [];

        const token = this.jwtService.sign(
            {
                sub: usuario.id,
                email: usuario.email,
                rol: usuario.rolObj?.nombre || usuario.rol,
                permisos,
            },
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '1d',
            },
        );

        return { access_token: token, usuario };
    }
}
