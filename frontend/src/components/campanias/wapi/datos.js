import api from '../../../api/axios';

// Lo que comparten la lista de campañas y el monitor en vivo de WhatsApp API.

/**
 * Las líneas para nombrar y filtrar. `/wapi/config/lineas` pide el permiso del inbox y `/wapi/config` el de
 * configuración: quien administra campañas puede tener uno, el otro o ninguno, así que se prueba con los dos y, si no
 * hay acceso, la pantalla simplemente no muestra líneas.
 * @returns {Promise<{id: number, nombre: string|null, activo?: boolean}[]>}
 */
export async function cargarLineas() {
    for (const ruta of ['/wapi/config/lineas', '/wapi/config']) {
        try {
            const res = await api.get(ruta);
            if (Array.isArray(res.data)) return res.data;
        } catch { /* se prueba con la siguiente */ }
    }
    return [];
}

export const nombreDeLinea = (lineas, configId) => {
    if (configId === null || configId === undefined) return null;
    const l = lineas.find((x) => x.id === configId);
    return l ? (l.nombre ?? `Línea ${l.id}`) : null;
};

/**
 * El avance real de una campaña desde la base: los mensajes ya resueltos (enviados o fallidos) y el desglose de
 * entrega. Es lo que permite mostrar el avance de una campaña pausada o recién abierta, sin esperar un evento del
 * socket (que solo llega mientras se está enviando).
 */
export async function pedirAvance(id) {
    const { data } = await api.get(`/wapi/campanias/${id}/reportes`);
    return {
        procesados: (data.enviados ?? 0) + (data.fallidos ?? 0),
        enviados: data.enviados ?? 0,
        entregados: data.entregados ?? 0,
        leidos: data.leidos ?? 0,
        fallidos: data.fallidos ?? 0,
    };
}

/** Porcentaje entero, o null si no se sabe (sin total no hay avance que mostrar: "—", nunca 0 %). */
export const porcentaje = (hechos, total) => (typeof hechos === 'number' && total > 0 ? Math.min(100, Math.round((hechos / total) * 100)) : null);
