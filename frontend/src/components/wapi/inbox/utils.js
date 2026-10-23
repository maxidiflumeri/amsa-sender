// Lo que comparten las piezas de Conversaciones: fechas, borradores, urgencia, ventana de 24 h y la línea elegida.
// Todo lo que toca localStorage va con try/catch: en una ventana privada o con los datos bloqueados tira, y la
// pantalla tiene que andar igual.

export const CLAVE_LINEA = 'wapi_inbox_selected_config';
const CLAVE_BORRADORES = 'wapi_inbox_borradores';

/** Los filtros que acepta `?filtro=` (el Inicio los usa para llevar a "Sin asignar" o "Mías"). */
export const FILTROS = ['mias', 'sin_asignar', 'otros', 'resueltas'];

const HORA_MS = 60 * 60 * 1000;

// ── Almacenamiento local ────────────────────────────────────────────────────

export function leerLineaGuardada() {
    try {
        const n = parseInt(localStorage.getItem(CLAVE_LINEA) ?? '', 10);
        return Number.isNaN(n) ? null : n;
    } catch {
        return null;
    }
}

export function guardarLinea(id) {
    try {
        localStorage.setItem(CLAVE_LINEA, id === null ? '' : String(id));
    } catch {
        // Sin almacenamiento: la línea no se recuerda, pero la pantalla anda.
    }
}

/** Los borradores por conversación, `{ [convId]: texto }`. Sobreviven a una recarga. */
export function leerBorradores() {
    try {
        const crudo = JSON.parse(localStorage.getItem(CLAVE_BORRADORES) ?? '{}');
        return crudo && typeof crudo === 'object' && !Array.isArray(crudo) ? crudo : {};
    } catch {
        return {};
    }
}

export function guardarBorradores(borradores) {
    try {
        localStorage.setItem(CLAVE_BORRADORES, JSON.stringify(borradores));
    } catch {
        // Idem: el borrador queda solo en memoria.
    }
}

// ── Fechas ──────────────────────────────────────────────────────────────────

export const formatHora = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const mismoDia = (a, b) => a.toDateString() === b.toDateString();

function esAyer(d, hoy) {
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    return mismoDia(d, ayer);
}

/** La fecha de una fila de la lista: la hora si es de hoy, "Ayer", el día de la semana o dd/mm. */
export const formatFechaLista = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const hoy = new Date();
    if (mismoDia(d, hoy)) return formatHora(ts);
    if (esAyer(d, hoy)) return 'Ayer';
    if (Math.floor((hoy - d) / 86400000) < 7) {
        const dia = d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
        return dia.charAt(0).toUpperCase() + dia.slice(1);
    }
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
};

/** El separador de día dentro del chat. */
export const formatSeparador = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const hoy = new Date();
    if (mismoDia(d, hoy)) return 'Hoy';
    if (esAyer(d, hoy)) return 'Ayer';
    if (Math.floor((hoy - d) / 86400000) < 7) {
        return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (d.getFullYear() === hoy.getFullYear()) return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const formatFechaHora = (ts) =>
    new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ── Estado de la conversación ───────────────────────────────────────────────

export const ETIQUETA_ESTADO = { sin_asignar: 'Sin asignar', asignada: 'Asignada', resuelta: 'Resuelta' };
export const TONO_ESTADO = { sin_asignar: 'aviso', asignada: 'info', resuelta: 'neutro' };

/**
 * La ventana de 24 h de WhatsApp. Se calcula con la fecha y no con el `ventanaAbierta` que trae la conversación: ese
 * booleano lo calcula el servidor al pedirla y, si después llega una actualización por el socket, queda viejo.
 * @returns {{ abierta: boolean, restante: string | null }}
 */
export function ventanaInfo(conv) {
    if (!conv) return { abierta: false, restante: null };
    if (!conv.ventana24hAt) return { abierta: !!conv.ventanaAbierta, restante: null };
    const ms = 24 * HORA_MS - (Date.now() - new Date(conv.ventana24hAt).getTime());
    if (ms <= 0) return { abierta: false, restante: null };
    const h = Math.floor(ms / HORA_MS);
    const min = Math.floor((ms % HORA_MS) / 60000);
    return { abierta: true, restante: h >= 1 ? `${h} h` : `${Math.max(min, 1)} min`, poco: ms < 2 * HORA_MS };
}

/**
 * Cuánto hace que el cliente espera respuesta: más de 1 h es aviso, más de 2 h es urgente. Solo cuenta si el último
 * mensaje es del cliente y la conversación no está resuelta.
 * @returns {{ nivel: 'aviso' | 'error', texto: string, detalle: string } | null}
 */
export function urgenciaDe(conv) {
    if (!conv || conv.estado === 'resuelta') return null;
    const ultimo = conv.mensajes?.[0];
    if (!ultimo || ultimo.fromMe || ultimo.tipo === 'sistema') return null;
    const horas = (Date.now() - new Date(conv.ultimoMensajeAt).getTime()) / HORA_MS;
    if (horas > 2) return { nivel: 'error', texto: '+2 h', detalle: 'Urgente: el cliente espera hace más de 2 horas' };
    if (horas > 1) return { nivel: 'aviso', texto: '+1 h', detalle: 'Pendiente: el cliente espera hace más de 1 hora' };
    return null;
}

const ROTULO_TIPO = { image: 'Imagen', audio: 'Audio', document: 'Documento', contacts: 'Contacto', video: 'Video', sticker: 'Sticker' };

/** El renglón de vista previa de la última actividad de una conversación. */
export function vistaPrevia(conv) {
    const m = conv.mensajes?.[0];
    if (!m || m.tipo === 'sistema') return '';
    const c = m.contenido ?? {};
    if (m.tipo === 'reaction') return c.emoji ? `Reaccionó con ${c.emoji}` : 'Reaccionó a un mensaje';
    const texto = c.text ?? (m.tipo === 'button' ? c.buttonText : null);
    if (texto) return `${m.fromMe ? 'Vos: ' : ''}${texto}`;
    return ROTULO_TIPO[m.tipo] ?? 'Mensaje';
}

// ── Mensajes ────────────────────────────────────────────────────────────────

const ESTADO_BURBUJA = { sent: 'enviado', delivered: 'entregado', read: 'leido', failed: 'fallido' };

/** El estado de una burbuja saliente, con lo que llegó por el socket por encima de lo que vino de la base. */
export function estadoBurbuja(msg, estados) {
    const st = estados[msg.waMessageId] ?? msg.status ?? 'sent';
    return ESTADO_BURBUJA[st] ?? 'enviado';
}

/** La ficha que el sistema deja en el chat al abrir la conversación desde una campaña (datos del deudor y campaña). */
export function fichaDe(mensajes) {
    return mensajes.find((m) => m.tipo === 'sistema' && m.contenido?.tipo === 'ficha_contacto')?.contenido ?? null;
}

/** El tipo del adjunto según el archivo, para armar el preview. */
export function tipoDeArchivo(file) {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
}

/** Copia al portapapeles. Devuelve false si el navegador no deja (sin HTTPS, sin permiso). */
export async function copiarAlPortapapeles(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch {
        return false;
    }
}

// ── Respuestas rápidas ──────────────────────────────────────────────────────

export const tagsDe = (respuestas) => [...new Set(respuestas.flatMap((r) => r.tags ?? []))].sort();

export function filtrarRespuestas(respuestas, busqueda, tag) {
    const q = busqueda.replace(/^\//, '').toLowerCase().trim();
    return respuestas.filter((r) => {
        if (tag && !(r.tags ?? []).includes(tag)) return false;
        return !q || r.titulo.toLowerCase().includes(q) || r.contenido.toLowerCase().includes(q);
    });
}
