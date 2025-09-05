// util "safe": no usa Cheerio, no toca el <head>, ni condicionales MSO.

function insertPixelAtEndOfBody(html: string, pixelHtml: string): string {
    const closeTag = /<\/body\s*>/i;
    if (closeTag.test(html)) {
        return html.replace(closeTag, `${pixelHtml}</body>`);
    }
    // Si no hay </body>, lo agregamos al final igual.
    return `${html}${pixelHtml}`;
}

// Reescribe SOLO href de <a ... href="...">..., sin tocar otras partes del documento.
// Evita reescribir si ya es un link de tracking.
function rewriteAnchorsHref(html: string, apiBaseUrl: string, token: string): string {
    const trackingPrefix = `${apiBaseUrl}/email/t/c/`;
    return html.replace(
        /(<a\b[^>]*\bhref\s*=\s*")([^"#]+)("[^>]*>)/gi,
        (match, p1, href, p3) => {
            // Evitar anchors internos, mailto:, tel:, javascript: y ya reescritos
            const low = href.toLowerCase().trim();
            if (
                low.startsWith('#') ||
                low.startsWith('mailto:') ||
                low.startsWith('tel:') ||
                low.startsWith('javascript:') ||
                low.startsWith(trackingPrefix)
            ) {
                return match;
            }
            const destino = encodeURIComponent(href);
            const newHref = `${trackingPrefix}${token}?u=${destino}`;
            return `${p1}${newHref}${p3}`;
        }
    );
}

export function prepararHtmlConTracking_safe(html: string, apiBaseUrl: string, token: string): string {
    // 1) Inyectar pixel sin tocar estructura:
    const pixel = `<img src="${apiBaseUrl}/email/t/o/${token}.png" width="1" height="1" style="display:none" alt="">`;
    const withPixel = insertPixelAtEndOfBody(html, pixel);
    // 2) Reescribir <a href="..."> de forma segura:
    return rewriteAnchorsHref(withPixel, apiBaseUrl, token);
}  