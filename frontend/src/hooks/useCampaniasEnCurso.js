import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useAlReanudar } from '../context/SocketContext';

const CADA_MS = 60_000;
const EN_CURSO = ['procesando', 'pausada', 'pausa_pendiente'];

/**
 * Las campañas en curso (enviando o en pausa) de WhatsApp API, de email y de WhatsApp Web, según los permisos. Se piden
 * al montar, cada minuto con la pestaña visible y al reanudar. Lo usan el punto del menú y el Inicio.
 *
 * WhatsApp Web usa `/whatsapp/campanias/en-curso`, liviana: la lista de siempre trae todas las campañas con todos sus
 * contactos. Con un backend que todavía no la tiene, el pedido falla y simplemente no se muestran (no es un error).
 * @returns {{ wapi: any[], email: any[], waweb: any[], cargando: boolean, error: boolean, recargar: () => Promise<void> }}
 */
export default function useCampaniasEnCurso() {
    const { hasPermiso } = useAuth();
    const verWapi = hasPermiso('wapi.campanias');
    const verEmail = hasPermiso('email.campanias');
    const verWaweb = hasPermiso('whatsapp.campanias');
    const algo = verWapi || verEmail || verWaweb;
    const [estado, setEstado] = useState({ wapi: [], email: [], waweb: [], cargando: algo, error: false });

    const recargar = useCallback(async () => {
        if (!algo) return;
        const [w, e, ww] = await Promise.allSettled([
            verWapi ? api.get('/wapi/campanias') : Promise.resolve({ data: [] }),
            verEmail ? api.get('/email/campanias?lite=1') : Promise.resolve({ data: [] }),
            verWaweb ? api.get('/whatsapp/campanias/en-curso') : Promise.resolve({ data: [] }),
        ]);
        const lista = (r) => (r.status === 'fulfilled' && Array.isArray(r.value.data) ? r.value.data : []);
        setEstado({
            wapi: lista(w).filter((c) => EN_CURSO.includes(c.estado)),
            email: lista(e).filter((c) => EN_CURSO.includes(c.estado)),
            waweb: lista(ww).filter((c) => EN_CURSO.includes(c.estado)),
            cargando: false,
            // Error solo si fallaron las de WhatsApp API y email que se pidieron (WhatsApp Web puede no estar todavía).
            error: (verWapi || verEmail) && (!verWapi || w.status === 'rejected') && (!verEmail || e.status === 'rejected'),
        });
    }, [algo, verWapi, verEmail, verWaweb]);

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
