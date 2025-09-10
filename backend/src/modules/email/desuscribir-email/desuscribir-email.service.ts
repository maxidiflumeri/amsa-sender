// mailing/unsubscribes.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashEmail, normalizeEmail } from 'src/common/email-normalize.common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EmailDesuscribirService {
    constructor(private prisma: PrismaService, private jwt: JwtService) { }

    async add(
        tenantId: string,
        email: string,
        scope: 'global' | 'campaign' = 'global',
        campaignId?: string | number,
        reason?: string,
        source?: string,
    ) {
        try {
            const original = email;
            const normalized = normalizeEmail(original);
            const emailHash = hashEmail(normalized);

            // Normalización consistente
            let s: 'global' | 'campaign' = scope;
            let c = (campaignId ?? '').toString().trim();

            if (c) s = 'campaign';
            else { s = 'global'; c = ''; }

            console.log({ tenantId, email, emailHash, scope: s, campaignId: c, reason, source });

            return await this.prisma.emailDesuscripciones.upsert({
                where: {
                    tenantId_emailHash_scope_campaignId: {
                        tenantId,
                        emailHash,
                        scope: s,
                        campaignId: c,
                    },
                },
                create: {
                    tenantId,
                    email: original,
                    emailHash,
                    scope: s,
                    campaignId: c,
                    reason,
                    source,
                },
                update: { reason, source },
            });
        } catch (error: any) {
            console.error('Unsubscribe upsert error:', {
                message: error?.message,
                code: error?.code,
                meta: error?.meta,
            });
            throw error;
        }
    }

    async remove(tenantId: string, id: string) {
        // Opcional: validar pertenencia al tenant
        return this.prisma.emailDesuscripciones.delete({ where: { id } });
    }

    async clearAll(tenantId: string) {
        return this.prisma.emailDesuscripciones.deleteMany({ where: { tenantId } });
    }

    async list(tenantId: string, page = 0, size = 25, q?: string) {
        const where: any = { tenantId };
        if (q?.trim()) where.email = { contains: q.trim() }; // ← sin mode

        const [items, total] = await Promise.all([
            this.prisma.emailDesuscripciones.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: page * size,
                take: size,
            }),
            this.prisma.emailDesuscripciones.count({ where }),
        ]);
        return { items, total, page, size };
    }

    // Token para URL pública
    signUnsubToken(payload: { tenantId: string; email: string; campaignId?: string; scope?: 'global' | 'campaign' }) {
        return this.jwt.sign(payload, { expiresIn: '30d' });
    }

    verifyUnsubToken(token: string) {
        return this.jwt.verify(token); // manejar try/catch en controller
    }
}