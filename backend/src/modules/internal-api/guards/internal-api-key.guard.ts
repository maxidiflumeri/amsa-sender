import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { InternalApiConfig } from '../config/internal-api.config';
import type { InternalActor } from '../config/internal-api.types';
import { INTERNAL_SCOPE_KEY } from '../decorators/internal-scope.decorator';

const HEADER_NAME = 'x-internal-api-key';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
    private readonly logger = new Logger(InternalApiKeyGuard.name);

    constructor(
        private readonly config: InternalApiConfig,
        private readonly reflector: Reflector,
    ) { }

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<Request>();
        const remoteIp = (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '');

        if (!this.config.isIpAllowed(remoteIp)) {
            this.logger.warn(`internal-api: IP ${remoteIp} no permitida`);
            throw new ForbiddenException('IP no permitida para la API interna.');
        }

        const headerVal = req.headers[HEADER_NAME];
        const key = Array.isArray(headerVal) ? headerVal[0] : headerVal;
        if (!key) {
            throw new UnauthorizedException('Falta header X-Internal-Api-Key.');
        }

        const entry = this.config.findByKey(key);
        if (!entry) {
            this.logger.warn(`internal-api: key inválida (ip=${remoteIp})`);
            throw new UnauthorizedException('API key interna inválida.');
        }

        const requiredScope = this.reflector.getAllAndOverride<string | undefined>(INTERNAL_SCOPE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (requiredScope) {
            const scopes = entry.scopes ?? [];
            const ok = scopes.includes('*') || scopes.includes(requiredScope) || this.matchWildcardScope(scopes, requiredScope);
            if (!ok) {
                this.logger.warn(`internal-api: keyId=${entry.id} no tiene scope=${requiredScope}`);
                throw new ForbiddenException(`API key sin scope requerido (${requiredScope}).`);
            }
        }

        const actor: InternalActor = {
            keyId: entry.id,
            label: entry.label,
            serviceUserId: entry.serviceUserId,
            scopes: entry.scopes ?? [],
        };
        (req as any).internalActor = actor;

        this.logger.debug(`internal-api: ${req.method} ${req.path} keyId=${entry.id} ip=${remoteIp}`);
        return true;
    }

    private matchWildcardScope(scopes: string[], required: string): boolean {
        const [feature] = required.split(':');
        return scopes.includes(`${feature}:*`);
    }
}
