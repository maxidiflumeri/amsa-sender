import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const PERMISO_KEY = 'permiso';
export const RequiredPermiso = (permiso: string) => SetMetadata(PERMISO_KEY, permiso);

@Injectable()
export class PermisosGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const permiso = this.reflector.get<string>(PERMISO_KEY, context.getHandler());
        if (!permiso) return true;

        const request = context.switchToHttp().getRequest();
        const usuario = request['usuario'];
        const permisos: string[] = usuario?.permisos ?? [];

        if (!permisos.includes(permiso)) {
            throw new ForbiddenException('No tenés permiso para realizar esta acción.');
        }
        return true;
    }
}
