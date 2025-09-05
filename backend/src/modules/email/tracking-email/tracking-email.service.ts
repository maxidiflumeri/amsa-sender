import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UAParser } from 'ua-parser-js';

function getClientIp(req: any): string | undefined {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || (req.headers['x-real-ip'] as string)
        || req.socket?.remoteAddress;
}

function clasificarDispositivo(ua: UAParser.IResult): string {
    const t = ua.device?.type; // 'mobile' | 'tablet' | etc.
    if (!t) return 'Desktop';
    if (t === 'mobile') return 'GenericPhone';
    if (t === 'tablet') return 'Tablet';
    return 'Desktop';
}

function safeHostname(destino: string): string | undefined {
    try { return new URL(destino).hostname; } catch { return undefined; }
}

@Injectable()
export class TrackingEmailService {
    constructor(private prisma: PrismaService) { }

    private async tokenToReporte(token: string) {
        return this.prisma.reporteEmail.findUnique({
            where: { trackingTok: token },
            select: { id: true, primeroAbiertoAt: true, primeroClickAt: true },
        });
    }

    async registrarOpen(token: string, req: any) {
        const rep = await this.tokenToReporte(token);
        if (!rep) return;

        const uaRaw = (req.headers['user-agent'] as string) || '';
        const parsed = new UAParser(uaRaw).getResult();

        await this.prisma.emailEvento.create({
            data: {
                reporteId: rep.id,
                tipo: 'OPEN',
                ip: getClientIp(req),
                userAgent: uaRaw,
                uaRaw,
                deviceFamily: clasificarDispositivo(parsed),
                osName: parsed.os?.name,
                osVersion: parsed.os?.version,
                browserName: parsed.browser?.name,
                browserVersion: parsed.browser?.version,
            },
        });

        if (!rep.primeroAbiertoAt) {
            await this.prisma.reporteEmail.update({
                where: { id: rep.id },
                data: { primeroAbiertoAt: new Date() },
            });
        }
    }

    async registrarClick(token: string, destino: string, req: any) {
        const rep = await this.tokenToReporte(token);
        if (!rep) return;

        const uaRaw = (req.headers['user-agent'] as string) || '';
        const parsed = new UAParser(uaRaw).getResult();

        await this.prisma.emailEvento.create({
            data: {
                reporteId: rep.id,
                tipo: 'CLICK',
                urlDestino: destino,
                dominioDestino: safeHostname(destino),
                ip: getClientIp(req),
                userAgent: uaRaw,
                uaRaw,
                deviceFamily: clasificarDispositivo(parsed),
                osName: parsed.os?.name,
                osVersion: parsed.os?.version,
                browserName: parsed.browser?.name,
                browserVersion: parsed.browser?.version,
            },
        });

        if (!rep.primeroClickAt) {
            await this.prisma.reporteEmail.update({
                where: { id: rep.id },
                data: { primeroClickAt: new Date() },
            });
        }
    }
}