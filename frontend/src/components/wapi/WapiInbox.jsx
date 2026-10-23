import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Drawer, IconButton, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowLeft, MessagesSquare, X } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAlReanudar, useEventoSocket, useSalaSocket, useSocket } from '../../context/SocketContext';
import { useOcultarBarraInferior, usePantallaCompleta } from '../layout/ShellContext';
import { BloqueEstado, EmptyState } from '../ui';
import Chat from './inbox/Chat';
import Compositor from './inbox/Compositor';
import DialogoAsignar from './inbox/DialogoAsignar';
import DialogoCierre from './inbox/DialogoCierre';
import DialogoResumen from './inbox/DialogoResumen';
import FichaContacto from './inbox/FichaContacto';
import ListaConversaciones from './inbox/ListaConversaciones';
import useMediaBlobs from './inbox/useMediaBlobs';
import {
    FILTROS, copiarAlPortapapeles, guardarBorradores, guardarLinea, leerBorradores, leerLineaGuardada, tipoDeArchivo, ventanaInfo,
} from './inbox/utils';

// Conversaciones (/wapi/inbox): la pantalla que arma la lista, el chat y la ficha. Acá vive el estado y la lógica; lo
// visual está en ./inbox. La conversación abierta y el filtro viajan en la URL (?c=<id>&filtro=...), así el Inicio y
// las notificaciones push abren directo en un chat y el atrás del celular vuelve a la lista.

const ANCHO_LISTA = 320;
const ANCHO_FICHA = 300;

export default function WapiInbox() {
    // El marco le da todo el alto: el scroll de la lista y del chat lo manejan ellos.
    usePantallaCompleta();
    const theme = useTheme();
    const movil = useMediaQuery(theme.breakpoints.down('md'));
    const esLg = useMediaQuery(theme.breakpoints.up('lg'));
    const feedback = useFeedback();
    const { permisos, user } = useAuth();
    const { refreshCounts } = useNotifications();
    const { conectado } = useSocket();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const esAdmin = permisos.includes('wapi.inbox.admin');
    const miId = user?.sub;
    const esMia = useCallback((c) => c.asignadoAId != null && String(c.asignadoAId) === String(miId), [miId]);

    // ── La URL ───────────────────────────────────────────────────────────────
    const idUrl = Number(searchParams.get('c')) || null;
    const filtroUrl = searchParams.get('filtro');
    const filtro = FILTROS.includes(filtroUrl) && (filtroUrl !== 'otros' || esAdmin) ? filtroUrl : '';
    useOcultarBarraInferior(movil && !!idUrl);

    useEffect(() => {
        document.title = 'Conversaciones — AMSA Sender';
    }, []);

    // ── Estado ───────────────────────────────────────────────────────────────
    const [convs, setConvs] = useState([]);
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [errorConvs, setErrorConvs] = useState(false);
    const [configs, setConfigs] = useState([]);
    const [lineaId, setLineaId] = useState(leerLineaGuardada);
    const [busqueda, setBusqueda] = useState('');
    const [resultados, setResultados] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [resueltas, setResueltas] = useState({ items: [], total: 0, cargando: false, cargadas: false });
    const [typingNums, setTypingNums] = useState(() => new Set());
    const [respuestas, setRespuestas] = useState([]);

    const [convActiva, setConvActiva] = useState(null);
    const [mensajes, setMensajes] = useState([]);
    const [loadingMensajes, setLoadingMensajes] = useState(false);
    const [errorChat, setErrorChat] = useState(false);
    const [estados, setEstados] = useState({});

    const [texto, setTexto] = useState('');
    const [adjunto, setAdjunto] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const [fallidos, setFallidos] = useState([]);
    const [sugiriendo, setSugiriendo] = useState(false);
    const [drafts, setDrafts] = useState(leerBorradores);

    const [ocupado, setOcupado] = useState(null); // 'tomar' | 'resolver' | 'asignar'
    const [dialogoCierre, setDialogoCierre] = useState(false);
    const [dialogoAsignar, setDialogoAsignar] = useState(false);
    const [dialogoResumen, setDialogoResumen] = useState(false);
    const [resumiendo, setResumiendo] = useState(false);
    const [fichaAbierta, setFichaAbierta] = useState(false);

    // Refs para lo que leen los efectos y los callbacks sin tener que volver a armarlos.
    const convsRef = useRef([]);
    convsRef.current = convs;
    const draftsRef = useRef(drafts);
    draftsRef.current = drafts;
    const adjuntoRef = useRef(null);
    adjuntoRef.current = adjunto;
    const ocupadoRef = useRef(false);
    const enviandoRef = useRef(false);
    const cargaChatRef = useRef(0);
    const busquedaRef = useRef(0);
    const resueltasRef = useRef({ pedido: 0, cargando: false });
    const typingTimers = useRef({});
    const idFallido = useRef(0);

    const media = useMediaBlobs(idUrl);

    // El activo verdadero es el que coincide con la URL: al cambiar de chat hay un render con el anterior todavía.
    const activa = convActiva?.id === idUrl ? convActiva : null;

    // ── Lista de conversaciones ──────────────────────────────────────────────
    const cargarConvs = useCallback(async (silencioso = false) => {
        if (!silencioso) setLoadingConvs(true);
        setErrorConvs(false);
        try {
            const { data } = await api.get('/wapi/inbox');
            setConvs(data);
        } catch (e) {
            setErrorConvs(true);
            feedback.error(mensajeDeError(e, 'No se pudieron cargar las conversaciones.'), { accion: { etiqueta: 'Reintentar', onClick: () => cargarConvs() } });
        } finally {
            setLoadingConvs(false);
        }
    }, [feedback]);

    useEffect(() => { cargarConvs(); }, [cargarConvs]);

    useEffect(() => {
        api.get('/wapi/config/lineas')
            .then((r) => setConfigs(r.data))
            .catch((e) => feedback.error(mensajeDeError(e, 'No se pudieron cargar las líneas.')));
        api.get('/wapi/respuestas-rapidas')
            .then((r) => setRespuestas(r.data))
            .catch((e) => feedback.error(mensajeDeError(e, 'No se pudieron cargar las respuestas rápidas.')));
    }, [feedback]);

    // Si la línea guardada ya no existe (se dio de baja), se vuelve a "Todas" en lugar de dejar la lista vacía.
    useEffect(() => {
        if (configs.length && lineaId !== null && !configs.some((c) => c.id === lineaId)) setLineaId(null);
    }, [configs, lineaId]);

    const cambiarLinea = (id) => {
        setLineaId(id);
        guardarLinea(id);
    };

    const cargarResueltas = useCallback(async (pagina) => {
        const estado = resueltasRef.current;
        if (estado.cargando && pagina > 0) return;
        const mio = ++estado.pedido;
        estado.cargando = true;
        setResueltas((r) => ({ ...r, cargando: true }));
        try {
            const params = new URLSearchParams({ page: String(pagina), limit: '25' });
            if (lineaId !== null) params.set('configId', String(lineaId));
            const { data } = await api.get(`/wapi/inbox/resueltas?${params}`);
            if (mio !== estado.pedido) return;
            setResueltas((r) => ({ items: pagina === 0 ? data.items : [...r.items, ...data.items], total: data.total, cargando: false, cargadas: true }));
        } catch (e) {
            if (mio !== estado.pedido) return;
            setResueltas((r) => ({ ...r, cargando: false }));
            feedback.error(mensajeDeError(e, 'No se pudieron cargar las conversaciones resueltas.'), { accion: { etiqueta: 'Reintentar', onClick: () => cargarResueltas(pagina) } });
        } finally {
            if (mio === estado.pedido) estado.cargando = false;
        }
    }, [lineaId, feedback]);

    // Al cambiar de línea las resueltas se vacían; con el filtro "Resueltas" se vuelven a pedir solas.
    useEffect(() => {
        resueltasRef.current.pedido += 1;
        resueltasRef.current.cargando = false;
        setResueltas({ items: [], total: 0, cargando: false, cargadas: false });
        if (filtro === 'resueltas') cargarResueltas(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lineaId, filtro === 'resueltas']);

    // Búsqueda en el servidor, con 300 ms de espera para no pedir en cada letra.
    useEffect(() => {
        const q = busqueda.trim();
        if (q.length < 2) {
            busquedaRef.current += 1;
            setResultados([]);
            setBuscando(false);
            return undefined;
        }
        setBuscando(true);
        const mio = ++busquedaRef.current;
        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ q });
                if (lineaId !== null) params.set('configId', String(lineaId));
                const { data } = await api.get(`/wapi/inbox/buscar?${params}`);
                if (mio === busquedaRef.current) setResultados(data.items ?? []);
            } catch (e) {
                if (mio !== busquedaRef.current) return;
                setResultados([]);
                feedback.error(mensajeDeError(e, 'No se pudo buscar.'));
            } finally {
                if (mio === busquedaRef.current) setBuscando(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [busqueda, lineaId, feedback]);

    // Las listas se actualizan en el lugar: una resuelta sale de las activas y entra a las resueltas (si ya se
    // cargaron); una reactivada hace el camino inverso.
    const upsertConv = useCallback((conv) => {
        if (conv.estado === 'resuelta') {
            setConvs((prev) => prev.filter((c) => c.id !== conv.id));
            setResueltas((r) => {
                const i = r.items.findIndex((c) => c.id === conv.id);
                if (i >= 0) {
                    const items = [...r.items];
                    items[i] = { ...items[i], ...conv };
                    return { ...r, items };
                }
                return r.items.length > 0 ? { ...r, items: [conv, ...r.items], total: r.total + 1 } : r;
            });
            return;
        }
        setResueltas((r) => (r.items.some((c) => c.id === conv.id) ? { ...r, items: r.items.filter((c) => c.id !== conv.id), total: Math.max(r.total - 1, 0) } : r));
        setConvs((prev) => {
            const i = prev.findIndex((c) => c.id === conv.id);
            if (i < 0) return [conv, ...prev];
            const copia = [...prev];
            copia[i] = { ...copia[i], ...conv };
            return copia.sort((a, b) => new Date(b.ultimoMensajeAt) - new Date(a.ultimoMensajeAt));
        });
    }, []);

    const poner = (id, cambios) => {
        setConvs((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)));
        setResueltas((r) => ({ ...r, items: r.items.map((c) => (c.id === id ? { ...c, ...cambios } : c)) }));
        setConvActiva((prev) => (prev?.id === id ? { ...prev, ...cambios } : prev));
    };

    // ── La conversación abierta ──────────────────────────────────────────────
    const marcarLeida = useCallback((id) => {
        api.post(`/wapi/inbox/${id}/marcar-leido`)
            .then(() => {
                poner(id, { unreadCount: 0 });
                refreshCounts();
            })
            .catch(() => {
                // Si no se pudo marcar, queda con su contador: el próximo mensaje o la próxima carga lo reintenta.
            });
    }, [refreshCounts]);

    const cargarChat = useCallback(async (id, silencioso = false) => {
        const mio = ++cargaChatRef.current;
        if (!silencioso) {
            setLoadingMensajes(true);
            setErrorChat(false);
        }
        try {
            const { data } = await api.get(`/wapi/inbox/${id}`);
            if (mio !== cargaChatRef.current) return;
            setConvActiva(data);
            setMensajes(data.mensajes ?? []);
            if ((data.unreadCount ?? 0) > 0 && document.visibilityState === 'visible') marcarLeida(id);
        } catch (e) {
            if (mio !== cargaChatRef.current) return;
            if (!silencioso) {
                setErrorChat(true);
                feedback.error(mensajeDeError(e, 'No se pudo abrir la conversación.'));
            }
        } finally {
            if (mio === cargaChatRef.current && !silencioso) setLoadingMensajes(false);
        }
    }, [feedback, marcarLeida]);

    // Abrir (o cerrar) un chat es cambiar `?c=`. Si no está en las listas cargadas (viene de una notificación, del
    // buscador o de una resuelta vieja), igual se pide por id: el detalle no depende de las listas.
    useEffect(() => {
        if (adjuntoRef.current?.preview) URL.revokeObjectURL(adjuntoRef.current.preview);
        setAdjunto(null);
        setEstados({});
        setMensajes([]);
        setErrorChat(false);
        setDialogoCierre(false);
        setDialogoAsignar(false);
        setDialogoResumen(false);
        setFichaAbierta(false);
        if (!idUrl) {
            cargaChatRef.current += 1;
            setConvActiva(null);
            setLoadingMensajes(false);
            setTexto('');
            return;
        }
        const conocida = convsRef.current.find((c) => c.id === idUrl);
        setConvActiva(conocida ?? null);
        setTexto(draftsRef.current[idUrl] ?? '');
        cargarChat(idUrl);
        // `cargarChat` cambia cuando cambia algo que no debe recargar el chat (feedback, refreshCounts).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idUrl]);

    // Un chat abierto en pantalla que se resuelve o se pierde de la lista no se cierra solo: se queda hasta que el
    // asesor vuelva. Lo único que se cierra es el panel de la ficha al llegar a una pantalla ancha.
    useEffect(() => {
        if (esLg) setFichaAbierta(false);
    }, [esLg]);

    const abrirConv = (conv) => {
        if (conv.id === idUrl) return;
        const params = new URLSearchParams(searchParams);
        params.set('c', String(conv.id));
        // El primer chat empuja una entrada de historial (el atrás de Android vuelve a la lista); pasar de un chat a
        // otro la reemplaza para no llenar el historial.
        const yaAbierto = !!idUrl;
        navigate({ search: `?${params}` }, { replace: yaAbierto, state: yaAbierto ? location.state : { desdeLista: true } });
    };

    const volver = () => {
        if (location.state?.desdeLista) {
            navigate(-1);
            return;
        }
        const params = new URLSearchParams(searchParams);
        params.delete('c');
        navigate({ search: params.toString() ? `?${params}` : '' }, { replace: true });
    };

    const cambiarFiltro = (f) => {
        const params = new URLSearchParams(searchParams);
        if (f) params.set('filtro', f);
        else params.delete('filtro');
        navigate({ search: params.toString() ? `?${params}` : '' }, { replace: true, state: location.state });
    };

    // ── Tiempo real ──────────────────────────────────────────────────────────
    // `useEventoSocket` siempre llama al último handler, así que estos leen la línea y el chat de ESTE render (antes
    // quedaban con los del primer render y el filtro de línea no funcionaba con el socket).
    useSalaSocket('join_inbox');

    useEventoSocket('wapi:nuevo_mensaje', ({ conversacion, mensaje, configId }) => {
        if (conversacion.id === idUrl) {
            setMensajes((m) => (m.some((x) => x.id === mensaje.id) ? m : [...m, mensaje]));
            setConvActiva((prev) => (prev?.id === conversacion.id ? { ...prev, ...conversacion } : prev));
            if (!mensaje.fromMe && document.visibilityState === 'visible') marcarLeida(conversacion.id);
        }
        if (lineaId !== null && configId !== lineaId) return;
        const conocida = convsRef.current.some((c) => c.id === conversacion.id);
        // El mensaje de bienvenida trae una conversación a medias (sin estado): no sirve para armar una fila.
        if (conocida || conversacion.estado) upsertConv({ ...conversacion, ultimoMensajeAt: mensaje.timestamp, mensajes: [mensaje] });
        else cargarConvs(true);
    });

    useEventoSocket('wapi:conversacion_actualizada', ({ configId, ...conv }) => {
        setConvActiva((prev) => (prev?.id === conv.id ? { ...prev, ...conv } : prev));
        if (lineaId !== null && configId !== lineaId) return;
        upsertConv(conv);
    });

    useEventoSocket('wapi:mensaje_status', ({ waMessageId, status }) => {
        setEstados((prev) => ({ ...prev, [waMessageId]: status }));
    });

    useEventoSocket('wapi:typing', ({ numero }) => {
        setTypingNums((prev) => new Set([...prev, numero]));
        clearTimeout(typingTimers.current[numero]);
        typingTimers.current[numero] = setTimeout(() => {
            setTypingNums((prev) => {
                const s = new Set(prev);
                s.delete(numero);
                return s;
            });
        }, 5000);
    });

    // Al volver de segundo plano o reconectar, lo que llegó mientras tanto no vino por el socket.
    useAlReanudar(() => {
        cargarConvs(true);
        if (resueltas.cargadas) cargarResueltas(0);
        if (idUrl) cargarChat(idUrl, true);
        refreshCounts();
    });

    useEffect(() => () => {
        Object.values(typingTimers.current).forEach(clearTimeout);
        if (adjuntoRef.current?.preview) URL.revokeObjectURL(adjuntoRef.current.preview);
    }, []);

    // ── Borradores ───────────────────────────────────────────────────────────
    useEffect(() => { guardarBorradores(drafts); }, [drafts]);

    const cambiarTexto = (val) => {
        setTexto(val);
        if (!idUrl) return;
        setDrafts((prev) => {
            const next = { ...prev };
            if (val.trim()) next[idUrl] = val;
            else delete next[idUrl];
            return next;
        });
    };

    // ── Acciones ─────────────────────────────────────────────────────────────
    // Cada acción corre una sola vez a la vez: el doble toque en "Tomar" mandaba el pedido dos veces.
    const correr = async (clave, tarea) => {
        if (ocupadoRef.current) return;
        ocupadoRef.current = true;
        setOcupado(clave);
        try {
            await tarea();
        } finally {
            ocupadoRef.current = false;
            setOcupado(null);
        }
    };

    const tomar = () => correr('tomar', async () => {
        const id = activa.id;
        try {
            const { data } = await api.post(`/wapi/inbox/${id}/tomar`);
            upsertConv(data);
            setConvActiva((prev) => (prev?.id === id ? { ...prev, ...data } : prev));
            feedback.exito('Tomaste la conversación.');
            refreshCounts();
        } catch (e) {
            feedback.error(mensajeDeError(e, 'No se pudo tomar la conversación.'));
        }
    });

    const resolver = (nota) => correr('resolver', async () => {
        const id = activa.id;
        try {
            const { data } = await api.post(`/wapi/inbox/${id}/resolver`, { nota: nota || undefined });
            upsertConv(data);
            setConvActiva((prev) => (prev?.id === id ? { ...prev, ...data } : prev));
            setDialogoCierre(false);
            feedback.exito('Conversación resuelta.');
            refreshCounts();
        } catch (e) {
            feedback.error(mensajeDeError(e, 'No se pudo resolver la conversación.'));
        }
    });

    const asignar = (userId) => correr('asignar', async () => {
        const id = activa.id;
        try {
            const { data } = await api.post(`/wapi/inbox/${id}/asignar`, { userId });
            upsertConv(data);
            setConvActiva((prev) => (prev?.id === id ? { ...prev, ...data } : prev));
            setDialogoAsignar(false);
            feedback.exito(`Conversación asignada a ${data.asignadoA?.nombre ?? 'el asesor'}.`);
            refreshCounts();
        } catch (e) {
            feedback.error(mensajeDeError(e, 'No se pudo asignar la conversación.'));
        }
    });

    const marcarNoLeida = async (conv) => {
        try {
            await api.post(`/wapi/inbox/${conv.id}/marcar-no-leido`);
            poner(conv.id, { unreadCount: 1 });
            refreshCounts();
            feedback.info('Marcada como no leída.');
            // En el celular, el chat abierto taparía el cambio: se vuelve a la lista, donde se ve el contador.
            if (movil && conv.id === idUrl) volver();
        } catch (e) {
            feedback.error(mensajeDeError(e, 'No se pudo marcar como no leída.'));
        }
    };

    const copiar = async (valor, mensaje) => {
        if (await copiarAlPortapapeles(valor)) feedback.exito(mensaje);
        else feedback.error('No se pudo copiar. Copialo a mano.');
    };

    // ── Envío ────────────────────────────────────────────────────────────────
    const ponerAdjunto = (file) => {
        if (adjuntoRef.current?.preview) URL.revokeObjectURL(adjuntoRef.current.preview);
        const tipo = tipoDeArchivo(file);
        setAdjunto({ file, tipo, preview: tipo === 'image' ? URL.createObjectURL(file) : null });
    };

    const quitarAdjunto = () => {
        if (adjuntoRef.current?.preview) URL.revokeObjectURL(adjuntoRef.current.preview);
        setAdjunto(null);
    };

    const enviarContenido = async (convId, textoEnviar, archivo) => {
        if (enviandoRef.current) return;
        enviandoRef.current = true;
        setEnviando(true);
        try {
            if (archivo) {
                const formData = new FormData();
                formData.append('file', archivo.file);
                if (textoEnviar) formData.append('caption', textoEnviar);
                await api.post(`/wapi/inbox/${convId}/media`, formData);
            } else {
                await api.post(`/wapi/inbox/${convId}/mensajes`, { texto: textoEnviar });
            }
            // El mensaje vuelve por el socket; sin socket (conexión caída) habría que recargar para verlo.
            if (!conectado) cargarChat(convId, true);
        } catch (e) {
            // No se pierde nada: queda en el chat como burbuja fallida con el texto y el adjunto.
            const motivo = mensajeDeError(e, 'No se pudo enviar el mensaje.');
            idFallido.current += 1;
            setFallidos((prev) => [...prev, { id: idFallido.current, convId, texto: textoEnviar, file: archivo?.file ?? null, tipo: archivo?.tipo ?? null, creadoAt: Date.now() }]);
            feedback.error(motivo);
        } finally {
            enviandoRef.current = false;
            setEnviando(false);
        }
    };

    const enviar = async () => {
        if (!activa) return;
        const textoEnviar = texto.trim();
        const archivo = adjunto ? { file: adjunto.file, tipo: adjunto.tipo } : null;
        if (!textoEnviar && !archivo) return;
        cambiarTexto('');
        quitarAdjunto();
        await enviarContenido(activa.id, textoEnviar, archivo);
    };

    const reintentarFallido = async (f) => {
        setFallidos((prev) => prev.filter((x) => x.id !== f.id));
        await enviarContenido(f.convId, f.texto, f.file ? { file: f.file, tipo: f.tipo } : null);
    };

    const editarFallido = (f) => {
        setFallidos((prev) => prev.filter((x) => x.id !== f.id));
        if (f.texto) cambiarTexto(texto.trim() ? `${texto}\n${f.texto}` : f.texto);
        if (f.file) ponerAdjunto(f.file);
    };

    const descartarFallido = (f) => setFallidos((prev) => prev.filter((x) => x.id !== f.id));

    const sugerir = async () => {
        if (!activa || sugiriendo) return null;
        setSugiriendo(true);
        try {
            const { data } = await api.post(`/wapi/inbox/${activa.id}/ai/sugerencia`);
            return data.sugerencia ?? null;
        } catch (e) {
            feedback.error(e?.response?.status === 429
                ? 'La IA está saturada en este momento. Probá de nuevo en unos segundos.'
                : mensajeDeError(e, 'No se pudo generar la sugerencia. Probá de nuevo.'));
            return null;
        } finally {
            setSugiriendo(false);
        }
    };

    // ── Secciones de la lista ────────────────────────────────────────────────
    const secciones = useMemo(() => {
        const visibles = lineaId !== null ? convs.filter((c) => c.configId === lineaId) : convs;
        return {
            mias: visibles.filter((c) => esMia(c) && c.estado !== 'resuelta'),
            sinAsignar: visibles.filter((c) => c.estado === 'sin_asignar'),
            otras: esAdmin ? visibles.filter((c) => c.asignadoAId != null && !esMia(c) && c.estado !== 'resuelta') : [],
        };
    }, [convs, lineaId, esAdmin, esMia]);

    const resueltasLista = useMemo(() => ({ ...resueltas, onMas: cargarResueltas }), [resueltas, cargarResueltas]);

    const fallidosDeEstaConv = useMemo(() => fallidos.filter((f) => f.convId === idUrl), [fallidos, idUrl]);
    const ventana = ventanaInfo(activa);

    // ── Dibujo ───────────────────────────────────────────────────────────────
    const hayChatAbierto = !!idUrl;

    return (
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, bgcolor: 'background.default' }}>
            <ListaConversaciones
                sx={{
                    width: { xs: '100%', md: ANCHO_LISTA },
                    flex: 'none',
                    display: { xs: hayChatAbierto ? 'none' : 'flex', md: 'flex' },
                    borderRight: { md: 1 },
                    borderColor: 'divider',
                }}
                configs={configs}
                lineaId={lineaId}
                onLinea={cambiarLinea}
                busqueda={busqueda}
                onBusqueda={setBusqueda}
                filtro={filtro}
                onFiltro={cambiarFiltro}
                esAdmin={esAdmin}
                cargando={loadingConvs && convs.length === 0}
                error={errorConvs && convs.length === 0}
                onReintentar={() => cargarConvs()}
                onRefrescar={() => cargarConvs(true)}
                secciones={secciones}
                resueltas={resueltasLista}
                resultados={resultados}
                buscando={buscando}
                convActivaId={idUrl}
                onSelect={abrirConv}
                onMarcarNoLeida={marcarNoLeida}
                typingNums={typingNums}
                borradores={drafts}
            />

            <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: { xs: hayChatAbierto ? 'flex' : 'none', md: 'flex' }, flexDirection: 'column', bgcolor: 'whatsapp.fondo' }}>
                {activa ? (
                    <Chat
                        conv={activa}
                        mensajes={mensajes}
                        estados={estados}
                        fallidos={fallidosDeEstaConv}
                        escribiendo={typingNums.has(activa.numero)}
                        cargando={loadingMensajes}
                        errorCarga={errorChat}
                        onReintentarCarga={() => cargarChat(activa.id)}
                        media={media}
                        cantidadLineas={configs.length}
                        esAdmin={esAdmin}
                        esLg={esLg}
                        ocupado={ocupado}
                        resumiendo={resumiendo}
                        enviando={enviando}
                        onVolver={volver}
                        onTomar={tomar}
                        onResolver={() => setDialogoCierre(true)}
                        onAsignar={() => setDialogoAsignar(true)}
                        onResumir={() => setDialogoResumen(true)}
                        onMarcarNoLeida={() => marcarNoLeida(activa)}
                        onCopiarNumero={() => copiar(activa.numero, 'Número copiado.')}
                        onCopiarId={() => copiar(String(activa.id), `Identificador #${activa.id} copiado.`)}
                        onVerFicha={() => setFichaAbierta(true)}
                        onReintentarEnvio={reintentarFallido}
                        onEditarFallido={editarFallido}
                        onDescartarFallido={descartarFallido}
                    >
                        <Compositor
                            conv={activa}
                            ventana={ventana}
                            puedeVerCampanias={permisos.includes('wapi.campanias')}
                            puedeAdministrarRespuestas={permisos.includes('wapi.respuestas_rapidas')}
                            texto={texto}
                            onTexto={cambiarTexto}
                            adjunto={adjunto}
                            onAdjunto={ponerAdjunto}
                            onQuitarAdjunto={quitarAdjunto}
                            enviando={enviando}
                            onEnviar={enviar}
                            onSugerir={sugerir}
                            sugiriendo={sugiriendo}
                            respuestas={respuestas}
                        />
                    </Chat>
                ) : hayChatAbierto ? (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', p: 0.5 }}>
                            <IconButton aria-label="Volver a la lista" onClick={volver} sx={{ width: 44, height: 44 }}><ArrowLeft size={22} strokeWidth={1.75} aria-hidden /></IconButton>
                        </Box>
                        <Box sx={{ p: 2 }}>
                            {errorChat ? (
                                <BloqueEstado estado="error" mensaje="No se pudo abrir la conversación." onReintentar={() => cargarChat(idUrl)} />
                            ) : (
                                <BloqueEstado estado="cargando" mensaje="Abriendo la conversación…" />
                            )}
                            {errorChat && <Button onClick={volver} sx={{ mt: 1 }}>Volver a la lista</Button>}
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <EmptyState icon={MessagesSquare} title="Elegí una conversación" description="Las que esperan respuesta están en la lista de la izquierda." />
                    </Box>
                )}
            </Box>

            {activa && (
                <Box sx={{ display: { xs: 'none', lg: 'block' }, width: ANCHO_FICHA, flex: 'none', overflowY: 'auto', bgcolor: 'background.paper', borderLeft: 1, borderColor: 'divider' }}>
                    <FichaContacto conv={activa} mensajes={mensajes} feedback={feedback} />
                </Box>
            )}

            {/* Entre md y lg no hay lugar para la tercera columna: la ficha se abre desde "Más" en un Drawer. */}
            <Drawer anchor="right" open={fichaAbierta && !esLg && !!activa} onClose={() => setFichaAbierta(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 340 }, maxWidth: '100%' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', p: 1, pl: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography component="h2" sx={{ flex: 1, fontSize: 16, fontWeight: 650 }}>Ficha del contacto</Typography>
                    <IconButton aria-label="Cerrar la ficha" onClick={() => setFichaAbierta(false)} sx={{ width: 44, height: 44 }}><X size={20} strokeWidth={1.75} aria-hidden /></IconButton>
                </Box>
                <Box sx={{ overflowY: 'auto', pb: 'env(safe-area-inset-bottom)' }}>
                    {activa && <FichaContacto conv={activa} mensajes={mensajes} feedback={feedback} />}
                </Box>
            </Drawer>

            <DialogoCierre open={dialogoCierre} onClose={() => setDialogoCierre(false)} resolviendo={ocupado === 'resolver'} onResolver={resolver} nombre={activa?.nombre} />
            <DialogoAsignar open={dialogoAsignar} onClose={() => setDialogoAsignar(false)} asignando={ocupado === 'asignar'} onAsignar={asignar} />
            <DialogoResumen open={dialogoResumen} onClose={() => setDialogoResumen(false)} convId={activa?.id} onEstado={setResumiendo} />
        </Box>
    );
}
