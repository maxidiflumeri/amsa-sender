import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { useAlReanudar, useEventoSocket, useSalaSocket } from './SocketContext';

// Los pendientes de Conversaciones para la campanita, el menú y la barra de abajo. Usa el socket único: antes abría
// el suyo y pedía la lista entera con cada mensaje, sin esperar (con el inbox abierto eran dos sockets y dos pedidos
// por mensaje).

const NotificationContext = createContext(null);

const ESPERA_MS = 800;

function contar(conversaciones, miId) {
    let unread = 0;
    let unassigned = 0;
    let myActive = 0;
    for (const c of conversaciones) {
        if (c.estado === 'sin_asignar') unassigned++;
        const esMia = c.asignadoAId && String(c.asignadoAId) === String(miId);
        if (esMia && c.estado !== 'resuelta') {
            myActive++;
            if ((c.unreadCount || 0) > 0) unread++;
        }
    }
    return { unread, unassigned, myActive };
}

export const NotificationProvider = ({ children }) => {
    const { user, hasPermiso } = useAuth();
    const miId = user?.sub;
    const habilitado = !!user && hasPermiso('wapi.inbox');

    const [conversations, setConversations] = useState([]);
    const [cargado, setCargado] = useState(false);
    const espera = useRef(null);

    const refreshCounts = useCallback(async () => {
        if (!habilitado) return;
        try {
            const { data } = await api.get('/wapi/inbox');
            if (Array.isArray(data)) {
                setConversations(data);
                setCargado(true);
            }
        } catch {
            // Los pendientes no son críticos: si falla, se reintenta con el próximo evento o al reanudar.
        }
    }, [habilitado]);

    const refrescarEnUnRato = useCallback(() => {
        clearTimeout(espera.current);
        espera.current = setTimeout(refreshCounts, ESPERA_MS);
    }, [refreshCounts]);

    useEffect(() => {
        if (habilitado) refreshCounts();
        else {
            setConversations([]);
            setCargado(false);
        }
        return () => clearTimeout(espera.current);
    }, [habilitado, refreshCounts]);

    useSalaSocket(habilitado ? 'join_inbox' : null);
    useEventoSocket(habilitado ? 'wapi:nuevo_mensaje' : null, refrescarEnUnRato);
    useEventoSocket(habilitado ? 'wapi:conversacion_actualizada' : null, refrescarEnUnRato);
    useAlReanudar(refreshCounts);

    const { unread, unassigned, myActive } = useMemo(() => contar(conversations, miId), [conversations, miId]);

    // El número en el ícono de la app instalada (Android y escritorio; iOS desde 16.4 con la app instalada).
    useEffect(() => {
        if (!habilitado || !cargado || !('setAppBadge' in navigator)) return;
        const total = unread + unassigned;
        const p = total > 0 ? navigator.setAppBadge(total) : navigator.clearAppBadge?.();
        p?.catch?.(() => {});
    }, [habilitado, cargado, unread, unassigned]);

    const valor = useMemo(() => ({
        unreadCount: unread,
        unassignedCount: unassigned,
        myActiveCount: myActive,
        conversations,
        cargado,
        refreshCounts,
    }), [unread, unassigned, myActive, conversations, cargado, refreshCounts]);

    return <NotificationContext.Provider value={valor}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications tiene que usarse dentro de NotificationProvider');
    }
    return context;
};
