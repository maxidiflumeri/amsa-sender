import { estadoCampania } from '../estados';

// Las listas de Email y de WhatsApp Web comparten estos helpers (la carpeta `waweb` es la casa de lo común: Email la
// importa). Los dos backends guardan algunos estados con otro nombre que `estados.js`, que es el vocabulario de
// pantalla: acá se traducen en un solo lugar.

/**
 * El nombre del estado en el vocabulario de `estados.js`: 'programada' es 'agendada' y 'pausa_pendiente' (la pausa de
 * una agendada, pedida antes de que arrancara su envío) es una pausa más.
 */
export function estadoNormalizado(estado) {
    if (estado === 'programada') return 'agendada';
    if (estado === 'pausa_pendiente') return 'pausada';
    return estado;
}

/** `{ label, tono, vivo }` para el StatusChip de una campaña. */
export function chipDeEstado(estado) {
    return estadoCampania(estadoNormalizado(estado));
}

/** "23/10/26 15:40", o un guion si no hay fecha. */
export function fechaCorta(fecha) {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

export function pluralizar(n, singular, plural) {
    return `${n.toLocaleString('es-AR')} ${n === 1 ? singular : plural}`;
}
