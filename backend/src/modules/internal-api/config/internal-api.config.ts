import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { InternalApiKeyEntry } from './internal-api.types';

@Injectable()
export class InternalApiConfig implements OnModuleInit {
    private readonly logger = new Logger(InternalApiConfig.name);
    private keys: InternalApiKeyEntry[] = [];
    private allowedIps: string[] = [];

    onModuleInit() {
        this.loadKeys();
        this.loadAllowedIps();
    }

    private loadKeys() {
        const raw = process.env.INTERNAL_API_KEYS;
        if (!raw) {
            this.logger.warn('INTERNAL_API_KEYS no está definido. La API interna rechazará todas las llamadas.');
            this.keys = [];
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) throw new Error('INTERNAL_API_KEYS debe ser un array JSON.');
            this.keys = parsed
                .filter((e: any) => e && typeof e.id === 'string' && typeof e.key === 'string' && typeof e.serviceUserId === 'number')
                .map((e: any) => ({
                    id: e.id,
                    key: e.key,
                    label: e.label ?? e.id,
                    serviceUserId: e.serviceUserId,
                    scopes: Array.isArray(e.scopes) ? e.scopes : [],
                }));
            this.logger.log(`✅ INTERNAL_API_KEYS cargado: ${this.keys.length} key(s) [${this.keys.map(k => k.id).join(', ')}]`);
        } catch (err: any) {
            this.logger.error(`No se pudo parsear INTERNAL_API_KEYS: ${err.message}. La API interna rechazará todas las llamadas.`);
            this.keys = [];
        }
    }

    private loadAllowedIps() {
        const raw = process.env.INTERNAL_API_ALLOWED_IPS;
        if (!raw) {
            this.allowedIps = [];
            return;
        }
        this.allowedIps = raw.split(',').map(s => s.trim()).filter(Boolean);
        if (this.allowedIps.length > 0) {
            this.logger.log(`🔒 INTERNAL_API_ALLOWED_IPS activo: [${this.allowedIps.join(', ')}]`);
        }
    }

    findByKey(key: string): InternalApiKeyEntry | null {
        if (!key) return null;
        return this.keys.find(k => k.key === key) ?? null;
    }

    getAllowedIps(): string[] {
        return this.allowedIps;
    }

    isIpAllowed(ip: string | undefined): boolean {
        if (this.allowedIps.length === 0) return true;
        if (!ip) return false;
        return this.allowedIps.includes(ip);
    }
}
