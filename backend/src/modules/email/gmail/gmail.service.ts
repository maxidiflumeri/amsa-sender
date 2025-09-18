// src/gmail/gmail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { simpleParser, ParsedMail } from 'mailparser';
import * as fs from 'fs/promises';
import { PrismaService } from 'src/prisma/prisma.service';

type BounceInfo = {
    recipient: string | null;            // correo que rebotó
    code: string | null;                 // 5.1.1 / 550 / 4.2.2 / etc.
    type: 'hard' | 'soft' | 'unknown';
    reason: string | null;               // Diagnostic-Code o similar
    subject: string | null;

    // NUEVO: correlación
    originalMessageId: string | null;    // Message-ID del mail ORIGINAL enviado por vos
    xAmsaSender: string | null;          // valor del header/marcador X-AMSASender (si vino)
    originalHeaders: string | null;      // headers del original (si vino adjunto message/rfc822)
    originalBodyQuoted: string | null;   // cuerpo quoteado (si vino en texto/HTML)
    messageId: string | null;            // Message-ID del NDR (rebote) recibido
    receivedAt: Date;
    rawSnippet: string | null;           // para debug (texto del bounce)
    dsnText: string | null;              // cuerpo del delivery-status (si vino)
};



@Injectable()
export class GmailService {
    private readonly logger = new Logger(GmailService.name);
    private oauth2!: OAuth2Client;

    private clientId = process.env.GOOGLE_CLIENT_ID!;
    private clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    private redirectUri = process.env.GOOGLE_REDIRECT_URI!;
    private tokenPath = process.env.GMAIL_TOKEN_PATH || './gmail.token.rebotes.json';
    private bounceAddress = process.env.GMAIL_BOUNCE_ADDRESS!;
    private processedLabelName = process.env.GMAIL_LABEL_PROCESSED || 'Bounces-Processed';
    private processedLabelId: string | null = null;

    constructor(private readonly prisma: PrismaService) {
        this.oauth2 = new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
        // Intentar cargar tokens al iniciar (si existen)
        this.loadTokens().catch(() => { });
    }

    private parseAmsaHeader(value?: string) {
        if (!value) return null;
        const rid = value.match(/rid=(\d+)/i)?.[1];
        const msgid = value.match(/msgid=([^;]+)\b/i)?.[1]?.trim();
        const to = value.match(/to=([^;]+)\b/i)?.[1]?.trim();
        const sig = value.match(/sig=([A-Za-z0-9\-_]+)/i)?.[1]?.trim();
        if (!rid && !msgid && !to) return null;
        return {
            reporteId: rid ? Number(rid) : null,
            messageId: msgid || null,
            to: to || null,
            sig: sig || null,
        };
    }

    /** Convierte headerLines a string legible */
    private stringifyHeaderLines(lines: { key: string; line: string }[] | undefined) {
        if (!lines || !lines.length) return null;
        return lines.map(l => l.line).join('\n');
    }

    // --- OAuth helpers ---
    getAuthUrl() {
        const url = this.oauth2.generateAuthUrl({
            access_type: 'offline',           // refresh_token
            prompt: 'consent',                // fuerza refresh la 1ra vez
            scope: [
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.modify', // etiquetar/mover
            ],
        });
        return { url };
    }

    async exchangeCodeForTokens(code: string) {
        const { tokens } = await this.oauth2.getToken(code);
        this.oauth2.setCredentials(tokens);
        await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
    }

    private async loadTokens() {
        const raw = await fs.readFile(this.tokenPath, 'utf8');
        const tokens = JSON.parse(raw);
        this.oauth2.setCredentials(tokens);
    }

    private gmail() {
        return google.gmail({ version: 'v1', auth: this.oauth2 });
    }

    // --- Labels ---

    private async ensureProcessedLabel(): Promise<string> {
        if (this.processedLabelId) return this.processedLabelId;
        const g = this.gmail();
        const list = await g.users.labels.list({ userId: 'me' });
        const found = (list.data.labels || []).find(l => l.name === this.processedLabelName);
        if (found?.id) {
            this.processedLabelId = found.id;
            return found.id;
        }
        const created = await g.users.labels.create({
            userId: 'me',
            requestBody: {
                name: this.processedLabelName,
                labelListVisibility: 'labelShow',
                messageListVisibility: 'show',
            },
        });
        this.processedLabelId = created.data.id!;
        return this.processedLabelId;
    }

    // --- Query de búsqueda (ajustable) ---

    private buildQuery() {
        // is:unread para no reprocesar; limitamos por remitente/asunto
        return [
            '(from:"Mail Delivery Subsystem" OR subject:("Delivery Status Notification" OR "Delivery incomplete" OR "Undelivered Mail Returned to Sender"))',
            'is:unread',
            'newer_than:7d',
        ].join(' ');
    }

    // --- Parseo de un mensaje ---

    private async readAndParse(id: string): Promise<BounceInfo | null> {
        const g = this.gmail();
        const full = await g.users.messages.get({ userId: 'me', id, format: 'raw' });
        const raw = Buffer.from(full.data.raw!, 'base64');
        const mail: ParsedMail = await simpleParser(raw);
        return this.extractBounceInfo(mail);
    }

    private extractBounceInfo = async (mail: ParsedMail): Promise<BounceInfo | null> => {
        const subject = mail.subject || '';
        const text = (mail.text || '').replace(/\r/g, '');
        const headers = mail.headers;

        const failed = (headers.get('x-failed-recipients') as string) || '';

        // --- delivery-status si viene como adjunto ---
        const dsPart = mail.attachments?.find(a => /delivery-status/i.test(a.contentType));
        let statusCode = '';
        let finalRecipient = '';
        let dsnText: string | null = null;

        if (dsPart) {
            const body = dsPart.content.toString();
            dsnText = body;
            finalRecipient = (body.match(/Final-Recipient:\s*[^\s;]+;\s*([^\s\r\n]+)/i)?.[1]) || '';
            statusCode = (body.match(/Status:\s*([245]\.\d+\.\d+)/i)?.[1]) || '';
        } else {
            // ⭐️ NUEVO: si no vino adjunto, usamos el propio cuerpo como DSN “texto”
            dsnText = text || null;
        }

        // --- intentar abrir el original (message/rfc822) ---
        const rfc822 = mail.attachments?.find(a => /message\/rfc822/i.test(a.contentType));
        let originalMessageId: string | null = null;
        let originalHeaders: string | null = null;
        let originalBodyQuoted: string | null = null;
        let xAmsaSender: string | null = null;

        if (rfc822) {
            try {
                const inner = await simpleParser(rfc822.content);
                originalMessageId = inner.messageId || null;
                xAmsaSender = (inner.headers.get('x-amsasender') as string) || null;
                originalHeaders = this.stringifyHeaderLines(inner.headerLines as any);
                const innerText = (inner.text || '').replace(/\r/g, '');
                const innerHtml = inner.html ? (typeof inner.html === 'string' ? inner.html : '') : '';
                const markerFromText = innerText.match(/X-AMSASender:\s*([^\r\n<]+)/i)?.[1] || null;
                const markerFromHtml = innerHtml.match(/X-AMSASender:\s*([^<]+)/i)?.[1]?.trim() || null;
                if (!xAmsaSender) xAmsaSender = markerFromText || markerFromHtml || null;
                originalBodyQuoted = innerText || null;
            } catch {
                // ignore
            }
        } else {
            const markerFromText = text.match(/X-AMSASender:\s*([^\r\n<]+)/i)?.[1] || null;
            if (markerFromText) xAmsaSender = markerFromText;
            const headersBlockMatch = text.match(/(?:Original message headers|Message headers):\s*\n([\s\S]+?)\n{2,}/i);
            if (headersBlockMatch) originalHeaders = headersBlockMatch[1];
            originalBodyQuoted = null;
        }

        // ⭐️ NUEVO: Fallback específico de Gmail: X-Original-Message-ID en el cuerpo del DSN
        if (!originalMessageId) {
            // a) a veces viene como header del DSN
            const xOrigHdr = (headers.get('x-original-message-id') as string) || null;
            // b) y casi siempre como línea dentro del texto
            const xOrigInText =
                text.match(/^\s*X-Original-Message-ID:\s*(<[^>\r\n]+>)/im)?.[1] ||
                text.match(/^\s*X-Original-Message-ID:\s*([^\s\r\n]+)/im)?.[1] ||
                null;

            originalMessageId = xOrigHdr || xOrigInText || null;
        }

        const code =
            statusCode ||
            (text.match(/(\b[245]\.\d+\.\d+\b)/)?.[1]) ||
            (text.match(/\b(5\d{2}|4\d{2})\b/)?.[1]) ||
            null;

        const recipient =
            finalRecipient ||
            failed ||
            (text.match(/(?:user|account|recipient|address)\s+([^\s<>"]+@[^\s<>"]+)/i)?.[1]) ||
            (subject.match(/([^\s<>"]+@[^\s<>"]+)/)?.[1]) ||
            null;

        if (!recipient && !code) return null;

        const hard = code ? /^5(\.|\d)/.test(code) || /^5\d{2}$/.test(code) : false;
        const soft = code ? /^4(\.|\d)/.test(code) || /^4\d{2}$/.test(code) : false;

        const reason =
            (text.match(/Diagnostic-Code:\s*([^\n]+)/i)?.[1]) ||
            (text.match(/The response was:\s*([^\n]+)/i)?.[1]) ||
            null;

        return {
            recipient: recipient || null,
            code,
            type: hard ? 'hard' : (soft ? 'soft' : 'unknown'),
            reason,
            subject: subject || null,

            // devuelvo todo lo útil para correlación
            originalMessageId,
            xAmsaSender,
            originalHeaders,
            originalBodyQuoted,
            dsnText,

            messageId: mail.messageId || null,
            receivedAt: mail.date || new Date(),
            rawSnippet: text ? text.slice(0, 2000) : null,
        };
    };

    private async markProcessed(id: string) {
        const g = this.gmail();
        const labelId = await this.ensureProcessedLabel();
        await g.users.messages.modify({
            userId: 'me',
            id,
            requestBody: {
                addLabelIds: [labelId],
                removeLabelIds: ['UNREAD'],
            },
        });
    }

    // --- Una pasada de lectura (cron/endpoint manual) ---

    async pollBouncesOnce(): Promise<BounceInfo[]> {
        const g = this.gmail();
        const q = this.buildQuery();
        const { data } = await g.users.messages.list({ userId: 'me', q, maxResults: 50 });
        const ids = data.messages?.map(m => m.id) ?? [];

        const results: BounceInfo[] = [];
        for (const id of ids) {
            try {
                const parsed = await this.readAndParse(id!!);
                if (parsed) {
                    // 1) Intento por X-AMSASender (rid=...)
                    let reporteId: number | null = null;
                    let smtpMessageId: string | null = parsed.originalMessageId || null;
                    let xAmsaSender: string | null = parsed.xAmsaSender || null;
                    let correo: string | null = parsed.recipient || null;
                    
                    if (xAmsaSender) {
                        const amsa = this.parseAmsaHeader(xAmsaSender);                    
                        if (amsa?.reporteId) reporteId = amsa.reporteId;
                        if (!smtpMessageId && amsa?.messageId) smtpMessageId = amsa.messageId;
                        if (!correo && amsa?.to) correo = amsa.to;
                    }

                    // 2) Fallback por Message-ID del original → ReporteEmail.smtpMessageId                    
                    if (!reporteId && smtpMessageId) {
                        const rep = await this.prisma.reporteEmail.findUnique({
                            where: { smtpMessageId },
                            select: { id: true },
                        });
                        if (rep) reporteId = rep.id;
                    }

                    const correlation =
                        xAmsaSender && this.parseAmsaHeader(xAmsaSender)?.reporteId ? 'by_header' :
                            (reporteId ? 'by_message_id' : 'none');

                    this.logger.log(`Bounce -> correo=${correo ?? '-'} code=${parsed.code ?? '-'} corr=${correlation} repId=${reporteId ?? '-'}`);

                    // 3) Guardar rebote (con campos nuevos)
                    await this.prisma.emailRebote.create({
                        data: {
                            reporteId,
                            fecha: parsed.receivedAt,
                            codigo: parsed.code ?? null,
                            descripcion: parsed.reason ?? parsed.subject ?? null,
                            raw: parsed.rawSnippet ?? null,

                            // NUEVO
                            correo: correo,
                            smtpMessageId: smtpMessageId,
                            xAmsaSender: xAmsaSender,
                        },
                    });
                }
                await this.markProcessed(id!!);
            } catch (e) {
                this.logger.warn(`Error procesando mensaje ${id}: ${e}`);
            }
        }
        return results;
    }
}