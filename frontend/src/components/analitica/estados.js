// Estados de lo que se ve en analítica, con el tono de StatusChip. Cada pantalla tenía su mapa con colores de MUI sueltos.

/** Estado de un mensaje de WhatsApp API. */
export const ESTADOS_MENSAJE = {
    sent: { label: 'Enviado', tono: 'info' },
    delivered: { label: 'Entregado', tono: 'acento' },
    read: { label: 'Leído', tono: 'ok' },
    failed: { label: 'Fallido', tono: 'error' },
    pendiente: { label: 'Pendiente', tono: 'neutro' },
};

export const estadoMensaje = (e) => ESTADOS_MENSAJE[e] ?? { label: e ?? '—', tono: 'neutro' };

/** Estado de una conversación del inbox. */
export const ESTADOS_CONVERSACION = {
    sin_asignar: { label: 'Sin asignar', tono: 'aviso' },
    asignada: { label: 'Asignada', tono: 'info' },
    resuelta: { label: 'Resuelta', tono: 'ok' },
};

export const estadoConversacion = (e) =>
    ESTADOS_CONVERSACION[e] ?? { label: e ? String(e).replace(/_/g, ' ') : '—', tono: 'neutro' };
