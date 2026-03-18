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
// Aplica en métodos puntuales para anular el permiso de clase (solo requiere JWT)
export const SoloJwt = () => SetMetadata(PERMISO_KEY, null);

@Injectable()
export class PermisosGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const permiso = this.reflector.getAllAndOverride<string>(PERMISO_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
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
