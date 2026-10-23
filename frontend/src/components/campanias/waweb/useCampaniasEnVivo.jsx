import { useCallback, useEffect, useRef, useState } from 'react';
import { useAlReanudar, useEventoSocket } from '../../../context/SocketContext';
import { useFeedback } from '../../../context/FeedbackContext';

// Todo lo que una lista de campañas necesita del socket único: entrar a la sala de cada campaña que está enviando,
// el avance en vivo, los avisos y la detección de "campaña bloqueada" (5 minutos sin avance). Antes cada lista abría
// su propio `io()` y lo recreaba con cada cambio de la lista.

const SIN_AVANCE_MS = 5 * 60 * 1000;
const REVISION_MS = 30_000;

function sinId(set, id) {
    if (!set.has(id)) return set;
    const next = new Set(set);
    next.delete(id);
    return next;
}

/**
 * @param {object} p
 * @param {any[]} p.campanias La lista actual (se usa para los nombres y para saber cuáles están enviando).
 * @param {string} p.eventoProgreso 'progreso' (WhatsApp Web) o 'progreso_mail' (Email).
 * @param {(opts?: {silent?: boolean}) => void} p.recargar
 * @returns {{ progresos: Record<number, {enviados: number, total: number}>, bloqueadas: Set<number> }}
 */
export default function useCampaniasEnVivo({ campanias, eventoProgreso, recargar }) {
    const feedback = useFeedback();
    const [progresos, setProgresos] = useState({});
    const [bloqueadas, setBloqueadas] = useState(() => new Set());
    const ultimoAvance = useRef({});
    const campaniasRef = useRef(campanias);
    campaniasRef.current = campanias;

    const nombreDe = useCallback((id) => {
        const nombre = campaniasRef.current.find((c) => c.id === id)?.nombre;
        return nombre ? `«${nombre}»` : null;
    }, []);

    // Una campaña que recién empezó a enviar arranca el reloj de "sin avance" desde que la vemos.
    useEffect(() => {
        for (const c of campanias) {
            if (c.estado === 'procesando' && !ultimoAvance.current[c.id]) ultimoAvance.current[c.id] = Date.now();
        }
    }, [campanias]);

    useEventoSocket(eventoProgreso, ({ campañaId, enviados, total }) => {
        ultimoAvance.current[campañaId] = Date.now();
        setBloqueadas((prev) => sinId(prev, campañaId));
        setProgresos((prev) => ({ ...prev, [campañaId]: { enviados, total } }));
    });

    // Los ids de campaña se repiten entre canales (Email, WhatsApp Web y WhatsApp API) y estos eventos son globales:
    // por eso no se aplica el estado que trae el evento, se vuelve a leer del servidor.
    useEventoSocket('campania_estado', () => recargar({ silent: true }));

    useEventoSocket('campania_finalizada', ({ campañaId }) => {
        delete ultimoAvance.current[campañaId];
        setBloqueadas((prev) => sinId(prev, campañaId));
        recargar({ silent: true });
    });

    useEventoSocket('campania_pausada', ({ campañaId }) => {
        delete ultimoAvance.current[campañaId];
        setBloqueadas((prev) => sinId(prev, campañaId));
        const nombre = nombreDe(campañaId);
        if (nombre) feedback.exito(`Se pausó ${nombre}.`);
        recargar({ silent: true });
    });

    useEventoSocket('campania_error', ({ campañaId, tipo }) => {
        // Los ids se repiten entre canales y el evento es global: solo cuenta si viene de este canal (los workers de
        // WhatsApp Web y de Email mandan `tipo`). Sin eso, el error de la campaña de email 57 marcaba como bloqueada a
        // la de WhatsApp Web 57, que enviaba bien.
        if (tipo !== (eventoProgreso === 'progreso_mail' ? 'email' : 'whatsapp')) return;
        // El backend detectó el error: el cierre forzado queda disponible de inmediato, sin esperar los 5 minutos.
        const nombre = nombreDe(campañaId);
        if (!nombre) return;
        setBloqueadas((prev) => new Set(prev).add(campañaId));
        feedback.aviso(`La campaña ${nombre} tuvo un error. Revisá el log.`);
        recargar({ silent: true });
    });

    useEventoSocket('campania_envio_reanudado', ({ campañaId, segundosPausado }) => {
        const duracion = segundosPausado >= 60
            ? `${Math.floor(segundosPausado / 60)} min ${segundosPausado % 60} s`
            : `${segundosPausado} s`;
        const nombre = nombreDe(campañaId);
        if (!nombre) return;
        feedback.aviso(`El envío de ${nombre} estuvo ${duracion} detenido por un problema de conexión y se reanudó solo.`, { duracion: 10000 });
    });

    // Al volver de segundo plano o reconectar, el socket pudo haberse dormido: se vuelve a leer todo.
    useAlReanudar(() => recargar({ silent: true }));

    useEffect(() => {
        const intervalo = setInterval(() => {
            const enviando = campaniasRef.current.filter((c) => c.estado === 'procesando').map((c) => c.id);
            if (!enviando.length) return;
            const ahora = Date.now();
            setBloqueadas((prev) => {
                let cambio = false;
                const next = new Set(prev);
                for (const id of enviando) {
                    const ultimo = ultimoAvance.current[id];
                    if ((!ultimo || ahora - ultimo > SIN_AVANCE_MS) && !next.has(id)) {
                        next.add(id);
                        cambio = true;
                    }
                }
                return cambio ? next : prev;
            });
        }, REVISION_MS);
        return () => clearInterval(intervalo);
    }, []);

    return { progresos, bloqueadas };
}
