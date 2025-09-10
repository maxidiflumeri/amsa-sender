import { createHmac } from 'node:crypto';

export function b64url(buf: Buffer) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function signBouncePayload(secret: string, reporteId: number, to: string, messageId: string) {
    const payload = `${reporteId}:${to}:${messageId}`;
    return b64url(createHmac('sha256', secret).update(payload).digest());
}

export function buildAmsaHeader(reporteId: number, to: string, messageId: string, secret: string) {
    const sig = signBouncePayload(secret, reporteId, to, messageId);
    // ejemplo: X-AMSASender: rid=123; msgid=<abc@domain>; to=user@dest.com; sig=BASE64URL
    return `rid=${reporteId}; msgid=${messageId}; to=${to}; sig=${sig}`;
}

export function parseAmsaHeader(value?: string) {
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

/** Inserta comentario invisible al final del <body> con el marker */
export function injectHtmlMarker(html: string, marker: string) {
    const pixelHtml = `<!-- X-AMSASender: ${marker} -->`;
    const closeTag = /<\/body\s*>/i;
    if (closeTag.test(html)) return html.replace(closeTag, `${pixelHtml}</body>`);
    return `${html}${pixelHtml}`;
}

/** Extrae Message-ID de un bloque de headers */
export function extractMessageId(headers?: string) {
    return headers?.match(/^\s*Message-ID:\s*(.+)\s*$/im)?.[1]?.trim() || null;
}

/** Extrae el correo destino desde DSN o texto */
export function extractBouncedEmail(dsnText?: string, originalHeaders?: string, quotedBody?: string) {
    const hay = (s?: string) => s || '';
    const blob = [dsnText, originalHeaders, quotedBody].map(hay).join('\n');

    // 1) Campos estándar DSN
    const m1 = blob.match(/Final-Recipient:\s*[^;]+;\s*([^\s<>]+@[^\s<>]+)/i);
    if (m1) return m1[1].toLowerCase();

    const m2 = blob.match(/Original-Recipient:\s*[^;]+;\s*([^\s<>]+@[^\s<>]+)/i);
    if (m2) return m2[1].toLowerCase();

    // 2) Texto común
    const m3 = blob.match(/undeliver(?:ed|able)\s+to\s+([^\s<>]+@[^\s<>]+)/i);
    if (m3) return m3[1].toLowerCase();

    // 3) Fallback: primer email que no sea del dominio propio de rebotes
    const all = blob.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    const first = all.find(e => !/anamayasa\.com\.ar$/i.test(e));
    return first?.toLowerCase() || null;
}

/** Resumen de código/diagnóstico del rebote */
export function extractStatusAndDiagnostic(dsnText?: string) {
    const text = dsnText || '';
    const status = text.match(/Status:\s*([0-9.]+)/i)?.[1] ||
        text.match(/\b(5\.\d+\.\d+|4\.\d+\.\d+)\b/)?.[1] ||
        text.match(/\b(550|554|510|511|452)\b/)?.[1] ||
        null;
    const diag = text.match(/Diagnostic-Code:\s*([^\n\r]+)/i)?.[1]?.trim() || null;
    return { status, diag };
}

/** Trunca string grande para DB (seguro) */
export function truncateForDb(input?: string, maxBytes = 2_000_000) {
    if (!input) return input;
    const buf = Buffer.from(input, 'utf8');
    if (buf.byteLength <= maxBytes) return input;
    return buf.subarray(0, maxBytes - 3).toString('utf8') + '...';
}