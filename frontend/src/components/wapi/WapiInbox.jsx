import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box, Typography, Paper, TextField, IconButton, Chip, Avatar, List, Badge,
    ListItemAvatar, ListItemText, ListItemButton, Divider, CircularProgress,
    Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Select, MenuItem, FormControl, InputLabel, Alert, Collapse, Autocomplete,
    Popper, Fade, Menu,
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
import { io } from 'socket.io-client';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useMediaQuery } from '@mui/material';

const formatHora = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const formatFecha = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) return formatHora(ts);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
};

function SeccionLista({ titulo, convs, convActivaId, onSelect, color = 'text.secondary', defaultOpen = true, typingNums, onContextMenuConv, drafts = {} }) {
    const [open, setOpen] = useState(defaultOpen);
    if (!convs.length) return null;
    return (
        <>
            <Box
                onClick={() => setOpen(o => !o)}
                sx={{ px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" fontWeight={600} color={color}>{titulo}</Typography>
                    <Chip label={convs.length} size="small" sx={{ height: 16, fontSize: 10 }} />
                </Box>
                {open ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            </Box>
            <Collapse in={open}>
                <List dense disablePadding>
                    {convs.map(conv => {
                        const isTyping = typingNums?.has(conv.numero);
                        const hasUnread = conv.unreadCount > 0;
                        return (
                        <ListItemButton
                            key={conv.id}
                            selected={convActivaId === conv.id}
                            onClick={() => onSelect(conv)}
                            onContextMenu={(e) => { e.preventDefault(); onContextMenuConv?.(e, conv); }}
                            sx={{ py: 0.75 }}
                        >
                            <ListItemAvatar sx={{ minWidth: 44 }}>
                                <Avatar sx={{ width: 34, height: 34, fontSize: 14, bgcolor: conv.estado === 'resuelta' ? '#757575' : conv.estado === 'sin_asignar' ? '#E65100' : '#00695C' }}>
                                    {(conv.nombre ?? conv.numero)[0].toUpperCase()}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="body2" fontWeight={hasUnread ? 700 : 600} noWrap sx={{ flex: 1, fontSize: 13 }}>
                                            {conv.nombre ?? conv.numero}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                            <Typography variant="caption" color={hasUnread ? 'success.main' : 'text.secondary'} sx={{ fontSize: 10 }}>
                                                {formatFecha(conv.ultimoMensajeAt)}
                                            </Typography>
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
                                        {conv.asignadoA && (
                                            <Typography component="span" variant="caption" noWrap sx={{ fontSize: 10, color: 'info.main', fontWeight: 500 }}>
                                                👤 {conv.asignadoA.nombre}
                                            </Typography>
                                        )}
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
    const misActivas       = convs.filter(c => c.asignadoAId === myUserId && c.estado !== 'resuelta');
    const sinAsignar       = convs.filter(c => c.estado === 'sin_asignar');
    const misResueltas     = convs.filter(c => c.asignadoAId === myUserId && c.estado === 'resuelta');
    const otrasActivas     = esAdmin ? convs.filter(c => c.asignadoAId && c.asignadoAId !== myUserId && c.estado !== 'resuelta') : [];
    const resueltasPorOtros = esAdmin ? convs.filter(c => c.estado === 'resuelta' && c.asignadoAId !== myUserId) : [];

    // ── Búsqueda por ANI / nombre ─────────────────────────────────────────
    const terminoBusqueda = busqueda.trim().toLowerCase();
    const resultadosBusqueda = terminoBusqueda
        ? convs.filter(c => {
            if (terminoBusqueda.startsWith('#')) {
                const idBuscado = terminoBusqueda.slice(1);
                return idBuscado !== '' && String(c.id) === idBuscado;
            }
            return (
                c.numero?.toLowerCase().includes(terminoBusqueda) ||
                c.nombre?.toLowerCase().includes(terminoBusqueda)
            );
          })
        : [];

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
        setConvs(prev => {
            const idx = prev.findIndex(c => c.id === conv.id);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], ...conv };
                return updated.sort((a, b) => new Date(b.ultimoMensajeAt) - new Date(a.ultimoMensajeAt));
            }
            // Conv nueva: agregarla solo si me corresponde verla
            return [conv, ...prev];
        });
    };

    // ── Socket.IO ──────────────────────────────────────────────────────────
    useEffect(() => {
        const socket = io(import.meta.env.VITE_HOST_SOCKET);
        socketRef.current = socket;

        socket.on('connect', () => socket.emit('join_inbox'));

        socket.on('wapi:nuevo_mensaje', ({ conversacion, mensaje }) => {
            upsertConv({ ...conversacion, ultimoMensajeAt: mensaje.timestamp, mensajes: [mensaje] });
            setConvActiva(prev => {
                if (prev?.id === conversacion.id) {
                    setMensajes(m => m.some(x => x.id === mensaje.id) ? m : [...m, mensaje]);
                }
                return prev?.id === conversacion.id ? { ...prev, ...conversacion } : prev;
            });
            mostrarNotificacionRef.current?.(conversacion, mensaje);
        });

        socket.on('wapi:conversacion_actualizada', (conv) => {
            upsertConv(conv);
            setConvActiva(prev => prev?.id === conv.id ? { ...prev, ...conv } : prev);
        });

        socket.on('wapi:mensaje_status', ({ waMessageId, status }) => {
            setMessageStatuses(prev => ({ ...prev, [waMessageId]: status }));
        });

        socket.on('wapi:typing', ({ numero }) => {
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
            if (convActiva?.id === convId) setConvActiva(data);
        } catch {
            setError('Error al tomar la conversación');
        }
    };

    // ── Resolver conversación ──────────────────────────────────────────────
    const resolverConv = async () => {
        if (!convActiva) return;
        try {
            const { data } = await api.post(`/wapi/inbox/${convActiva.id}/resolver`);
            upsertConv(data);
            setConvActiva(data);
        } catch {
            setError('Error al resolver la conversación');
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
            setConvActiva(data);
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

                {error && <Alert severity="error" onClose={() => setError('')} sx={{ m: 1, py: 0.25 }}>{error}</Alert>}

                <Box sx={{ overflowY: 'auto', flex: 1 }}>
                    {loadingConvs ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
                    ) : terminoBusqueda ? (
                        /* Modo búsqueda — reemplaza secciones */
                        <>
                            <SeccionLista
                                titulo={`Resultados (${resultadosBusqueda.length})`}
                                convs={resultadosBusqueda}
                                convActivaId={convActiva?.id}
                                onSelect={abrirConv}
                                color="primary.main"
                                defaultOpen={true}
                                typingNums={typingNums}
                                onContextMenuConv={handleContextMenuConv}
                                drafts={drafts}
                            />
                            {!resultadosBusqueda.length && (
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
                                />
                            )}
                            <SeccionLista
                                titulo="Mis resueltas"
                                convs={misResueltas}
                                convActivaId={convActiva?.id}
                                onSelect={abrirConv}
                                color="text.disabled"
                                defaultOpen={false}
                                typingNums={typingNums}
                                onContextMenuConv={handleContextMenuConv}
                                drafts={drafts}
                            />
                            {esAdmin && (
                                <SeccionLista
                                    titulo="Resueltas por otros"
                                    convs={resueltasPorOtros}
                                    convActivaId={convActiva?.id}
                                    onSelect={abrirConv}
                                    color="text.disabled"
                                    defaultOpen={false}
                                    typingNums={typingNums}
                                    onContextMenuConv={handleContextMenuConv}
                                />
                            )}
                            {!misActivas.length && !sinAsignar.length && !misResueltas.length && !otrasActivas.length && !resueltasPorOtros.length && (
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
                    <Paper elevation={1} square sx={{ px: { xs: 1, sm: 2 }, py: 1.5, display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, borderBottom: '1px solid', borderColor: 'divider' }}>
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                {typingNums.has(convActiva.numero) ? (
                                    <Typography variant="caption" color="success.main" sx={{ fontStyle: 'italic' }}>Escribiendo...</Typography>
                                ) : (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{convActiva.numero}</Typography>
                                )}
                                <Chip
                                    label={{ sin_asignar: 'Sin asignar', asignada: 'Asignada', resuelta: 'Resuelta' }[convActiva.estado]}
                                    color={{ sin_asignar: 'warning', asignada: 'info', resuelta: 'default' }[convActiva.estado]}
                                    size="small" sx={{ height: 18, fontSize: 10 }}
                                />
                                {convActiva.asignadoA && (
                                    <Chip
                                        icon={<AccountCircleIcon sx={{ fontSize: '14px !important' }} />}
                                        label={convActiva.asignadoA.nombre}
                                        size="small" color="info" variant="outlined"
                                        sx={{ height: 18, fontSize: 10 }}
                                    />
                                )}
                                {!convActiva.ventanaAbierta && convActiva.estado !== 'sin_asignar' && (
                                    <Chip icon={<LockClockIcon sx={{ fontSize: '14px !important' }} />} label="Ventana cerrada" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />
                                )}
                                {campañaNombre && (
                                    <Tooltip title="Campaña de origen">
                                        <Chip
                                            label={campañaNombre}
                                            size="small"
                                            color="secondary"
                                            variant="outlined"
                                            sx={{ height: 18, fontSize: 10, maxWidth: 140 }}
                                        />
                                    </Tooltip>
                                )}
                                <Tooltip title="ID de contacto — clic para copiar">
                                    <Chip
                                        label={`#${convActiva.id}`}
                                        size="small"
                                        variant="outlined"
                                        onClick={() => navigator.clipboard.writeText(String(convActiva.id))}
                                        sx={{ height: 18, fontSize: 10, cursor: 'pointer', fontFamily: 'monospace', letterSpacing: 0.5 }}
                                    />
                                </Tooltip>
                            </Box>
                        </Box>
                        {convActiva.estado === 'sin_asignar' && (
                            <Tooltip title="Tomar conversación">
                                <Button variant="contained" size="small" startIcon={<AccountCircleIcon />} onClick={() => tomarConv(convActiva.id)}>
                                    Tomar
                                </Button>
                            </Tooltip>
                        )}
                        {esAdmin && (
                            <Tooltip title="Asignar a asesor">
                                <IconButton size="small" onClick={abrirDialogAsignar}><PersonAddIcon /></IconButton>
                            </Tooltip>
                        )}
                        {convActiva.estado === 'asignada' && (
                            <Tooltip title="Marcar como resuelta">
                                <IconButton size="small" color="success" onClick={resolverConv}><CheckCircleIcon /></IconButton>
                            </Tooltip>
                        )}
                    </Paper>

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
                            return mensajes.filter(m => m.tipo !== 'reaction').map((msg) => {
                            // ── Burbuja de sistema (ficha de contacto) ──
                            if (msg.tipo === 'sistema') {
                                const c = msg.contenido ?? {};
                                const datos = c.datos ?? {};
                                const tieneDatos = Object.keys(datos).length > 0;
                                return (
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
                            return (
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
                        })})()}
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
                                <Box ref={inputAreaRef} sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                                    <input type="file" ref={fileInputRef} hidden accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleAdjunto} />
                                    <Tooltip title="Adjuntar archivo">
                                        <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={enviando}>
                                            <AttachFileIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Plantillas rápidas (/)">
                                        <IconButton size="small" onClick={() => { setRrOpen(o => !o); setRrBusqueda(''); setRrTagFiltro(''); setRrIndexActivo(0); }} disabled={enviando}>
                                            <BoltIcon />
                                        </IconButton>
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
                                    <IconButton color="primary" onClick={enviarMensaje} disabled={(!texto.trim() && !adjunto) || enviando}>
                                        {enviando ? <CircularProgress size={20} /> : <SendIcon />}
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
