// Los estados de una campaña, iguales en los tres canales (WhatsApp API, Email y WhatsApp Web). Antes cada pantalla
// tenía su propio mapa, con nombres y colores distintos.

/** @type {Record<string, {label: string, tono: 'ok'|'aviso'|'error'|'info'|'acento'|'neutro', vivo?: boolean}>} */
export const ESTADOS_CAMPANIA = {
    pendiente: { label: 'Borrador', tono: 'neutro' },
    agendada: { label: 'Agendada', tono: 'info' },
    procesando: { label: 'Enviando', tono: 'ok', vivo: true },
    pausada: { label: 'En pausa', tono: 'aviso' },
    finalizada: { label: 'Terminada', tono: 'acento' },
    error: { label: 'Con error', tono: 'error' },
};

export function estadoCampania(estado) {
    return ESTADOS_CAMPANIA[estado] ?? { label: estado ?? '—', tono: 'neutro' };
}

/** Las pestañas de una lista de campañas, en orden. */
export const PESTANIAS_CAMPANIAS = [
    { id: 'en-curso', label: 'En curso', estados: ['procesando', 'pausada'] },
    { id: 'agendadas', label: 'Agendadas', estados: ['agendada'] },
    { id: 'borradores', label: 'Borradores', estados: ['pendiente'] },
    { id: 'terminadas', label: 'Terminadas', estados: ['finalizada', 'error'] },
];
