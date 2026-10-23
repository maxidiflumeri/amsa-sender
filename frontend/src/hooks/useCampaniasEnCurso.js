import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useAlReanudar } from '../context/SocketContext';

const CADA_MS = 60_000;
const EN_CURSO = ['procesando', 'pausada'];

/**
 * Las campañas en curso (enviando o en pausa) de WhatsApp API y de email, según los permisos. Se piden al montar,
 * cada minuto con la pestaña visible y al reanudar. Lo usan el punto del menú y el Inicio.
 * @returns {{ wapi: any[], email: any[], cargando: boolean, error: boolean, recargar: () => Promise<void> }}
 */
export default function useCampaniasEnCurso() {
    const { hasPermiso } = useAuth();
    const verWapi = hasPermiso('wapi.campanias');
    const verEmail = hasPermiso('email.campanias');
    const [estado, setEstado] = useState({ wapi: [], email: [], cargando: verWapi || verEmail, error: false });

    const recargar = useCallback(async () => {
        if (!verWapi && !verEmail) return;
        const [w, e] = await Promise.allSettled([
            verWapi ? api.get('/wapi/campanias') : Promise.resolve({ data: [] }),
            verEmail ? api.get('/email/campanias?lite=1') : Promise.resolve({ data: [] }),
        ]);
        const lista = (r) => (r.status === 'fulfilled' && Array.isArray(r.value.data) ? r.value.data : []);
        setEstado({
            wapi: lista(w).filter((c) => EN_CURSO.includes(c.estado)),
            email: lista(e).filter((c) => EN_CURSO.includes(c.estado)),
            cargando: false,
            error: w.status === 'rejected' && e.status === 'rejected',
        });
    }, [verWapi, verEmail]);

    useEffect(() => {
        recargar();
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') recargar();
        }, CADA_MS);
        return () => clearInterval(id);
    }, [recargar]);

    useAlReanudar(recargar);

    return { ...estado, recargar };
}
