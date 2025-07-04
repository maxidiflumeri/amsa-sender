// src/auth/jwt-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private jwtService: JwtService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<Request>();
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Falta el token');
        }

        const token = authHeader.split(' ')[1];

        try {
            const payload = await this.jwtService.verifyAsync(token);
            req['usuario'] = payload; // Podés acceder a esto luego en el controller
            return true;
        } catch (err) {
            throw new UnauthorizedException('Token inválido o expirado');
        }
    }
}