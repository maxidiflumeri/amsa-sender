import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Box, Typography, Paper, TextField, IconButton, Chip, Avatar, List, Badge,
    ListItemAvatar, ListItemText, ListItemButton, Divider, CircularProgress,
    Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Select, MenuItem, FormControl, InputLabel, Alert, Collapse, Autocomplete,
    Popper, Fade, Menu, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LockClockIcon from '@mui/icons-material/LockClock';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import BoltIcon from '@mui/icons-material/Bolt';
import MarkChatUnreadIcon from '@mui/icons-material/MarkChatUnread';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { io } from 'socket.io-client';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useMediaQuery } from '@mui/material';

const formatHora = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const formatFechaLabel = (ts) => {
    if (!ts) return { label: '', hora: '' };
    const d = new Date(ts);
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return { label: formatHora(ts), hora: '' };
    if (d.toDateString() === ayer.toDateString()) return { label: 'Ayer', hora: formatHora(ts) };
    const diffDays = Math.floor((hoy - d) / 86400000);
    if (diffDays < 7) {
        const dia = d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
        return { label: dia.charAt(0).toUpperCase() + dia.slice(1), hora: formatHora(ts) };
    }
    return { label: d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }), hora: formatHora(ts) };
};

const formatDividerDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    const diffDays = Math.floor((hoy - d) / 86400000);
    if (diffDays < 7) {
        return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (d.getFullYear() === hoy.getFullYear()) {
        return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    }
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatHeaderDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    if (d.getFullYear() === hoy.getFullYear()) {
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    }
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

function SeccionLista({ titulo, convs, convActivaId, onSelect, color = 'text.secondary', defaultOpen = true, typingNums, onContextMenuConv, drafts = {}, configs = [], selectedConfigId = null, onLoadMore, total, loadingMore }) {
    const [open, setOpen] = useState(defaultOpen);
    const isLazy = !!onLoadMore;
    const loadedOnceRef = useRef(false);
    const sentinelRef = useRef(null);

    useEffect(() => {
        if (!isLazy || !sentinelRef.current) return;
        const hasMore = convs.length < (total ?? 0);
        const obs = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !loadingMore && hasMore) {
                const nextPage = Math.floor(convs.length / 25);
                onLoadMore(nextPage);
            }
        }, { threshold: 0.1 });
        obs.observe(sentinelRef.current);
        return () => obs.disconnect();
    }, [isLazy, loadingMore, convs.length, total, onLoadMore]);

    if (!isLazy && !convs.length) return null;
    const mostrarLinea = selectedConfigId === null && configs.length > 1;
    return (
        <>
            <Box
                onClick={() => {
                    const next = !open;
                    setOpen(next);
                    if (isLazy && next && !loadedOnceRef.current) {
                        loadedOnceRef.current = true;
                        onLoadMore(0);
                    }
                }}
                sx={{ px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography 
                        variant="caption" 
                        fontWeight={700} 
                        color={color}
                        sx={{ 
                            ...(titulo.includes('sin asignar') && convs.length > 0 && {
                                color: '#E65100',
                                animation: 'pulse 2s infinite',
                                '@keyframes pulse': {
                                    '0%': { opacity: 1 },
                                    '50%': { opacity: 0.6 },
                                    '100%': { opacity: 1 }
                                }
                            })
                        }}
                    >
                        {titulo.toUpperCase()}
                    </Typography>
                    <Chip
                        label={isLazy ? (loadedOnceRef.current ? (total ?? 0) : '…') : convs.length}
                        size="small"
                        color={titulo.includes('sin asignar') && convs.length > 0 ? "warning" : "default"}
                        sx={{ height: 16, fontSize: 10, fontWeight: 700 }}
                    />
                </Box>
                {open ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            </Box>
            <Collapse in={open} unmountOnExit={isLazy}>
                {isLazy && loadingMore && convs.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={18} />
                    </Box>
                ) : (
                <List dense disablePadding>
                    {convs.map(conv => {
                        const isTyping = typingNums?.has(conv.numero);
                        const hasUnread = conv.unreadCount > 0;
                        const nombreLinea = conv.config?.nombre ?? `Línea ${conv.configId}`;
                        const fechaInfo = formatFechaLabel(conv.ultimoMensajeAt);
                        return (
                        <ListItemButton
                            key={conv.id}
                            selected={convActivaId === conv.id}
                            onClick={() => onSelect(conv)}
                            onContextMenu={(e) => { e.preventDefault(); onContextMenuConv?.(e, conv); }}
                            sx={{ py: 0.75 }}
                        >
                            <ListItemAvatar sx={{ minWidth: 44 }}>
                                <Badge
                                    overlap="circular"
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                    badgeContent={(() => {
                                        if (conv.estado === 'resuelta') return null;
                                        const lastMsg = conv.mensajes?.[0];
                                        if (lastMsg && !lastMsg.fromMe) {
                                            const diffHs = (Date.now() - new Date(conv.ultimoMensajeAt).getTime()) / (1000 * 60 * 60);
                                            if (diffHs > 2) return <Tooltip title="Urgente: Sin respuesta > 2hs"><ErrorOutlineIcon sx={{ fontSize: 14, color: '#f44336', bgcolor: 'white', borderRadius: '50%' }} /></Tooltip>;
                                            if (diffHs > 1) return <Tooltip title="Pendiente: Sin respuesta > 1h"><AccessTimeIcon sx={{ fontSize: 14, color: '#ff9800', bgcolor: 'white', borderRadius: '50%' }} /></Tooltip>;
                                        }
                                        return null;
                                    })()}
                                >
                                    <Avatar sx={{ width: 34, height: 34, fontSize: 14, bgcolor: conv.estado === 'resuelta' ? '#757575' : conv.estado === 'sin_asignar' ? '#E65100' : '#00695C', border: (conv.unreadCount > 0) ? '2px solid #25D366' : 'none' }}>
                                        {(conv.nombre ?? conv.numero)[0].toUpperCase()}
                                    </Avatar>
                                </Badge>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="body2" fontWeight={hasUnread ? 700 : 600} noWrap sx={{ flex: 1, fontSize: 13 }}>
                                            {conv.nombre ?? conv.numero}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <Typography variant="caption" color={hasUnread ? 'success.main' : 'text.secondary'} sx={{ fontSize: 10, lineHeight: 1.2 }}>
                                                    {fechaInfo.label}
                                                </Typography>
                                                {fechaInfo.hora && (
                                                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: 9, lineHeight: 1.2 }}>
                                                        {fechaInfo.hora}
                                                    </Typography>
                                                )}
                                            </Box>
                                            {hasUnread && (
                                                <Box sx={{
                                                    minWidth: 18, height: 18, borderRadius: '50%',
                                                    bgcolor: 'success.main', color: 'white',
                                                    fontSize: 10, fontWeight: 700,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    px: conv.unreadCount > 9 ? 0.5 : 0,
                                                }}>
                                                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                }
                                secondary={
                                    <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                            {conv.asignadoA && (
                                                <Typography component="span" variant="caption" noWrap sx={{ fontSize: 10, color: 'info.main', fontWeight: 500 }}>
                                                    👤 {conv.asignadoA.nombre}
                                                </Typography>
                                            )}
                                            {conv.campañaNombre && (
                                                <Chip
                                                    label={conv.campañaNombre.length > 14 ? conv.campañaNombre.slice(0, 13) + '…' : conv.campañaNombre}
                                                    size="small"
                                                    color="secondary"
                                                    variant="outlined"
                                                    component="span"
                                                    title={conv.campañaNombre}
                                                    sx={{ height: 14, fontSize: 9, fontWeight: 600, px: 0.25, '& .MuiChip-label': { px: 0.5 } }}
                                                />
                                            )}
                                            {mostrarLinea && (
                                                <Typography component="span" variant="caption" noWrap sx={{ fontSize: 9, color: 'text.disabled', fontStyle: 'italic' }}>
                                                    📱 {nombreLinea}
                                                </Typography>
                                            )}
                                        </Box>
                                        {isTyping ? (
                                            <Typography component="span" variant="caption" noWrap sx={{ fontSize: 11, color: 'success.main', fontStyle: 'italic' }}>
                                                Escribiendo...
                                            </Typography>
                                        ) : (
                                            <Typography component="span" variant="caption" noWrap sx={{ fontSize: 11, color: 'text.secondary', fontWeight: hasUnread ? 600 : 400 }}>
                                                {(() => {
    const draft = drafts[conv.id];
    if (draft) {
        return (
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography component="span" variant="caption" sx={{ fontSize: 11, color: '#25D366', fontWeight: 700, flexShrink: 0 }}>Borrador:</Typography>
                <Typography component="span" variant="caption" noWrap sx={{ fontSize: 11, color: 'text.secondary' }}>{draft}</Typography>
            </Box>
        );
    }
    if (conv.mensajes?.[0] && conv.mensajes[0].tipo !== 'sistema') {
        const m = conv.mensajes[0];
        const previewTipo = { image: '📷 Imagen', audio: '🎵 Audio', document: '📄 Documento', contacts: '📇 Contacto', video: '🎬 Video', sticker: '🎭 Sticker', reaction: m.contenido?.emoji ?? '😀 Reacción' };
        return m.contenido?.text ?? previewTipo[m.tipo] ?? `[${m.tipo}]`;
    }
    return '';
})()}
                                            </Typography>
                                        )}
                                    </Box>
                                }
                            />
                        </ListItemButton>
                        );
                    })}
                </List>
                )}
                {isLazy && (convs.length < (total ?? 0) || loadingMore) && (
                    <Box ref={sentinelRef} sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                        {loadingMore && convs.length > 0 && <CircularProgress size={14} />}
                    </Box>
                )}
            </Collapse>
            <Divider />
        </>
    );
}

export default function WapiInbox() {
    const { permisos, user } = useAuth();
    const esAdmin = permisos.includes('wapi.inbox.admin');
    const myUserId = user?.sub;
    const isMobile = useMediaQuery('(max-width:768px)');

    const [convs, setConvs] = useState([]);
    const [convActiva, setConvActiva] = useState(null);
    const [mensajes, setMensajes] = useState([]);
    const [texto, setTexto] = useState('');
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMensajes, setLoadingMensajes] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const [messageStatuses, setMessageStatuses] = useState({});
    const [adjunto, setAdjunto] = useState(null);
    const fileInputRef = useRef(null);

    const [configs, setConfigs] = useState([]);
    const [selectedConfigId, setSelectedConfigId] = useState(() => {
        const saved = localStorage.getItem('wapi_inbox_selected_config');
        return saved ? parseInt(saved, 10) : null;
    });

    const [dialogAsignar, setDialogAsignar] = useState(false);
    const [usuarios, setUsuarios] = useState([]);
    const [asignarUserId, setAsignarUserId] = useState('');
    const [asignando, setAsignando] = useState(false);

    const [typingNums, setTypingNums] = useState(new Set());
    const [busqueda, setBusqueda] = useState('');

    const [respuestasRapidas, setRespuestasRapidas] = useState([]);
    const [rrOpen, setRrOpen] = useState(false);
    const [rrBusqueda, setRrBusqueda] = useState('');
    const [rrTagFiltro, setRrTagFiltro] = useState('');
    const [rrIndexActivo, setRrIndexActivo] = useState(0);

    const [contextMenu, setContextMenu] = useState(null); // { mouseX, mouseY, conv }
    const [drafts, setDrafts] = useState({}); // { [convId]: texto }

    const [resumenModal, setResumenModal] = useState(false);
    const [resumenTexto, setResumenTexto] = useState('');
    const [loadingResumen, setLoadingResumen] = useState(false);
    const [loadingSugerencia, setLoadingSugerencia] = useState(false);

    // ── Resueltas paginadas ───────────────────────────────────────────────────
    const [resueltasMias, setResueltasMias] = useState([]);
    const [totalResueltasMias, setTotalResueltasMias] = useState(0);
    const [loadingResueltas, setLoadingResueltas] = useState(false);
    // ── Búsqueda server-side ──────────────────────────────────────────────────
    const [resultadosServidor, setResultadosServidor] = useState([]);
    const [buscandoServidor, setBuscandoServidor] = useState(false);

    // ── Notas de cierre ───────────────────────────────────────────────────────
    const [dialogCierre, setDialogCierre] = useState(false);
    const [notaCierre, setNotaCierre] = useState('');
    const [resolviendoConv, setResolviendoConv] = useState(false);
    const [panelCierresAbierto, setPanelCierresAbierto] = useState(false);
    const [flashCierreId, setFlashCierreId] = useState(null);
    const cierreRefs = useRef({});

    const mensajesEndRef = useRef(null);
    const socketRef = useRef(null);
    const convActivaRef = useRef(null);
    const mostrarNotificacionRef = useRef(null);
    const typingTimers = useRef({});
    const inputAreaRef = useRef(null);
    const rrListRef = useRef(null);

    // Mantener refs actualizadas para handlers de socket
    useEffect(() => { convActivaRef.current = convActiva; }, [convActiva]);

    // ── Secciones derivadas del array convs ───────────────────────────────
    // Filtrado local por línea seleccionada
    const convsFiltradas = selectedConfigId !== null
        ? convs.filter(c => c.configId === selectedConfigId)
        : convs;

    const misActivas       = convsFiltradas.filter(c => c.asignadoAId === myUserId && c.estado !== 'resuelta');
    const sinAsignar       = convsFiltradas.filter(c => c.estado === 'sin_asignar');
    const otrasActivas     = esAdmin ? convsFiltradas.filter(c => c.asignadoAId && c.asignadoAId !== myUserId && c.estado !== 'resuelta') : [];

    // ── Búsqueda server-side ──────────────────────────────────────────────
    const terminoBusqueda = busqueda.trim();

    // ── Cargar conversaciones ──────────────────────────────────────────────
    const cargarConvs = useCallback(async () => {
        setLoadingConvs(true);
        try {
            const { data } = await api.get('/wapi/inbox');
            setConvs(data);
        } catch {
            setError('Error cargando conversaciones');
        } finally {
            setLoadingConvs(false);
        }
    }, []);

    useEffect(() => { cargarConvs(); }, [cargarConvs]);

    // ── Cargar resueltas paginadas ─────────────────────────────────────────
    const cargarResueltas = useCallback(async (page) => {
        if (loadingResueltas) return;
        setLoadingResueltas(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '25' });
            if (selectedConfigId !== null) params.set('configId', String(selectedConfigId));
            const { data } = await api.get(`/wapi/inbox/resueltas?${params}`);
            setResueltasMias(prev => page === 0 ? data.items : [...prev, ...data.items]);
            setTotalResueltasMias(data.total);
        } catch {
            // silencioso
        } finally {
            setLoadingResueltas(false);
        }
    }, [selectedConfigId, loadingResueltas]);

    // Resetear resueltas al cambiar de línea
    useEffect(() => {
        setResueltasMias([]);
        setTotalResueltasMias(0);
    }, [selectedConfigId]);

    // ── Búsqueda server-side con debounce ─────────────────────────────────
    useEffect(() => {
        const q = busqueda.trim();
        if (q.length < 2) {
            setResultadosServidor([]);
            setBuscandoServidor(false);
            return;
        }
        setBuscandoServidor(true);
        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ q });
                if (selectedConfigId !== null) params.set('configId', String(selectedConfigId));
                const { data } = await api.get(`/wapi/inbox/buscar?${params}`);
                setResultadosServidor(data.items ?? []);
            } catch {
                setResultadosServidor([]);
            } finally {
                setBuscandoServidor(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [busqueda, selectedConfigId]);

    // Cargar configs activas
    useEffect(() => {
        api.get('/wapi/config/lineas')
            .then(r => setConfigs(r.data))
            .catch(() => {});
    }, []);

    // Cargar respuestas rápidas
    useEffect(() => {
        api.get('/wapi/respuestas-rapidas')
            .then(r => setRespuestasRapidas(r.data))
            .catch(() => {});
    }, []);

    // Pedir permiso de notificaciones al montar
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const mostrarNotificacion = useCallback((conv, mensaje) => {
        if (mensaje.fromMe) return;
        if (mensaje.tipo === 'sistema') return;
        if (document.visibilityState === 'visible' && convActivaRef.current?.id === conv.id) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const nombre = conv.nombre ?? conv.numero ?? 'Nuevo mensaje';
        const cuerpo = mensaje.contenido?.text
            ?? (mensaje.tipo === 'button' ? `[Botón] ${mensaje.contenido?.buttonText ?? ''}` : `[${mensaje.tipo}]`);

        const notif = new Notification(`💬 ${nombre}`, {
            body: cuerpo,
            icon: '/favicon.ico',
            tag: `wapi-conv-${conv.id}`,
            renotify: true,
        });

        notif.onclick = () => {
            window.focus();
            notif.close();
        };
    }, []);

    // Mantener ref actualizada para el handler del socket
    useEffect(() => { mostrarNotificacionRef.current = mostrarNotificacion; }, [mostrarNotificacion]);

    // ── Helpers para actualizar convs ──────────────────────────────────────
    const upsertConv = (conv) => {
        if (conv.estado === 'resuelta') {
            // Sacar del listado activo
            setConvs(prev => prev.filter(c => c.id !== conv.id));
            // Actualizar en resueltas si ya las cargamos
            setResueltasMias(prev => {
                const idx = prev.findIndex(c => c.id === conv.id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], ...conv };
                    return updated;
                }
                // Prepend solo si ya hay items cargados (no auto-cargar)
                if (prev.length > 0) return [conv, ...prev];
                return prev;
            });
        } else {
            // Sacar de resueltas si estaba (conv reactivada)
            setResueltasMias(prev => prev.filter(c => c.id !== conv.id));
            setConvs(prev => {
                const idx = prev.findIndex(c => c.id === conv.id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], ...conv };
                    return updated.sort((a, b) => new Date(b.ultimoMensajeAt) - new Date(a.ultimoMensajeAt));
                }
                return [conv, ...prev];
            });
        }
    };

    // ── Socket.IO ──────────────────────────────────────────────────────────
    useEffect(() => {
        const socket = io(import.meta.env.VITE_HOST_SOCKET);
        socketRef.current = socket;

        socket.on('connect', () => socket.emit('join_inbox'));

        socket.on('wapi:nuevo_mensaje', ({ conversacion, mensaje, configId }) => {
            // Filtrar si hay una línea seleccionada
            const sel = selectedConfigId;
            if (sel !== null && configId !== sel) return;

            upsertConv({ ...conversacion, ultimoMensajeAt: mensaje.timestamp, mensajes: [mensaje] });
            setConvActiva(prev => {
                if (prev?.id === conversacion.id) {
                    setMensajes(m => m.some(x => x.id === mensaje.id) ? m : [...m, mensaje]);
                }
                return prev?.id === conversacion.id ? { ...prev, ...conversacion } : prev;
            });
            mostrarNotificacionRef.current?.(conversacion, mensaje);
        });

        socket.on('wapi:conversacion_actualizada', (data) => {
            const { configId, ...conv } = data;
            // Filtrar si hay una línea seleccionada
            const sel = selectedConfigId;
            if (sel !== null && configId !== sel) return;

            upsertConv(conv);
            setConvActiva(prev => prev?.id === conv.id ? { ...prev, ...conv } : prev);
        });

        socket.on('wapi:mensaje_status', ({ waMessageId, status, configId }) => {
            // Filtrar si hay una línea seleccionada
            const sel = selectedConfigId;
            if (sel !== null && configId !== sel) return;

            setMessageStatuses(prev => ({ ...prev, [waMessageId]: status }));
        });

        socket.on('wapi:typing', ({ numero, configId }) => {
            // Filtrar si hay una línea seleccionada
            const sel = selectedConfigId;
            if (sel !== null && configId !== sel) return;

            setTypingNums(prev => new Set([...prev, numero]));
            clearTimeout(typingTimers.current[numero]);
            typingTimers.current[numero] = setTimeout(() => {
                setTypingNums(prev => { const s = new Set(prev); s.delete(numero); return s; });
            }, 5000);
        });

        return () => {
            socket.disconnect();
            Object.values(typingTimers.current).forEach(clearTimeout);
        };
    }, []);

    useEffect(() => {
        mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [mensajes]);

    // ── Abrir conversación ─────────────────────────────────────────────────
    const abrirConv = async (conv) => {
        setPanelCierresAbierto(false);
        cierreRefs.current = {};
        // Guardar borrador de la conversación actual antes de cambiar
        if (convActiva && convActiva.id !== conv.id) {
            setDrafts(prev => {
                const next = { ...prev };
                if (texto.trim()) {
                    next[convActiva.id] = texto;
                } else {
                    delete next[convActiva.id];
                }
                return next;
            });
        }
        // Restaurar borrador de la conversación que se abre
        setTexto(drafts[conv.id] ?? '');
        setRrOpen(false);
        setRrBusqueda('');
        setConvActiva(conv);
        setMensajes([]);
        setMessageStatuses({});
        setLoadingMensajes(true);
        try {
            const { data } = await api.get(`/wapi/inbox/${conv.id}`);
            setConvActiva(data);
            setMensajes(data.mensajes ?? []);
            // Marcar como leído y resetear badge
            api.post(`/wapi/inbox/${conv.id}/marcar-leido`).catch(() => {});
            setConvs(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
            setResueltasMias(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
        } catch {
            setError('Error cargando mensajes');
        } finally {
            setLoadingMensajes(false);
        }
    };

    // ── Context menu de conversación ──────────────────────────────────────
    const handleContextMenuConv = (e, conv) => {
        setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, conv });
    };

    const handleMarcarNoLeido = async () => {
        const conv = contextMenu?.conv;
        setContextMenu(null);
        if (!conv) return;
        try {
            await api.post(`/wapi/inbox/${conv.id}/marcar-no-leido`);
            setConvs(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 1 } : c));
            if (convActiva?.id === conv.id) setConvActiva(prev => ({ ...prev, unreadCount: 1 }));
        } catch {
            setError('Error al marcar como no leído');
        }
    };

    // ── Tomar conversación ─────────────────────────────────────────────────
    const tomarConv = async (convId) => {
        try {
            const { data } = await api.post(`/wapi/inbox/${convId}/tomar`);
            upsertConv(data);
            if (convActiva?.id === convId) setConvActiva(prev => ({ ...prev, ...data }));
        } catch {
            setError('Error al tomar la conversación');
        }
    };

    // ── Resolver conversación ──────────────────────────────────────────────
    const abrirDialogCierre = () => {
        setNotaCierre('');
        setDialogCierre(true);
    };

    const confirmarCierre = async (nota) => {
        if (!convActiva) return;
        setResolviendoConv(true);
        try {
            const { data } = await api.post(`/wapi/inbox/${convActiva.id}/resolver`, { nota: nota || undefined });
            upsertConv(data);
            setConvActiva(prev => ({ ...prev, ...data }));
            setDialogCierre(false);
            setNotaCierre('');
        } catch {
            setError('Error al resolver la conversación');
        } finally {
            setResolviendoConv(false);
        }
    };

    // ── Adjunto ────────────────────────────────────────────────────────────
    const handleAdjunto = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const tipo = file.type.startsWith('image/') ? 'image'
            : file.type.startsWith('audio/') ? 'audio'
            : file.type.startsWith('video/') ? 'video'
            : 'document';
        const preview = tipo === 'image' ? URL.createObjectURL(file) : null;
        setAdjunto({ file, preview, tipo });
        e.target.value = '';
    };

    const quitarAdjunto = () => {
        if (adjunto?.preview) URL.revokeObjectURL(adjunto.preview);
        setAdjunto(null);
    };

    // ── Enviar mensaje ─────────────────────────────────────────────────────
    const enviarMensaje = async () => {
        if (!convActiva || convActiva.estado === 'sin_asignar') return;
        if (!texto.trim() && !adjunto) return;
        setEnviando(true);
        const textoEnviar = texto.trim();
        const adjuntoEnviar = adjunto;
        setTexto('');
        setAdjunto(null);
        setDrafts(prev => { const n = { ...prev }; delete n[convActiva.id]; return n; });
        try {
            if (adjuntoEnviar) {
                const formData = new FormData();
                formData.append('file', adjuntoEnviar.file);
                if (textoEnviar) formData.append('caption', textoEnviar);
                await api.post(`/wapi/inbox/${convActiva.id}/media`, formData);
            } else {
                await api.post(`/wapi/inbox/${convActiva.id}/mensajes`, { texto: textoEnviar });
            }
        } catch (e) {
            setError(e?.response?.data?.message || 'Error al enviar el mensaje');
            setTexto(textoEnviar);
            setAdjunto(adjuntoEnviar);
        } finally {
            setEnviando(false);
        }
    };

    // ── IA: Resumen ────────────────────────────────────────────────────────
    const abrirResumen = async () => {
        if (!convActiva) return;
        setResumenModal(true);
        setResumenTexto('');
        setLoadingResumen(true);
        try {
            const { data } = await api.post(`/wapi/inbox/${convActiva.id}/ai/resumen`);
            setResumenTexto(data.resumen);
        } catch (err) {
            const status = err?.response?.status;
            setResumenTexto(status === 429
                ? '⚠️ El servicio de IA está temporalmente saturado. Cerrá y volvé a intentar en unos segundos.'
                : '⚠️ No se pudo generar el resumen. Verificá la conexión e intentá de nuevo.'
            );
        } finally {
            setLoadingResumen(false);
        }
    };

    // ── IA: Sugerencia ─────────────────────────────────────────────────────
    const pedirSugerencia = async () => {
        if (!convActiva) return;
        setLoadingSugerencia(true);
        try {
            const { data } = await api.post(`/wapi/inbox/${convActiva.id}/ai/sugerencia`);
            if (data.sugerencia) setTexto(data.sugerencia);
        } catch (err) {
            const status = err?.response?.status;
            setError(status === 429
                ? 'IA temporalmente saturada. Intentá en unos segundos.'
                : 'No se pudo generar la sugerencia. Intentá de nuevo.'
            );
        } finally {
            setLoadingSugerencia(false);
        }
    };

    // ── Asignar (admin) ────────────────────────────────────────────────────
    const abrirDialogAsignar = async () => {
        if (!usuarios.length) {
            const { data } = await api.get('/usuarios');
            setUsuarios(data);
        }
        setAsignarUserId('');
        setDialogAsignar(true);
    };

    const confirmarAsignar = async () => {
        if (!asignarUserId || !convActiva) return;
        setAsignando(true);
        try {
            const { data } = await api.post(`/wapi/inbox/${convActiva.id}/asignar`, { userId: asignarUserId });
            upsertConv(data);
            setConvActiva(prev => ({ ...prev, ...data }));
            setDialogAsignar(false);
        } catch {
            setError('Error al asignar la conversación');
        } finally {
            setAsignando(false);
        }
    };

    // ── Media proxy ────────────────────────────────────────────────────────
    const mediaBlobCache = useRef({});
    const mediaUrl = useCallback((mediaId) => {
        if (mediaBlobCache.current[mediaId]) return mediaBlobCache.current[mediaId];
        const base = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
        const token = localStorage.getItem('token');
        fetch(`${base}/wapi/inbox/media/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                mediaBlobCache.current[mediaId] = url;
                setMessageStatuses(prev => ({ ...prev }));
            })
            .catch(() => null);
        return null;
    }, []);

    // ── Render contenido mensaje ───────────────────────────────────────────
    const renderContenido = (msg) => {
        const c = msg.contenido ?? {};
        if (msg.tipo === 'text') return c.text ?? '';
        if (msg.tipo === 'button') return `[Botón] ${c.buttonText ?? ''}${c.buttonPayload ? ` (${c.buttonPayload})` : ''}`;
        if (msg.tipo === 'image') {
            const url = mediaUrl(c.mediaUrl);
            return (
                <Box>
                    {url
                        ? <Box component="img" src={url} alt="imagen" sx={{ maxWidth: 240, maxHeight: 240, borderRadius: 1, display: 'block', cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />
                        : <Box sx={{ width: 180, height: 100, bgcolor: 'action.hover', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={20} /></Box>
                    }
                    {c.caption && <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>{c.caption}</Typography>}
                </Box>
            );
        }
        if (msg.tipo === 'audio') {
            const url = mediaUrl(c.mediaUrl);
            return url
                ? <Box component="audio" controls sx={{ maxWidth: 240, display: 'block' }}><source src={url} /></Box>
                : <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CircularProgress size={16} /><Typography variant="caption">Cargando...</Typography></Box>;
        }
        if (msg.tipo === 'document') {
            const url = mediaUrl(c.mediaUrl);
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">📄 {c.filename || c.caption || 'Documento'}</Typography>
                    {url ? <Button size="small" variant="outlined" href={url} download={c.filename || c.caption || 'documento'}>Descargar</Button> : <CircularProgress size={16} />}
                </Box>
            );
        }
        if (msg.tipo === 'sticker') {
            const url = mediaUrl(c.mediaUrl ?? c.raw?.sticker?.id);
            return url
                ? <Box component="img" src={url} alt="sticker" sx={{ width: 140, height: 140, objectFit: 'contain', display: 'block' }} />
                : <Typography variant="caption" color="text.secondary">🎭 Sticker</Typography>;
        }
        if (msg.tipo === 'reaction') {
            const emoji = c.emoji ?? c.raw?.reaction?.emoji;
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 28, lineHeight: 1 }}>{emoji}</Typography>
                    <Typography variant="caption" color="text.secondary">reaccionó a un mensaje</Typography>
                </Box>
            );
        }
        if (msg.tipo === 'contacts') {
            const lista = c.contacts ?? (c.raw?.contacts ?? []).map(ct => ({
                nombre: ct.name?.formatted_name ?? ct.name?.first_name ?? 'Contacto',
                telefonos: (ct.phones ?? []).map(p => p.phone),
                emails: (ct.emails ?? []).map(e => e.email),
                empresa: ct.org?.company ?? null,
            }));
            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {lista.map((ct, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 200, bgcolor: 'background.paper' }}>
                            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 16 }}>
                                {ct.nombre?.[0]?.toUpperCase() ?? '?'}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={700} noWrap>{ct.nombre}</Typography>
                                {ct.telefonos?.[0] && (
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                        📞 {ct.telefonos[0]}
                                    </Typography>
                                )}
                                {ct.empresa && (
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                        🏢 {ct.empresa}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    ))}
                </Box>
            );
        }
        return `[${msg.tipo}]`;
    };

    const puedeEnviar = convActiva && convActiva.estado !== 'sin_asignar' && convActiva.estado !== 'resuelta';

    const campañaNombre = mensajes.find(m => m.tipo === 'sistema' && m.contenido?.tipo === 'ficha_contacto')?.contenido?.campañaNombre ?? null;

    // Derivar respuestas rápidas
    const rrTags = [...new Set(respuestasRapidas.flatMap(r => r.tags ?? []))].sort();
    const rrFiltradas = respuestasRapidas.filter(r => {
        const matchTag = !rrTagFiltro || (r.tags ?? []).includes(rrTagFiltro);
        const q = rrBusqueda.replace(/^\//, '').toLowerCase().trim();
        const matchQ = !q || r.titulo.toLowerCase().includes(q) || r.contenido.toLowerCase().includes(q);
        return matchTag && matchQ;
    });

    // ── Layout ─────────────────────────────────────────────────────────────
    return (
        <Box sx={{
            display: 'flex',
            height: 'calc(100vh - 64px)',
            overflow: 'hidden',
            bgcolor: 'background.default',
            // Salir del padding del contenedor para ocupar el ancho completo en mobile
            mx: { xs: -1.5, sm: -2, md: 0 },
        }}>
            {/* Panel izquierdo — en mobile se oculta cuando hay conv activa */}
            <Paper elevation={2} sx={{
                width: isMobile ? '100%' : 320,
                minWidth: isMobile ? 'unset' : 260,
                display: (!isMobile || !convActiva) ? 'flex' : 'none',
                flexDirection: 'column',
                borderRadius: 0,
                borderRight: '1px solid',
                borderColor: 'divider',
            }}>
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" fontWeight={700}>Inbox WA</Typography>
                    <IconButton size="small" onClick={cargarConvs}><RefreshIcon /></IconButton>
                </Box>

                {/* Buscador por ANI / nombre */}
                <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Buscar por número o nombre..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5 }} />,
                            endAdornment: busqueda ? (
                                <IconButton size="small" onClick={() => setBusqueda('')} edge="end">
                                    <CloseIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            ) : null,
                        }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4, fontSize: 13 } }}
                    />
                </Box>

                {/* Selector de línea (multi-línea) */}
                {configs.length > 0 && (
                    <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <ToggleButtonGroup
                            value={selectedConfigId}
                            exclusive
                            onChange={(_, v) => {
                                setSelectedConfigId(v);
                                localStorage.setItem('wapi_inbox_selected_config', v ?? '');
                            }}
                            size="small"
                            sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
                        >
                            <ToggleButton value={null} sx={{ flex: 1, minWidth: 60, fontSize: 11, py: 0.5 }}>
                                Todas
                            </ToggleButton>
                            {configs.map(c => (
                                <ToggleButton
                                    key={c.id}
                                    value={c.id}
                                    sx={{ flex: 1, minWidth: 60, fontSize: 11, py: 0.5 }}
                                >
                                    {c.nombre ?? `Línea ${c.id}`}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    </Box>
                )}

                {error && <Alert severity="error" onClose={() => setError('')} sx={{ m: 1, py: 0.25 }}>{error}</Alert>}

                <Box sx={{ overflowY: 'auto', flex: 1 }}>
                    {loadingConvs ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
                    ) : terminoBusqueda.length >= 2 ? (
                        /* Modo búsqueda server-side */
                        <>
                            {buscandoServidor && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                    <CircularProgress size={20} />
                                </Box>
                            )}
                            {!buscandoServidor && (
                                <SeccionLista
                                    titulo={`Resultados (${resultadosServidor.length})`}
                                    convs={resultadosServidor}
                                    convActivaId={convActiva?.id}
                                    onSelect={abrirConv}
                                    color="primary.main"
                                    defaultOpen={true}
                                    typingNums={typingNums}
                                    onContextMenuConv={handleContextMenuConv}
                                    drafts={drafts}
                                    configs={configs}
                                    selectedConfigId={selectedConfigId}
                                />
                            )}
                            {!buscandoServidor && !resultadosServidor.length && (
                                <Box sx={{ p: 4, textAlign: 'center' }}>
                                    <Typography color="text.secondary" variant="body2">Sin resultados para "{busqueda}"</Typography>
                                </Box>
                            )}
                        </>
                    ) : (
                        /* Modo normal — secciones */
                        <>
                            <SeccionLista
                                titulo="Mis conversaciones activas"
                                convs={misActivas}
                                convActivaId={convActiva?.id}
                                onSelect={abrirConv}
                                color="primary.main"
                                defaultOpen={true}
                                typingNums={typingNums}
                                onContextMenuConv={handleContextMenuConv}
                                drafts={drafts}
                                configs={configs}
                                selectedConfigId={selectedConfigId}
                            />
                            <SeccionLista
                                titulo="Sin asignar"
                                convs={sinAsignar}
                                convActivaId={convActiva?.id}
                                onSelect={abrirConv}
                                color="warning.main"
                                defaultOpen={true}
                                typingNums={typingNums}
                                onContextMenuConv={handleContextMenuConv}
                                drafts={drafts}
                                configs={configs}
                                selectedConfigId={selectedConfigId}
                            />
                            {esAdmin && (
                                <SeccionLista
                                    titulo="Asignadas a otros"
                                    convs={otrasActivas}
                                    convActivaId={convActiva?.id}
                                    onSelect={abrirConv}
                                    color="info.main"
                                    defaultOpen={false}
                                    typingNums={typingNums}
                                    onContextMenuConv={handleContextMenuConv}
                                    configs={configs}
                                    selectedConfigId={selectedConfigId}
                                />
                            )}
                            <SeccionLista
                                key={`resueltas-${selectedConfigId ?? 'todas'}`}
                                titulo="Resueltas"
                                convs={resueltasMias}
                                convActivaId={convActiva?.id}
                                onSelect={abrirConv}
                                color="text.disabled"
                                defaultOpen={false}
                                typingNums={typingNums}
                                onContextMenuConv={handleContextMenuConv}
                                drafts={drafts}
                                configs={configs}
                                selectedConfigId={selectedConfigId}
                                onLoadMore={cargarResueltas}
                                total={totalResueltasMias}
                                loadingMore={loadingResueltas}
                            />
                            {!misActivas.length && !sinAsignar.length && !resueltasMias.length && !otrasActivas.length && !totalResueltasMias && (
                                <Box sx={{ p: 4, textAlign: 'center' }}>
                                    <Typography color="text.secondary">Sin conversaciones</Typography>
                                </Box>
                            )}
                        </>
                    )}
                </Box>
            </Paper>

            {/* Panel derecho — chat (en mobile ocupa todo el ancho cuando hay conv activa) */}
            {(!isMobile || convActiva) && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {convActiva ? (
                <>
                    {/* Header del chat */}
                    <Paper elevation={1} square sx={{ px: { xs: 1, sm: 2 }, py: 1.5, display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, borderBottom: '1px solid', borderColor: 'divider', position: 'relative', zIndex: 2 }}>
                        {/* Botón volver — solo mobile */}
                        {isMobile && (
                            <IconButton edge="start" onClick={() => setConvActiva(null)} size="small">
                                <ArrowBackIcon />
                            </IconButton>
                        )}
                        <Avatar sx={{ width: { xs: 34, sm: 40 }, height: { xs: 34, sm: 40 }, bgcolor: convActiva.estado === 'resuelta' ? '#757575' : convActiva.estado === 'sin_asignar' ? '#E65100' : '#00695C' }}>
                            {(convActiva.nombre ?? convActiva.numero)[0].toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={700} noWrap>{convActiva.nombre ?? convActiva.numero}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: { xs: 'nowrap', sm: 'wrap' }, overflow: 'hidden' }}>
                                {typingNums.has(convActiva.numero) ? (
                                    <Typography variant="caption" color="success.main" sx={{ fontStyle: 'italic', flexShrink: 0 }}>Escribiendo...</Typography>
                                ) : (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{convActiva.numero}</Typography>
                                )}
                                <Chip
                                    label={{ sin_asignar: 'Sin asignar', asignada: 'Asignada', resuelta: 'Resuelta' }[convActiva.estado]}
                                    color={{ sin_asignar: 'warning', asignada: 'info', resuelta: 'default' }[convActiva.estado]}
                                    size="small" sx={{ height: 18, fontSize: 10, flexShrink: 0 }}
                                />
                                {convActiva.asignadoA && (
                                    <Chip
                                        icon={<AccountCircleIcon sx={{ fontSize: '14px !important' }} />}
                                        label={convActiva.asignadoA.nombre}
                                        size="small" color="info" variant="outlined"
                                        sx={{ height: 18, fontSize: 10, flexShrink: 0, maxWidth: { xs: 100, sm: 'none' } }}
                                    />
                                )}
                                {!convActiva.ventanaAbierta && convActiva.estado !== 'sin_asignar' && (
                                    <Chip icon={<LockClockIcon sx={{ fontSize: '14px !important' }} />} label="Ventana cerrada" size="small" color="error" sx={{ height: 18, fontSize: 10, flexShrink: 0 }} />
                                )}
                                {campañaNombre && (
                                    <Tooltip title="Campaña de origen">
                                        <Chip
                                            label={campañaNombre}
                                            size="small"
                                            color="secondary"
                                            variant="outlined"
                                            sx={{ height: 18, fontSize: 10, maxWidth: 140, display: { xs: 'none', sm: 'inline-flex' } }}
                                        />
                                    </Tooltip>
                                )}
                                {convActiva.config && configs.length > 1 && (
                                    <Chip
                                        label={convActiva.config.nombre ?? `Línea ${convActiva.config.id}`}
                                        size="small"
                                        color="info"
                                        variant="outlined"
                                        sx={{ height: 18, fontSize: 10, display: { xs: 'none', sm: 'inline-flex' } }}
                                    />
                                )}
                                <Tooltip title="ID de contacto — clic para copiar">
                                    <Chip
                                        label={`#${convActiva.id}`}
                                        size="small"
                                        variant="outlined"
                                        onClick={() => navigator.clipboard.writeText(String(convActiva.id))}
                                        sx={{ height: 18, fontSize: 10, cursor: 'pointer', fontFamily: 'monospace', letterSpacing: 0.5, display: { xs: 'none', sm: 'inline-flex' } }}
                                    />
                                </Tooltip>
                            </Box>
                        </Box>
                        {mensajes.length > 0 && (
                            <Tooltip title="Fecha del último mensaje">
                                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 1.5, bgcolor: 'action.hover', flexShrink: 0 }}>
                                    <CalendarTodayIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                                    <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>
                                        {formatHeaderDate(mensajes[mensajes.length - 1]?.timestamp)}
                                    </Typography>
                                </Box>
                            </Tooltip>
                        )}
                        {(convActiva.cierres?.length > 0) && (
                            <Tooltip title={panelCierresAbierto ? 'Ocultar notas de cierre' : 'Ver notas de cierre'}>
                                <Box
                                    onClick={() => setPanelCierresAbierto(v => !v)}
                                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: { xs: 0.5, sm: 1 }, py: 0.5, borderRadius: 1.5, bgcolor: panelCierresAbierto ? 'warning.main' : 'action.hover', flexShrink: 0, cursor: 'pointer', transition: 'background 0.2s' }}
                                >
                                    <Badge badgeContent={convActiva.cierres.length} color="warning" sx={{ '& .MuiBadge-badge': { fontSize: 9, minWidth: 14, height: 14, display: { xs: 'flex', sm: 'none' } } }}>
                                        <NoteAltOutlinedIcon sx={{ fontSize: 13, color: panelCierresAbierto ? 'white' : 'text.disabled' }} />
                                    </Badge>
                                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: panelCierresAbierto ? 'white' : 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
                                        {convActiva.cierres.length} {convActiva.cierres.length === 1 ? 'nota' : 'notas'}
                                    </Typography>
                                    {panelCierresAbierto ? <ExpandLessIcon sx={{ fontSize: 13, color: 'white', display: { xs: 'none', sm: 'block' } }} /> : <ExpandMoreIcon sx={{ fontSize: 13, color: 'text.disabled', display: { xs: 'none', sm: 'block' } }} />}
                                </Box>
                            </Tooltip>
                        )}
                        {convActiva.estado === 'sin_asignar' && (
                            <Tooltip title="Tomar conversación">
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<AccountCircleIcon />}
                                    onClick={() => tomarConv(convActiva.id)}
                                    sx={{
                                        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                                        boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 10px 3px rgba(25,118,210,0.7)' : '0 2px 8px rgba(25,118,210,0.4)',
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #1565c0 0%, #1e88e5 100%)',
                                            boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 16px 5px rgba(25,118,210,0.9)' : '0 2px 14px rgba(25,118,210,0.6)',
                                        },
                                    }}
                                >
                                    Tomar
                                </Button>
                            </Tooltip>
                        )}
                        {esAdmin && (
                            <Tooltip title="Asignar a asesor">
                                <IconButton
                                    size="small"
                                    onClick={abrirDialogAsignar}
                                    sx={{
                                        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                                        color: 'white',
                                        width: 30, height: 30,
                                        boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 10px 3px rgba(25,118,210,0.7)' : '0 2px 8px rgba(25,118,210,0.4)',
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #1565c0 0%, #1e88e5 100%)',
                                            boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 16px 5px rgba(25,118,210,0.9)' : '0 2px 14px rgba(25,118,210,0.6)',
                                        },
                                    }}
                                >
                                    <PersonAddIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                            </Tooltip>
                        )}
                        {convActiva.estado === 'asignada' && (
                            <Tooltip title="Marcar como resuelta">
                                <IconButton
                                    size="small"
                                    onClick={abrirDialogCierre}
                                    sx={{
                                        background: 'linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%)',
                                        color: 'white',
                                        width: 30, height: 30,
                                        boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 10px 3px rgba(46,125,50,0.7)' : '0 2px 8px rgba(46,125,50,0.4)',
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #1b5e20 0%, #43a047 100%)',
                                            boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 16px 5px rgba(46,125,50,0.9)' : '0 2px 14px rgba(46,125,50,0.6)',
                                        },
                                    }}
                                >
                                    <CheckCircleIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                            </Tooltip>
                        )}
                        <Tooltip title="Resumen IA con Gemini">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={abrirResumen}
                                    disabled={loadingResumen}
                                    sx={{
                                        background: 'linear-gradient(135deg, #4f8ef7 0%, #a259f7 100%)',
                                        color: 'white',
                                        width: 30, height: 30,
                                        boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 10px 3px rgba(79,142,247,0.7)' : '0 2px 8px rgba(79,142,247,0.45)',
                                        '@keyframes aiGlow': {
                                            '0%':   { boxShadow: '0 0 6px 1px rgba(79,142,247,0.5)' },
                                            '50%':  { boxShadow: '0 0 18px 4px rgba(162,89,247,0.75)' },
                                            '100%': { boxShadow: '0 0 6px 1px rgba(79,142,247,0.5)' },
                                        },
                                        '@keyframes aiSpin': {
                                            from: { transform: 'rotate(0deg)' },
                                            to:   { transform: 'rotate(360deg)' },
                                        },
                                        animation: loadingResumen ? 'aiGlow 1.4s ease-in-out infinite' : 'none',
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #3a7be0 0%, #8b3fe0 100%)',
                                            boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 18px 5px rgba(162,89,247,0.85)' : '0 2px 14px rgba(162,89,247,0.6)',
                                        },
                                        '&.Mui-disabled': { opacity: 0.7 },
                                    }}
                                >
                                    <AutoAwesomeIcon sx={{
                                        fontSize: 17,
                                        animation: loadingResumen ? 'aiSpin 1.4s linear infinite' : 'none',
                                    }} />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Paper>

                    {/* Panel colapsable de notas de cierre */}
                    <Collapse in={panelCierresAbierto} unmountOnExit>
                        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: (t) => t.palette.mode === 'dark' ? '#1e1a0e' : '#fffbeb', maxHeight: 220, overflowY: 'auto' }}>
                            {(convActiva.cierres ?? []).slice().reverse().map((cierre, idx) => (
                                <Box
                                    key={cierre.id ?? idx}
                                    onClick={() => {
                                        const ref = cierreRefs.current[cierre.id];
                                        if (ref) {
                                            ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            setFlashCierreId(cierre.id);
                                            setTimeout(() => setFlashCierreId(null), 1200);
                                        }
                                    }}
                                    sx={{
                                        px: 2, py: 1.25,
                                        display: 'flex', alignItems: 'flex-start', gap: 1.5,
                                        borderBottom: '1px solid', borderColor: 'divider',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s',
                                        '&:hover': { bgcolor: (t) => t.palette.mode === 'dark' ? '#2a2500' : '#fef3c7' },
                                        '&:last-child': { borderBottom: 'none' },
                                    }}
                                >
                                    <LockOutlinedIcon sx={{ fontSize: 15, color: '#d97706', mt: 0.3, flexShrink: 0 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <Typography variant="caption" fontWeight={600} sx={{ color: '#d97706' }}>
                                                {cierre.usuario?.nombre ?? 'Sistema'}
                                            </Typography>
                                            <Typography variant="caption" color="text.disabled">
                                                {new Date(cierre.creadoAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" sx={{ fontSize: 12, color: cierre.nota ? 'text.primary' : 'text.disabled', fontStyle: cierre.nota ? 'normal' : 'italic', mt: 0.25 }}>
                                            {cierre.nota ?? 'Sin nota'}
                                        </Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Collapse>

                    {/* Mensajes */}
                    <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1, bgcolor: (t) => t.palette.mode === 'dark' ? '#1a1a2e' : '#e5ddd5' }}>
                        {loadingMensajes ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress /></Box>
                        ) : (() => {
                            // Construir mapa de reacciones: { [waMessageId]: emoji }
                            const reactionMap = {};
                            mensajes.forEach(m => {
                                if (m.tipo === 'reaction') {
                                    const targetId = m.contenido?.messageId ?? m.contenido?.raw?.reaction?.message_id;
                                    const emoji = m.contenido?.emoji ?? m.contenido?.raw?.reaction?.emoji;
                                    if (targetId && emoji) reactionMap[targetId] = emoji;
                                }
                            });
                            const filteredMsgs = mensajes.filter(m => m.tipo !== 'reaction');
                            const cierres = (convActiva?.cierres ?? []).slice().sort((a, b) => new Date(a.creadoAt) - new Date(b.creadoAt));
                            let cierreIdx = 0;
                            const elements = [];
                            let lastDateKey = null;
                            filteredMsgs.forEach((msg) => {
                                // Insertar marcadores de cierre que ocurrieron antes de este mensaje
                                while (cierreIdx < cierres.length && new Date(cierres[cierreIdx].creadoAt) <= new Date(msg.timestamp)) {
                                    const c = cierres[cierreIdx++];
                                    elements.push(
                                        <Box
                                            key={`cierre-${c.id}`}
                                            ref={el => { cierreRefs.current[c.id] = el; }}
                                            sx={{
                                                display: 'flex', alignItems: 'center', my: 1.5, transition: 'background 0.4s',
                                                bgcolor: flashCierreId === c.id ? (t => t.palette.mode === 'dark' ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.15)') : 'transparent',
                                                borderRadius: 2, px: 1,
                                            }}
                                        >
                                            <Box sx={{ flex: 1, height: '1px', bgcolor: '#f59e0b44' }} />
                                            <Box sx={{ mx: 1.5, display: 'flex', alignItems: 'center', gap: 0.75, bgcolor: (t) => t.palette.mode === 'dark' ? '#2a1f00' : '#fef3c7', border: '1px solid #f59e0b55', borderRadius: 2, px: 1.25, py: 0.4 }}>
                                                <LockOutlinedIcon sx={{ fontSize: 11, color: '#d97706' }} />
                                                <Typography variant="caption" sx={{ fontSize: 10.5, color: '#d97706', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                    Cerrado por {c.usuario?.nombre ?? 'Sistema'}
                                                    {c.nota ? ` · "${c.nota.length > 40 ? c.nota.slice(0, 40) + '…' : c.nota}"` : ''}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ flex: 1, height: '1px', bgcolor: '#f59e0b44' }} />
                                        </Box>
                                    );
                                }

                                const msgDateKey = msg.timestamp ? new Date(msg.timestamp).toDateString() : null;
                                if (msgDateKey && msgDateKey !== lastDateKey) {
                                    elements.push(
                                        <Box key={`divider-${msgDateKey}`} sx={{ display: 'flex', alignItems: 'center', my: 1.5 }}>
                                            <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                                            <Typography variant="caption" sx={{ mx: 1.5, color: 'text.disabled', fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap', userSelect: 'none' }}>
                                                {formatDividerDate(msg.timestamp)}
                                            </Typography>
                                            <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                                        </Box>
                                    );
                                    lastDateKey = msgDateKey;
                                }
                            // ── Burbuja de sistema (ficha de contacto) ──
                            if (msg.tipo === 'sistema') {
                                const c = msg.contenido ?? {};
                                const datos = c.datos ?? {};
                                const tieneDatos = Object.keys(datos).length > 0;
                                elements.push(
                                    <Box key={msg.id} sx={{ display: 'flex', justifyContent: 'center', my: 0.5 }}>
                                        <Paper elevation={0} sx={{
                                            px: 2, py: 1.25, maxWidth: '85%', width: '100%',
                                            borderRadius: 2,
                                            border: '2px solid',
                                            borderColor: '#f59e0b',
                                            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(245,158,11,0.1)' : '#fffbeb',
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                                                <InfoOutlinedIcon sx={{ fontSize: 15, color: '#d97706' }} />
                                                <Typography variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: '#d97706' }}>
                                                    Ficha de contacto — generado por el sistema
                                                </Typography>
                                            </Box>
                                            {c.nombre && (
                                                <Typography variant="body2" fontWeight="bold" mb={0.5}>
                                                    {c.nombre}
                                                </Typography>
                                            )}
                                            {tieneDatos && (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                                                    {Object.entries(datos).map(([k, v]) => (
                                                        <Typography key={k} sx={{ fontSize: 15 }} color="text.secondary">
                                                            <Box component="span" fontWeight="bold" color="text.primary">{k}:</Box> {v}
                                                        </Typography>
                                                    ))}
                                                </Box>
                                            )}
                                            {c.campañaNombre && (
                                                <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>
                                                    Campaña: {c.campañaNombre}
                                                </Typography>
                                            )}
                                        </Paper>
                                    </Box>
                                );
                            }

                            // ── Burbuja normal ──
                            const reaccion = reactionMap[msg.waMessageId];
                            elements.push(
                                <Box key={msg.id} sx={{ display: 'flex', justifyContent: msg.fromMe ? 'flex-end' : 'flex-start' }}>
                                    <Box sx={{ position: 'relative', maxWidth: '70%', mb: reaccion ? 1.5 : 0 }}>
                                        <Paper elevation={1} sx={{
                                            px: 1.5, py: 0.75,
                                            borderRadius: msg.fromMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                            bgcolor: (t) => msg.fromMe
                                                ? (t.palette.mode === 'dark' ? '#005c4b' : '#dcf8c6')
                                                : (t.palette.mode === 'dark' ? '#2a2a2a' : '#fff'),
                                        }}>
                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                {renderContenido(msg)}
                                            </Typography>
                                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                                                    {formatHora(msg.timestamp)}
                                                </Typography>
                                                {msg.fromMe && (() => {
                                                    const st = messageStatuses[msg.waMessageId] ?? msg.status ?? 'sent';
                                                    if (st === 'read') return <DoneAllIcon sx={{ fontSize: 14, color: '#34B7F1' }} />;
                                                    if (st === 'delivered') return <DoneAllIcon sx={{ fontSize: 14, color: 'text.secondary' }} />;
                                                    return <DoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />;
                                                })()}
                                            </Box>
                                        </Paper>
                                        {reaccion && (
                                            <Box sx={{
                                                position: 'absolute', bottom: -20,
                                                right: msg.fromMe ? 4 : 'auto',
                                                left: msg.fromMe ? 'auto' : 4,
                                                bgcolor: (t) => t.palette.mode === 'dark' ? '#3a3a3a' : '#fff',
                                                border: '1px solid', borderColor: 'divider',
                                                borderRadius: '10px', px: 0.6, py: 0.1,
                                                fontSize: 14, lineHeight: 1.6,
                                                boxShadow: 1, zIndex: 1,
                                            }}>
                                                {reaccion}
                                            </Box>
                                        )}
                                    </Box>
                                </Box>
                            );
                            });
                            // Insertar cierres que quedaron después del último mensaje
                            while (cierreIdx < cierres.length) {
                                const c = cierres[cierreIdx++];
                                elements.push(
                                    <Box
                                        key={`cierre-${c.id}`}
                                        ref={el => { cierreRefs.current[c.id] = el; }}
                                        sx={{
                                            display: 'flex', alignItems: 'center', my: 1.5, transition: 'background 0.4s',
                                            bgcolor: flashCierreId === c.id ? (t => t.palette.mode === 'dark' ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.15)') : 'transparent',
                                            borderRadius: 2, px: 1,
                                        }}
                                    >
                                        <Box sx={{ flex: 1, height: '1px', bgcolor: '#f59e0b44' }} />
                                        <Box sx={{ mx: 1.5, display: 'flex', alignItems: 'center', gap: 0.75, bgcolor: (t) => t.palette.mode === 'dark' ? '#2a1f00' : '#fef3c7', border: '1px solid #f59e0b55', borderRadius: 2, px: 1.25, py: 0.4 }}>
                                            <LockOutlinedIcon sx={{ fontSize: 11, color: '#d97706' }} />
                                            <Typography variant="caption" sx={{ fontSize: 10.5, color: '#d97706', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                Cerrado por {c.usuario?.nombre ?? 'Sistema'}
                                                {c.nota ? ` · "${c.nota.length > 40 ? c.nota.slice(0, 40) + '…' : c.nota}"` : ''}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ flex: 1, height: '1px', bgcolor: '#f59e0b44' }} />
                                    </Box>
                                );
                            }
                            return elements;
                        })()}
                        <div ref={mensajesEndRef} />
                    </Box>

                    {/* Input */}
                    <Paper square elevation={1} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                        {convActiva.estado === 'sin_asignar' ? (
                            <Alert severity="warning" sx={{ m: 1.5, py: 0.5 }}>
                                Tomá o asigná esta conversación antes de responder.
                            </Alert>
                        ) : !convActiva.ventanaAbierta ? (
                            <Alert severity="warning" sx={{ m: 1.5, py: 0.5 }}>
                                Ventana de 24hs cerrada. Solo se pueden enviar templates aprobados.
                            </Alert>
                        ) : convActiva.estado === 'resuelta' ? (
                            <Alert severity="info" sx={{ m: 1.5, py: 0.5 }}>
                                Conversación resuelta. Si el cliente escribe, se reabrirá automáticamente.
                            </Alert>
                        ) : (
                            <>
                                {adjunto && (
                                    <Box sx={{ px: 2, pt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {adjunto.tipo === 'image' && <Box component="img" src={adjunto.preview} sx={{ height: 60, borderRadius: 1 }} />}
                                        {adjunto.tipo !== 'image' && <Typography variant="caption">{adjunto.tipo === 'audio' ? '🎵' : adjunto.tipo === 'video' ? '🎬' : '📄'} {adjunto.file.name}</Typography>}
                                        <IconButton size="small" onClick={quitarAdjunto}><CloseIcon fontSize="small" /></IconButton>
                                    </Box>
                                )}
                                <Box ref={inputAreaRef} sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                    <input type="file" ref={fileInputRef} hidden accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleAdjunto} />
                                    <Tooltip title="Adjuntar archivo">
                                        <span style={{ marginTop: '5px' }}>
                                            <IconButton
                                                size="small"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={enviando}
                                                sx={{
                                                    background: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                                    color: 'text.secondary',
                                                    width: 30, height: 30,
                                                    '&:hover': {
                                                        background: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                                                        boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 10px 2px rgba(255,255,255,0.15)' : '0 2px 8px rgba(0,0,0,0.15)',
                                                    },
                                                    '&.Mui-disabled': { opacity: 0.4 },
                                                }}
                                            >
                                                <AttachFileIcon sx={{ fontSize: 17 }} />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="Plantillas rápidas (/)">
                                        <span style={{ marginTop: '5px' }}>
                                            <IconButton
                                                size="small"
                                                onClick={() => { setRrOpen(o => !o); setRrBusqueda(''); setRrTagFiltro(''); setRrIndexActivo(0); }}
                                                disabled={enviando}
                                                sx={{
                                                    background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                                                    color: 'white',
                                                    width: 30, height: 30,
                                                    boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 10px 3px rgba(245,158,11,0.65)' : '0 2px 8px rgba(245,158,11,0.4)',
                                                    '&:hover': {
                                                        background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                                                        boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 16px 5px rgba(245,158,11,0.85)' : '0 2px 14px rgba(245,158,11,0.6)',
                                                    },
                                                    '&.Mui-disabled': { opacity: 0.4 },
                                                }}
                                            >
                                                <BoltIcon sx={{ fontSize: 17 }} />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="Sugerir respuesta con IA">
                                        <span style={{ marginTop: '5px' }}>
                                            <IconButton
                                                size="small"
                                                onClick={pedirSugerencia}
                                                disabled={enviando || loadingSugerencia}
                                                sx={{
                                                    background: 'linear-gradient(135deg, #4f8ef7 0%, #a259f7 100%)',
                                                    color: 'white',
                                                    width: 30, height: 30,
                                                    boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 10px 3px rgba(79,142,247,0.7)' : '0 2px 8px rgba(79,142,247,0.45)',
                                                    '@keyframes aiGlow': {
                                                        '0%':   { boxShadow: '0 0 6px 1px rgba(79,142,247,0.5)' },
                                                        '50%':  { boxShadow: '0 0 18px 4px rgba(162,89,247,0.75)' },
                                                        '100%': { boxShadow: '0 0 6px 1px rgba(79,142,247,0.5)' },
                                                    },
                                                    '@keyframes aiSpin': {
                                                        from: { transform: 'rotate(0deg)' },
                                                        to:   { transform: 'rotate(360deg)' },
                                                    },
                                                    animation: loadingSugerencia ? 'aiGlow 1.4s ease-in-out infinite' : 'none',
                                                    '&:hover': {
                                                        background: 'linear-gradient(135deg, #3a7be0 0%, #8b3fe0 100%)',
                                                        boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 18px 5px rgba(162,89,247,0.85)' : '0 2px 14px rgba(162,89,247,0.6)',
                                                    },
                                                    '&.Mui-disabled': { opacity: 0.5 },
                                                }}
                                            >
                                                <AutoAwesomeIcon sx={{
                                                    fontSize: 17,
                                                    animation: loadingSugerencia ? 'aiSpin 1.4s linear infinite' : 'none',
                                                }} />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <TextField
                                        multiline maxRows={4} fullWidth size="small"
                                        placeholder={adjunto ? 'Agregar descripción (opcional)...' : 'Escribir mensaje...'}
                                        value={texto}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setTexto(val);
                                            if (val.startsWith('/')) {
                                                setRrBusqueda(val);
                                                setRrIndexActivo(0);
                                                setRrOpen(true);
                                            } else {
                                                setRrOpen(false);
                                                setRrBusqueda('');
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (rrOpen) {
                                                if (e.key === 'ArrowDown') { e.preventDefault(); setRrIndexActivo(i => Math.min(i + 1, rrFiltradas.length - 1)); return; }
                                                if (e.key === 'ArrowUp') { e.preventDefault(); setRrIndexActivo(i => Math.max(i - 1, 0)); return; }
                                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (rrFiltradas[rrIndexActivo]) { setTexto(rrFiltradas[rrIndexActivo].contenido); setRrOpen(false); setRrBusqueda(''); } return; }
                                                if (e.key === 'Escape') { setRrOpen(false); setRrBusqueda(''); return; }
                                            }
                                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); }
                                        }}
                                        disabled={enviando}
                                        inputProps={{ spellCheck: true, lang: 'es' }}
                                        inputRef={(el) => { if (el) { el.spellcheck = true; el.lang = 'es'; } }}
                                    />
                                    <IconButton
                                        onClick={enviarMensaje}
                                        disabled={(!texto.trim() && !adjunto) || enviando}
                                        sx={{
                                            mt: '5px',
                                            background: (!texto.trim() && !adjunto) || enviando ? 'transparent' : 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                                            color: ((!texto.trim() && !adjunto) || enviando) ? 'text.disabled' : 'white',
                                            width: 30, height: 30,
                                            boxShadow: (t) => ((!texto.trim() && !adjunto) || enviando) ? 'none' : t.palette.mode === 'dark' ? '0 0 10px 3px rgba(25,118,210,0.7)' : '0 2px 8px rgba(25,118,210,0.4)',
                                            transition: 'all 0.2s ease',
                                            '&:hover': {
                                                background: 'linear-gradient(135deg, #1565c0 0%, #1e88e5 100%)',
                                                boxShadow: (t) => t.palette.mode === 'dark' ? '0 0 16px 5px rgba(25,118,210,0.9)' : '0 2px 14px rgba(25,118,210,0.6)',
                                            },
                                            '&.Mui-disabled': { background: 'transparent' },
                                        }}
                                    >
                                        {enviando ? <CircularProgress size={16} /> : <SendIcon sx={{ fontSize: 17 }} />}
                                    </IconButton>
                                </Box>
                                <Popper open={rrOpen} anchorEl={inputAreaRef.current} placement="top-start" transition style={{ zIndex: 1300, width: inputAreaRef.current?.offsetWidth ?? 400 }}>
                                    {({ TransitionProps }) => (
                                        <Fade {...TransitionProps} timeout={150}>
                                            <Paper elevation={8} sx={{ mb: 0.5, maxHeight: 380, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                                                <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                        <Typography variant="caption" fontWeight={700} color="text.secondary">PLANTILLAS RÁPIDAS</Typography>
                                                        <IconButton size="small" onClick={() => setRrOpen(false)}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
                                                    </Box>
                                                    {rrTags.length > 0 && (
                                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                            <Chip label="Todas" size="small" color={!rrTagFiltro ? 'primary' : 'default'} onClick={() => { setRrTagFiltro(''); setRrIndexActivo(0); }} sx={{ cursor: 'pointer', height: 20, fontSize: 10 }} />
                                                            {rrTags.map(tag => (
                                                                <Chip key={tag} label={tag} size="small" color={rrTagFiltro === tag ? 'primary' : 'default'} onClick={() => { setRrTagFiltro(rrTagFiltro === tag ? '' : tag); setRrIndexActivo(0); }} sx={{ cursor: 'pointer', height: 20, fontSize: 10 }} />
                                                            ))}
                                                        </Box>
                                                    )}
                                                </Box>
                                                <Divider />
                                                <Box ref={rrListRef} sx={{ overflowY: 'auto', flex: 1 }}>
                                                    {rrFiltradas.length === 0 ? (
                                                        <Box sx={{ p: 2, textAlign: 'center' }}>
                                                            <Typography variant="caption" color="text.secondary">Sin resultados</Typography>
                                                        </Box>
                                                    ) : rrFiltradas.map((rr, idx) => (
                                                        <Box
                                                            key={rr.id}
                                                            onClick={() => { setTexto(rr.contenido); setRrOpen(false); setRrBusqueda(''); }}
                                                            sx={{
                                                                px: 2, py: 1.25, cursor: 'pointer',
                                                                bgcolor: idx === rrIndexActivo ? 'action.selected' : 'transparent',
                                                                '&:hover': { bgcolor: 'action.hover' },
                                                                borderBottom: '1px solid',
                                                                borderColor: 'divider',
                                                            }}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                                                                <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>{rr.titulo}</Typography>
                                                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                                    {(rr.tags ?? []).map(tag => (
                                                                        <Chip key={tag} label={tag} size="small" sx={{ height: 16, fontSize: 9 }} />
                                                                    ))}
                                                                </Box>
                                                            </Box>
                                                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                                                {rr.contenido.substring(0, 80)}{rr.contenido.length > 80 ? '...' : ''}
                                                            </Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                                <Divider />
                                                <Box sx={{ px: 1.5, py: 0.75, bgcolor: 'action.hover' }}>
                                                    <Typography variant="caption" color="text.secondary">↑↓ navegar · Enter insertar · Esc cerrar · / filtrar</Typography>
                                                </Box>
                                            </Paper>
                                        </Fade>
                                    )}
                                </Popper>
                            </>
                        )}
                    </Paper>
                </>
            ) : (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                    <AccountCircleIcon sx={{ fontSize: 80, opacity: 0.15 }} />
                    <Typography variant="h6" color="text.secondary">Seleccioná una conversación</Typography>
                </Box>
            )}
            </Box>
            )}

            {/* Dialog cierre con nota */}
            <Dialog open={dialogCierre} onClose={() => !resolviendoConv && setDialogCierre(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LockOutlinedIcon sx={{ color: '#d97706' }} />
                    Cerrar conversación
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Podés dejar una nota opcional explicando el motivo del cierre.
                    </Typography>
                    <TextField
                        autoFocus
                        multiline
                        rows={3}
                        fullWidth
                        placeholder='Ej: "Contactado por teléfono", "Resuelto por email"…'
                        value={notaCierre}
                        onChange={e => setNotaCierre(e.target.value)}
                        inputProps={{ maxLength: 500 }}
                        helperText={`${notaCierre.length}/500`}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogCierre(false)} disabled={resolviendoConv}>Cancelar</Button>
                    <Button onClick={() => confirmarCierre()} disabled={resolviendoConv} color="inherit">
                        Cerrar sin nota
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => confirmarCierre(notaCierre)}
                        disabled={resolviendoConv || !notaCierre.trim()}
                        sx={{ bgcolor: '#d97706', '&:hover': { bgcolor: '#b45309' } }}
                        startIcon={resolviendoConv ? <CircularProgress size={14} color="inherit" /> : null}
                    >
                        Cerrar con nota
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog asignar */}
            <Dialog open={dialogAsignar} onClose={() => setDialogAsignar(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Asignar conversación</DialogTitle>
                <DialogContent>
                    <Autocomplete
                        sx={{ mt: 1 }}
                        options={usuarios}
                        getOptionLabel={u => `${u.nombre} (${u.email})`}
                        value={usuarios.find(u => u.id === asignarUserId) ?? null}
                        onChange={(_, u) => setAsignarUserId(u?.id ?? '')}
                        renderInput={(params) => <TextField {...params} label="Asesor" placeholder="Buscar..." />}
                        noOptionsText="Sin resultados"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogAsignar(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={confirmarAsignar} disabled={!asignarUserId || asignando}>
                        {asignando ? <CircularProgress size={20} /> : 'Asignar'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modal resumen IA */}
            <Dialog open={resumenModal} onClose={() => setResumenModal(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoAwesomeIcon sx={{ fontSize: 20, background: 'linear-gradient(135deg, #4f8ef7, #a259f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }} />
                    <Box component="span" sx={{ background: 'linear-gradient(135deg, #4f8ef7 0%, #a259f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>
                        Resumen IA
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {loadingResumen ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                            <AutoAwesomeIcon sx={{
                                fontSize: 36,
                                background: 'linear-gradient(135deg, #4f8ef7, #a259f7)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                '@keyframes aiSpin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
                                animation: 'aiSpin 1.4s linear infinite',
                            }} />
                            <Typography variant="body2" sx={{
                                '@keyframes shimmer': {
                                    '0%':   { backgroundPosition: '-200% center' },
                                    '100%': { backgroundPosition: '200% center' },
                                },
                                background: 'linear-gradient(90deg, #4f8ef7 25%, #a259f7 50%, #4f8ef7 75%)',
                                backgroundSize: '200% auto',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                animation: 'shimmer 1.8s linear infinite',
                                fontWeight: 600,
                            }}>
                                Analizando conversación...
                            </Typography>
                        </Box>
                    ) : (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8, mt: 1 }}>
                            {resumenTexto}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResumenModal(false)}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            {/* Context menu click derecho en conversación */}
            <Menu
                open={!!contextMenu}
                onClose={() => setContextMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
            >
                <MenuItem
                    onClick={handleMarcarNoLeido}
                    disabled={contextMenu?.conv?.unreadCount > 0}
                >
                    <MarkChatUnreadIcon fontSize="small" sx={{ mr: 1 }} />
                    Marcar como no leído
                </MenuItem>
            </Menu>
        </Box>
    );
}
