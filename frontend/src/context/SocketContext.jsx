import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

// Una sola conexión para toda la app. Antes cada pantalla abría la suya (nueve lugares) y algunas la recreaban con
// cada cambio de la lista. El backend no tiene "salir de una sala": las salas en las que se entró quedan hasta que se
// corta la conexión, y al reconectar hay que volver a entrar (de eso se encarga `useSalaSocket`).

const SocketContext = createContext({ socket: null, conectado: false, reanudaciones: 0 });

/** Cuánto tiene que estar la app en segundo plano para que, al volver, las pantallas recarguen lo suyo. */
const PAUSA_QUE_RECARGA_MS = 20_000;

export function SocketProvider({ children }) {
    const { autenticado } = useAuth();
    const [socket, setSocket] = useState(null);
    const [conectado, setConectado] = useState(false);
    const [reanudaciones, setReanudaciones] = useState(0);
    const salas = useRef(new Map());

    useEffect(() => {
        if (!autenticado) return undefined;
        const s = io(import.meta.env.VITE_HOST_SOCKET);
        let primeraVez = true;
        s.on('connect', () => {
            for (const { evento, arg } of salas.current.values()) s.emit(evento, arg);
            setConectado(true);
            // La primera conexión no es una reanudación: las pantallas ya cargaron sus datos.
            if (!primeraVez) setReanudaciones((n) => n + 1);
            primeraVez = false;
        });
        s.on('disconnect', () => setConectado(false));
        setSocket(s);
        return () => {
            s.disconnect();
            setSocket(null);
            setConectado(false);
        };
    }, [autenticado]);

    // Volver de segundo plano (el celular bloqueado, otra app) cuenta como reanudar: lo que llegó mientras tanto no
    // vino por el socket, que el sistema pudo haber dormido sin cortarlo.
    useEffect(() => {
        let ocultaDesde = null;
        const alCambiar = () => {
            if (document.visibilityState === 'hidden') {
                ocultaDesde = Date.now();
            } else if (ocultaDesde && Date.now() - ocultaDesde > PAUSA_QUE_RECARGA_MS) {
                ocultaDesde = null;
                setReanudaciones((n) => n + 1);
            }
        };
        document.addEventListener('visibilitychange', alCambiar);
        return () => document.removeEventListener('visibilitychange', alCambiar);
    }, []);

    const valor = useMemo(() => ({ socket, conectado, reanudaciones, salas }), [socket, conectado, reanudaciones]);
    return <SocketContext.Provider value={valor}>{children}</SocketContext.Provider>;
}

/** `{ socket, conectado, reanudaciones }`. `socket` es null hasta que hay sesión. */
export function useSocket() {
    return useContext(SocketContext);
}

/**
 * Escucha un evento del socket mientras el componente está montado. El handler puede cambiar en cada render: siempre
 * se llama el último.
 */
export function useEventoSocket(evento, handler) {
    const { socket } = useContext(SocketContext);
    const ultimo = useRef(handler);
    ultimo.current = handler;
    useEffect(() => {
        if (!socket || !evento) return undefined;
        const fn = (...args) => ultimo.current?.(...args);
        socket.on(evento, fn);
        return () => socket.off(evento, fn);
    }, [socket, evento]);
}

/**
 * Entra a una sala del backend (`join_inbox`, `join_campaña` con el id) y vuelve a entrar en cada reconexión.
 * `arg` null o undefined (por ejemplo, todavía no hay campaña elegida) no entra a nada.
 */
export function useSalaSocket(evento, arg) {
    const { socket, salas } = useContext(SocketContext);
    useEffect(() => {
        if (!evento || (evento !== 'join_inbox' && (arg === null || arg === undefined))) return undefined;
        const clave = `${evento}:${arg ?? ''}`;
        const registro = salas.current.get(clave);
        if (registro) registro.usos += 1;
        else salas.current.set(clave, { evento, arg, usos: 1 });
        if (socket?.connected) socket.emit(evento, arg);
        return () => {
            const r = salas.current.get(clave);
            if (!r) return;
            r.usos -= 1;
            if (r.usos <= 0) salas.current.delete(clave);
        };
    }, [socket, salas, evento, arg]);
}

/**
 * Llama a `fn` cada vez que la app se reconecta o vuelve de segundo plano: es el momento de recargar lo que pudo
 * haber cambiado sin que llegara el evento.
 */
export function useAlReanudar(fn) {
    const { reanudaciones } = useContext(SocketContext);
    const ultimo = useRef(fn);
    ultimo.current = fn;
    useEffect(() => {
        if (reanudaciones > 0) ultimo.current?.();
    }, [reanudaciones]);
}
