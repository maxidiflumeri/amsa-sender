import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../api/axios';

// Las imágenes, audios y documentos del chat no se pueden pedir con un <img src>: el endpoint pide el token. Se
// bajan como blob y se muestran con una URL local. Esas URL ocupan memoria hasta que se liberan, así que se liberan
// al cambiar de conversación y al salir de la pantalla (antes quedaban todas hasta cerrar la pestaña).

/**
 * @param {unknown} reinicio Cuando cambia (otra conversación), se liberan todas las URL.
 * @returns {{ obtener: (mediaId: string) => { url: string | null, estado: 'cargando' | 'listo' | 'error' }, reintentar: (mediaId: string) => void }}
 */
export default function useMediaBlobs(reinicio) {
    const cache = useRef(new Map()); // mediaId -> { estado, url }
    const generacion = useRef(0);
    const [, setVersion] = useState(0);
    const refrescar = useCallback(() => setVersion((v) => v + 1), []);

    const liberar = useCallback(() => {
        generacion.current += 1;
        for (const { url } of cache.current.values()) if (url) URL.revokeObjectURL(url);
        cache.current.clear();
    }, []);

    useEffect(() => {
        liberar();
        refrescar();
        return liberar;
    }, [reinicio, liberar, refrescar]);

    const pedir = useCallback((mediaId) => {
        const mia = generacion.current;
        cache.current.set(mediaId, { estado: 'cargando', url: null });
        api.get(`/wapi/inbox/media/${mediaId}`, { responseType: 'blob' })
            .then(({ data }) => {
                // Si mientras bajaba se cambió de conversación, esta URL ya no le sirve a nadie.
                if (mia !== generacion.current) return;
                cache.current.set(mediaId, { estado: 'listo', url: URL.createObjectURL(data) });
                refrescar();
            })
            .catch(() => {
                if (mia !== generacion.current) return;
                cache.current.set(mediaId, { estado: 'error', url: null });
                refrescar();
            });
    }, [refrescar]);

    const obtener = (mediaId) => {
        if (!mediaId) return { url: null, estado: 'error' };
        const guardado = cache.current.get(mediaId);
        if (guardado) return guardado;
        // Se pide al dibujar, pero fuera del render: el estado se actualiza recién en el próximo tick.
        const reservado = { estado: 'cargando', url: null };
        cache.current.set(mediaId, reservado);
        queueMicrotask(() => pedir(mediaId));
        return reservado;
    };

    const reintentar = (mediaId) => {
        pedir(mediaId);
        refrescar();
    };

    return { obtener, reintentar };
}
