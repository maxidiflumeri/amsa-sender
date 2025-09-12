import { Injectable, UnauthorizedException } from '@nestjs/common';
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

        if (!email) {
            throw new UnauthorizedException('No se pudo obtener el email de Google');
        }

        if (!name) {
            throw new UnauthorizedException('No se pudo obtener el nombre del usuario');
        }

        const emailPermitido = email.endsWith('@anamayasa.com.ar') || email === 'maxidiflumeri@gmail.com';

        if (!emailPermitido) {
            throw new UnauthorizedException('Solo se permiten cuentas autorizadas');
        }

        const usuario = await this.prisma.usuario.upsert({
            where: { email },
            update: { nombre: name, foto: picture },
            create: { email, nombre: name, foto: picture, creadoAt: new Date() },
        });

        const token = this.jwtService.sign(
            {
                sub: usuario.id,
                email: usuario.email,
                rol: usuario.rol,
            },
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '1d', // acá le aplicás la duración del token
            }
        );

        return { access_token: token, usuario };
    }
}