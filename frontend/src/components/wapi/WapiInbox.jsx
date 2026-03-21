import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box, Typography, Paper, TextField, IconButton, Chip, Avatar, List,
    ListItemAvatar, ListItemText, ListItemButton, Divider, CircularProgress,
    Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Select, MenuItem, FormControl, InputLabel, Alert, Collapse,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LockClockIcon from '@mui/icons-material/LockClock';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { io } from 'socket.io-client';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

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

function SeccionLista({ titulo, convs, convActivaId, onSelect, color = 'text.secondary', defaultOpen = true, badge }) {
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
                    {convs.map(conv => (
                        <ListItemButton key={conv.id} selected={convActivaId === conv.id} onClick={() => onSelect(conv)} sx={{ py: 0.75 }}>
                            <ListItemAvatar sx={{ minWidth: 44 }}>
                                <Avatar sx={{ width: 34, height: 34, fontSize: 14, bgcolor: conv.estado === 'resuelta' ? '#757575' : conv.estado === 'sin_asignar' ? '#E65100' : '#00695C' }}>
                                    {(conv.nombre ?? conv.numero)[0].toUpperCase()}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1, fontSize: 13 }}>
                                            {conv.nombre ?? conv.numero}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, flexShrink: 0 }}>
                                            {formatFecha(conv.ultimoMensajeAt)}
                                        </Typography>
                                    </Box>
                                }
                                secondary={
                                    <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                        {conv.asignadoA && (
                                            <Typography component="span" variant="caption" noWrap sx={{ fontSize: 10, color: 'info.main', fontWeight: 500 }}>
                                                👤 {conv.asignadoA.nombre}
                                            </Typography>
                                        )}
                                        <Typography component="span" variant="caption" noWrap sx={{ fontSize: 11, color: 'text.secondary' }}>
                                            {conv.mensajes?.[0] && conv.mensajes[0].tipo !== 'sistema' ? (conv.mensajes[0].contenido?.text ?? `[${conv.mensajes[0].tipo}]`) : ''}
                                        </Typography>
                                    </Box>
                                }
                            />
                        </ListItemButton>
                    ))}
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

    const mensajesEndRef = useRef(null);
    const socketRef = useRef(null);
    const convActivaRef = useRef(null);
    const mostrarNotificacionRef = useRef(null);

    // Mantener refs actualizadas para handlers de socket
    useEffect(() => { convActivaRef.current = convActiva; }, [convActiva]);

    // ── Secciones derivadas del array convs ───────────────────────────────
    const misActivas  = convs.filter(c => c.asignadoAId === myUserId && c.estado !== 'resuelta');
    const sinAsignar  = convs.filter(c => c.estado === 'sin_asignar');
    const misResueltas = convs.filter(c => c.asignadoAId === myUserId && c.estado === 'resuelta');
    const otrasActivas = esAdmin ? convs.filter(c => c.asignadoAId && c.asignadoAId !== myUserId && c.estado !== 'resuelta') : [];

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
            upsertConv({ ...conversacion, ultimoMensajeAt: mensaje.timestamp });
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

        return () => socket.disconnect();
    }, []);

    useEffect(() => {
        mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [mensajes]);

    // ── Abrir conversación ─────────────────────────────────────────────────
    const abrirConv = async (conv) => {
        setConvActiva(conv);
        setMensajes([]);
        setMessageStatuses({});
        setLoadingMensajes(true);
        try {
            const { data } = await api.get(`/wapi/inbox/${conv.id}`);
            setConvActiva(data);
            setMensajes(data.mensajes ?? []);
        } catch {
            setError('Error cargando mensajes');
        } finally {
            setLoadingMensajes(false);
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
                    <Typography variant="body2">📄 {c.caption || 'Documento'}</Typography>
                    {url ? <Button size="small" variant="outlined" href={url} download={c.caption || 'documento'}>Descargar</Button> : <CircularProgress size={16} />}
                </Box>
            );
        }
        return `[${msg.tipo}]`;
    };

    const puedeEnviar = convActiva && convActiva.estado !== 'sin_asignar' && convActiva.estado !== 'resuelta';

    // ── Layout ─────────────────────────────────────────────────────────────
    return (
        <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', bgcolor: 'background.default' }}>
            {/* Panel izquierdo */}
            <Paper elevation={2} sx={{ width: 320, minWidth: 260, display: 'flex', flexDirection: 'column', borderRadius: 0, borderRight: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" fontWeight={700}>Inbox WA</Typography>
                    <IconButton size="small" onClick={cargarConvs}><RefreshIcon /></IconButton>
                </Box>

                {error && <Alert severity="error" onClose={() => setError('')} sx={{ m: 1, py: 0.25 }}>{error}</Alert>}

                <Box sx={{ overflowY: 'auto', flex: 1 }}>
                    {loadingConvs ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
                    ) : (
                        <>
                            <SeccionLista
                                titulo="Mis conversaciones activas"
                                convs={misActivas}
                                convActivaId={convActiva?.id}
                                onSelect={abrirConv}
                                color="primary.main"
                                defaultOpen={true}
                            />
                            <SeccionLista
                                titulo="Sin asignar"
                                convs={sinAsignar}
                                convActivaId={convActiva?.id}
                                onSelect={abrirConv}
                                color="warning.main"
                                defaultOpen={true}
                            />
                            {esAdmin && (
                                <SeccionLista
                                    titulo="Asignadas a otros"
                                    convs={otrasActivas}
                                    convActivaId={convActiva?.id}
                                    onSelect={abrirConv}
                                    color="info.main"
                                    defaultOpen={false}
                                />
                            )}
                            <SeccionLista
                                titulo="Resueltas"
                                convs={misResueltas}
                                convActivaId={convActiva?.id}
                                onSelect={abrirConv}
                                color="text.disabled"
                                defaultOpen={false}
                            />
                            {!misActivas.length && !sinAsignar.length && !misResueltas.length && !otrasActivas.length && (
                                <Box sx={{ p: 4, textAlign: 'center' }}>
                                    <Typography color="text.secondary">Sin conversaciones</Typography>
                                </Box>
                            )}
                        </>
                    )}
                </Box>
            </Paper>

            {/* Panel derecho — chat */}
            {convActiva ? (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Header */}
                    <Paper elevation={1} square sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Avatar sx={{ bgcolor: convActiva.estado === 'resuelta' ? '#757575' : convActiva.estado === 'sin_asignar' ? '#E65100' : '#00695C' }}>
                            {(convActiva.nombre ?? convActiva.numero)[0].toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                            <Typography fontWeight={700}>{convActiva.nombre ?? convActiva.numero}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography variant="caption" color="text.secondary">{convActiva.numero}</Typography>
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
                                <IconButton onClick={abrirDialogAsignar}><PersonAddIcon /></IconButton>
                            </Tooltip>
                        )}
                        {convActiva.estado === 'asignada' && (
                            <Tooltip title="Marcar como resuelta">
                                <IconButton color="success" onClick={resolverConv}><CheckCircleIcon /></IconButton>
                            </Tooltip>
                        )}
                    </Paper>

                    {/* Mensajes */}
                    <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1, bgcolor: (t) => t.palette.mode === 'dark' ? '#1a1a2e' : '#e5ddd5' }}>
                        {loadingMensajes ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress /></Box>
                        ) : mensajes.map((msg) => {
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
                            return (
                                <Box key={msg.id} sx={{ display: 'flex', justifyContent: msg.fromMe ? 'flex-end' : 'flex-start' }}>
                                    <Paper elevation={1} sx={{
                                        px: 1.5, py: 0.75, maxWidth: '70%',
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
                                </Box>
                            );
                        })}
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
                                <Box sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                                    <input type="file" ref={fileInputRef} hidden accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleAdjunto} />
                                    <Tooltip title="Adjuntar archivo">
                                        <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={enviando}>
                                            <AttachFileIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <TextField
                                        multiline maxRows={4} fullWidth size="small"
                                        placeholder={adjunto ? 'Agregar descripción (opcional)...' : 'Escribir mensaje...'}
                                        value={texto}
                                        onChange={(e) => setTexto(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); } }}
                                        disabled={enviando}
                                    />
                                    <IconButton color="primary" onClick={enviarMensaje} disabled={(!texto.trim() && !adjunto) || enviando}>
                                        {enviando ? <CircularProgress size={20} /> : <SendIcon />}
                                    </IconButton>
                                </Box>
                            </>
                        )}
                    </Paper>
                </Box>
            ) : (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                    <AccountCircleIcon sx={{ fontSize: 80, opacity: 0.15 }} />
                    <Typography variant="h6" color="text.secondary">Seleccioná una conversación</Typography>
                </Box>
            )}

            {/* Dialog asignar */}
            <Dialog open={dialogAsignar} onClose={() => setDialogAsignar(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Asignar conversación</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ mt: 1 }}>
                        <InputLabel>Asesor</InputLabel>
                        <Select value={asignarUserId} onChange={(e) => setAsignarUserId(e.target.value)} label="Asesor">
                            {usuarios.map(u => <MenuItem key={u.id} value={u.id}>{u.nombre} ({u.email})</MenuItem>)}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogAsignar(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={confirmarAsignar} disabled={!asignarUserId || asignando}>
                        {asignando ? <CircularProgress size={20} /> : 'Asignar'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
