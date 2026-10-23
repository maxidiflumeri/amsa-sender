import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** Lee el payload del JWT sin verificarlo: es solo para mostrar y para decidir el menú; el backend es el que valida. */
export function decodeJwt(token) {
    try {
        const payload = token.split('.')[1];
        return JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))));
    } catch {
        return null;
    }
}

function leerSesion() {
    let token = null;
    let usuario = null;
    try {
        token = localStorage.getItem('token');
        usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
    } catch {
        /* localStorage bloqueado o JSON roto: sin sesión */
    }
    const payload = token ? decodeJwt(token) : null;
    // Un token vencido es lo mismo que no tener: el backend lo va a rechazar igual, mejor no mostrar la app.
    const vencido = !!payload?.exp && payload.exp * 1000 <= Date.now();
    if (!payload || vencido) return { token: null, payload: null, usuario: null };
    return { token, payload, usuario };
}

/** Lo que hay que hacer antes de borrar la sesión (por ejemplo, dar de baja las notificaciones push). */
const alCerrarSesion = new Set();
export function registrarAlCerrarSesion(fn) {
    alCerrarSesion.add(fn);
    return () => alCerrarSesion.delete(fn);
}

export function borrarSesionLocal() {
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
    } catch {
        /* nada que borrar */
    }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [sesion, setSesion] = useState(leerSesion);

    // Un token guardado pero vencido: la sesión se perdió sin "Cerrar sesión". Se limpia y se da de baja el push en
    // este navegador (sin token no hay DELETE posible), para que no sigan llegando los mensajes de esa persona.
    useEffect(() => {
        if (sesion.token) return;
        let quedoToken = false;
        try {
            quedoToken = !!localStorage.getItem('token');
        } catch {
            /* sin localStorage */
        }
        if (!quedoToken) return;
        borrarSesionLocal();
        import('../pwa/push').then((m) => m.bajaPushSoloNavegador()).catch(() => undefined);
    }, [sesion.token]);

    // Otra pestaña entró o salió: esta se acomoda.
    useEffect(() => {
        const alCambiar = (e) => {
            if (e.key === 'token' || e.key === 'usuario' || e.key === null) setSesion(leerSesion());
        };
        window.addEventListener('storage', alCambiar);
        return () => window.removeEventListener('storage', alCambiar);
    }, []);

    const cerrarSesion = useCallback(async () => {
        await Promise.allSettled([...alCerrarSesion].map((fn) => Promise.resolve().then(fn)));
        borrarSesionLocal();
        // Recarga entera: corta el socket y limpia todo el estado en memoria.
        window.location.href = '/login';
    }, []);

    const value = useMemo(() => {
        const permisos = sesion.payload?.permisos ?? [];
        const usuario = sesion.usuario;
        return {
            autenticado: !!sesion.token,
            token: sesion.token,
            /** El payload del token: `sub`, `email`, `rol`, `permisos`, `iat`, `exp`. */
            user: sesion.payload,
            /** Lo que devolvió el login: nombre, foto, email, rol. */
            usuario,
            nombre: usuario?.nombre || sesion.payload?.email || '',
            permisos,
            hasPermiso: (key) => permisos.includes(key),
            cerrarSesion,
        };
    }, [sesion, cerrarSesion]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
