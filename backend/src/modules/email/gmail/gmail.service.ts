// src/gmail/gmail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { simpleParser, ParsedMail } from 'mailparser';
import * as fs from 'fs/promises';
import { PrismaService } from 'src/prisma/prisma.service';

type BounceInfo = {
    recipient: string;
    code: string | null;                  // 5.1.1 / 550 / 4.2.2 / etc.
    type: 'hard' | 'soft' | 'unknown';
    reason: string | null;                // Diagnostic-Code o similar
    subject: string | null;
    messageId: string | null;             // Message-ID del NDR (no siempre el original)
    receivedAt: Date;
    rawSnippet: string | null;            // para debug
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

    private extractBounceInfo(mail: ParsedMail): BounceInfo | null {
        const subject = mail.subject || '';
        const text = (mail.text || '').replace(/\r/g, '');
        const headers = mail.headers;

        const failed = (headers.get('x-failed-recipients') as string) || '';

        // ¿trae parte delivery-status?
        const dsPart = mail.attachments?.find(a => /delivery-status/i.test(a.contentType));
        let statusCode = '';
        let finalRecipient = '';

        if (dsPart) {
            const body = dsPart.content.toString();
            finalRecipient = (body.match(/Final-Recipient:\s*[^\s;]+;\s*([^\s\r\n]+)/i)?.[1]) || '';
            statusCode = (body.match(/Status:\s*([245]\.\d+\.\d+)/i)?.[1]) || '';
        }

        const code =
            statusCode ||
            (text.match(/(\b[245]\.\d+\.\d+\b)/)?.[1]) ||     // RFC 5.x.x / 4.x.x
            (text.match(/\b(5\d{2}|4\d{2})\b/)?.[1]) ||       // SMTP 550 / 450
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
            recipient: recipient || 'unknown',
            code,
            type: hard ? 'hard' : (soft ? 'soft' : 'unknown'),
            reason,
            subject: subject || null,
            messageId: mail.messageId || null,
            receivedAt: mail.date || new Date(),
            rawSnippet: text ? text.slice(0, 1000) : null,
        };
    }

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
                    await this.prisma.emailRebote.create({
                        data: {
                            fecha: parsed.receivedAt,
                            codigo: parsed.code ?? null,
                            descripcion: parsed.reason ?? parsed.subject ?? null,
                            raw: parsed.rawSnippet ?? null,
                            // reporteId: lo completás si podés vincular con ReporteEmail
                            reporteId: null,
                        },
                    });
                    results.push(parsed);                    
                }
                await this.markProcessed(id!!);
            } catch (e) {
                this.logger.warn(`Error procesando mensaje ${id}: ${e}`);
            }
        }
        return results;
    }

    // --- Cron automático (ajustá frecuencia) ---

    @Cron(CronExpression.EVERY_MINUTE)
    async cron() {
        try {
            const res = await this.pollBouncesOnce();
            if (res.length) this.logger.log(`Rebotes procesados: ${res.length}`);
        } catch (e) {
            this.logger.error('Error en cron de Gmail', e as any);
        }
    }
}