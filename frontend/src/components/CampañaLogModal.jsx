import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    LinearProgress,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PauseIcon from '@mui/icons-material/Pause';
import BlockIcon from '@mui/icons-material/Block';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { io } from 'socket.io-client';
import api from '../api/axios';

const NIVEL_COLORS = {
    ok:    '#3fb950',
    warn:  '#d29922',
    error: '#f85149',
    info:  '#8b949e',
    skip:  '#58a6ff',
};

const NIVEL_BG = {
    ok:    'rgba(63,185,80,0.08)',
    warn:  'rgba(210,153,34,0.08)',
    error: 'rgba(248,81,73,0.08)',
    info:  'transparent',
    skip:  'rgba(88,166,255,0.06)',
};

const MAX_LOGS = 500; // igual al límite del historial en Redis

/**
 * Modal de logs en tiempo real para campañas en procesamiento.
 *
 * Props:
 *   open           - boolean
 *   onClose        - fn
 *   campañaId      - number
 *   campañaNombre  - string
 *   tipo           - 'whatsapp' | 'email'
 *   estadoCampaña  - string
 *   progreso       - { enviados, total } | null   (progreso real desde el padre)
 *   onPausar       - fn | null  (solo WA)
 *   onForzarCierre - fn | null
 */
export default function CampañaLogModal({
    open,
    onClose,
    campañaId,
    campañaNombre,
    tipo,
    estadoCampaña,
    progreso,
    onPausar,
    onForzarCierre,
}) {
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState({ ok: 0, warn: 0, error: 0, skip: 0 });
    const [autoScroll, setAutoScroll] = useState(true);
    const [cargandoHistorial, setCargandoHistorial] = useState(false);
    const bottomRef = useRef(null);
    const scrollRef = useRef(null);
    // timestamp del último log histórico — para evitar duplicar con eventos de socket
    const ultimoHistorialTsRef = useRef(null);

    const contarStats = useCallback((entries) => {
        const acc = { ok: 0, warn: 0, error: 0, skip: 0 };
        for (const e of entries) {
            if (e.nivel in acc) acc[e.nivel]++;
        }
        return acc;
    }, []);

    const agregarLog = useCallback((entry) => {
        setLogs(prev => {
            const next = [...prev, entry];
            return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
        });
        setStats(prev => ({
            ...prev,
            [entry.nivel]: (prev[entry.nivel] ?? 0) + 1,
        }));
    }, []);

    // Al abrir: cargar historial desde Redis, luego conectar socket
    useEffect(() => {
        if (!open || !campañaId) return;

        setLogs([]);
        setStats({ ok: 0, warn: 0, error: 0, skip: 0 });
        setAutoScroll(true);
        ultimoHistorialTsRef.current = null;

        let socket;
        let socketReady = false;
        const pendientes = []; // logs recibidos por socket antes de que llegue el historial

        // 1. Conectar socket inmediatamente para no perder logs durante la carga
        socket = io(import.meta.env.VITE_HOST_SOCKET);
        socket.emit('join_campaña', campañaId);

        socket.on('campania_log', (entry) => {
            if (entry.campañaId !== campañaId) return;
            if (!socketReady) {
                pendientes.push(entry);
            } else {
                // Ignorar si ya viene en el historial (evitar duplicados)
                if (ultimoHistorialTsRef.current && entry.timestamp <= ultimoHistorialTsRef.current) return;
                agregarLog(entry);
            }
        });

        // 2. Cargar historial
        setCargandoHistorial(true);
        api.get(`/campania-logs/${campañaId}?tipo=${tipo === 'whatsapp' ? 'wa' : 'email'}`)
            .then(res => {
                const historico = res.data ?? [];
                if (historico.length > 0) {
                    ultimoHistorialTsRef.current = historico[historico.length - 1].timestamp;
                }
                // Filtrar pendientes que no estén ya en el historial
                const nuevos = pendientes.filter(
                    e => !ultimoHistorialTsRef.current || e.timestamp > ultimoHistorialTsRef.current
                );
                const todos = [...historico, ...nuevos].slice(-MAX_LOGS);
                setLogs(todos);
                setStats(contarStats(todos));
            })
            .catch(() => {
                // Si falla la carga histórica, igual mostramos los pendientes
                setLogs([...pendientes]);
                setStats(contarStats(pendientes));
            })
            .finally(() => {
                socketReady = true;
                setCargandoHistorial(false);
            });

        return () => {
            socket?.disconnect();
        };
    }, [open, campañaId, tipo, agregarLog, contarStats]);

    // Auto-scroll al último log
    useEffect(() => {
        if (autoScroll && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
    };

    const scrollToBottom = () => {
        setAutoScroll(true);
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const descargarLogs = () => {
        const texto = logs
            .map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.nivel.toUpperCase().padEnd(5)}] ${l.mensaje}`)
            .join('\n');
        const blob = new Blob([texto], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-campana-${campañaId}-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const limpiarLogs = () => {
        setLogs([]);
        setStats({ ok: 0, warn: 0, error: 0, skip: 0 });
    };

    const esProcesando = estadoCampaña === 'procesando';
    const progresoPorc = progreso?.total > 0
        ? Math.round((progreso.enviados / progreso.total) * 100)
        : null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    height: '82vh',
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: 2,
                },
            }}
        >
            {/* ── HEADER ── */}
            <DialogTitle sx={{ bgcolor: '#161b22', borderBottom: '1px solid #30363d', color: '#c9d1d9', py: 1.5, px: 2 }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                    <Box flex={1} minWidth={0}>
                        <Stack direction="row" alignItems="center" spacing={1} mb={0.8}>
                            <Typography
                                variant="subtitle1"
                                fontFamily="monospace"
                                fontWeight="bold"
                                color="#e6edf3"
                                noWrap
                                sx={{ lineHeight: 1.3 }}
                            >
                                {tipo === 'whatsapp' ? '📱' : '📧'} {campañaNombre}
                            </Typography>
                            {esProcesando && (
                                <Box sx={{
                                    width: 8, height: 8, borderRadius: '50%', bgcolor: '#3fb950', flexShrink: 0,
                                    animation: 'logPulse 1.5s ease-in-out infinite',
                                    '@keyframes logPulse': {
                                        '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                                        '50%': { opacity: 0.4, transform: 'scale(1.4)' },
                                    },
                                }} />
                            )}
                            {cargandoHistorial && (
                                <CircularProgress size={12} sx={{ color: '#8b949e', flexShrink: 0 }} />
                            )}
                        </Stack>

                        {/* Progreso real (de socket padre) */}
                        {progreso?.total > 0 && (
                            <Box mb={0.8}>
                                <Stack direction="row" justifyContent="space-between" mb={0.3}>
                                    <Typography sx={{ color: '#8b949e', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                                        Progreso real
                                    </Typography>
                                    <Typography sx={{ color: '#c9d1d9', fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 'bold' }}>
                                        {progreso.enviados} / {progreso.total}
                                        {progresoPorc !== null && ` (${progresoPorc}%)`}
                                    </Typography>
                                </Stack>
                                <LinearProgress
                                    variant="determinate"
                                    value={progresoPorc ?? 0}
                                    sx={{
                                        height: 4, borderRadius: 2,
                                        bgcolor: '#21262d',
                                        '& .MuiLinearProgress-bar': { bgcolor: '#3fb950' },
                                    }}
                                />
                            </Box>
                        )}

                        {/* Contadores por nivel del historial visible */}
                        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                            <Chip size="small" label={`✅ ${stats.ok}`} sx={{ bgcolor: '#1c3a28', color: '#3fb950', fontFamily: 'monospace', fontSize: '0.7rem' }} />
                            <Chip size="small" label={`⚠️ ${stats.warn}`} sx={{ bgcolor: '#3a2c1c', color: '#d29922', fontFamily: 'monospace', fontSize: '0.7rem' }} />
                            {tipo === 'email' && (
                                <Chip size="small" label={`⛔ ${stats.skip}`} sx={{ bgcolor: '#1c2a3a', color: '#58a6ff', fontFamily: 'monospace', fontSize: '0.7rem' }} />
                            )}
                            {stats.error > 0 && (
                                <Chip size="small" label={`❌ ${stats.error}`} sx={{ bgcolor: '#3a1c1c', color: '#f85149', fontFamily: 'monospace', fontSize: '0.7rem' }} />
                            )}
                            <Chip size="small" label={`${logs.length} líneas`} sx={{ bgcolor: '#21262d', color: '#8b949e', fontFamily: 'monospace', fontSize: '0.7rem' }} />
                        </Stack>
                    </Box>

                    <IconButton onClick={onClose} size="small" sx={{ color: '#8b949e', flexShrink: 0 }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Stack>
            </DialogTitle>

            {/* ── LOG BODY ── */}
            <DialogContent
                ref={scrollRef}
                onScroll={handleScroll}
                sx={{
                    p: 0,
                    bgcolor: '#0d1117',
                    overflowY: 'auto',
                    flex: 1,
                    position: 'relative',
                    '&::-webkit-scrollbar': { width: 6 },
                    '&::-webkit-scrollbar-track': { bgcolor: '#161b22' },
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#30363d', borderRadius: 3 },
                }}
            >
                <Box sx={{ p: '10px 14px', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.7 }}>
                    {cargandoHistorial && logs.length === 0 ? (
                        <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }} spacing={1}>
                            <CircularProgress size={24} sx={{ color: '#30363d' }} />
                            <Typography sx={{ color: '#484f58', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                Cargando historial...
                            </Typography>
                        </Stack>
                    ) : logs.length === 0 ? (
                        <Typography sx={{ color: '#484f58', fontFamily: 'monospace', fontSize: '0.82rem', mt: 3, textAlign: 'center' }}>
                            {esProcesando
                                ? '⏳ Esperando logs... los mensajes aparecerán aquí en tiempo real.'
                                : '— sin logs disponibles —'}
                        </Typography>
                    ) : (
                        logs.map((log, i) => (
                            <Box
                                key={i}
                                sx={{
                                    display: 'flex',
                                    gap: 1.5,
                                    px: 0.5,
                                    py: '1px',
                                    borderRadius: '3px',
                                    bgcolor: NIVEL_BG[log.nivel] || 'transparent',
                                    '&:hover': { bgcolor: '#161b22' },
                                }}
                            >
                                <Typography component="span" sx={{ color: '#484f58', fontFamily: 'monospace', fontSize: '0.72rem', flexShrink: 0, userSelect: 'none', pt: '1px' }}>
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </Typography>
                                <Typography component="span" sx={{ color: NIVEL_COLORS[log.nivel] || '#c9d1d9', fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>
                                    {log.mensaje}
                                </Typography>
                            </Box>
                        ))
                    )}
                    <div ref={bottomRef} />
                </Box>

                {/* Botón flotante "ir al final" */}
                {!autoScroll && logs.length > 0 && (
                    <Tooltip title="Ir al último log">
                        <IconButton
                            onClick={scrollToBottom}
                            size="small"
                            sx={{
                                position: 'sticky', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                                display: 'flex', bgcolor: '#21262d', color: '#c9d1d9',
                                border: '1px solid #30363d', '&:hover': { bgcolor: '#30363d' }, zIndex: 10,
                            }}
                        >
                            <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
            </DialogContent>

            {/* ── FOOTER ── */}
            <DialogActions sx={{ bgcolor: '#161b22', borderTop: '1px solid #30363d', px: 2, py: 1, gap: 1, flexWrap: 'wrap' }}>
                <Tooltip title="Limpiar pantalla">
                    <span>
                        <IconButton size="small" onClick={limpiarLogs} disabled={logs.length === 0} sx={{ color: '#8b949e' }}>
                            <DeleteSweepIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Descargar logs como .txt">
                    <span>
                        <Button size="small" startIcon={<DownloadIcon />} onClick={descargarLogs} disabled={logs.length === 0}
                            sx={{ color: '#8b949e', textTransform: 'none', fontSize: '0.78rem' }}>
                            Descargar
                        </Button>
                    </span>
                </Tooltip>

                <Box flex={1} />

                {tipo === 'whatsapp' && esProcesando && onPausar && (
                    <Button size="small" variant="outlined" color="warning" startIcon={<PauseIcon />}
                        onClick={() => { onPausar(); onClose(); }}
                        sx={{ textTransform: 'none', fontSize: '0.8rem', borderColor: '#d29922', color: '#d29922', '&:hover': { borderColor: '#f0b429', bgcolor: 'rgba(210,153,34,0.1)' } }}>
                        Pausar campaña
                    </Button>
                )}
                {esProcesando && onForzarCierre && (
                    <Button size="small" variant="contained" color="error" startIcon={<BlockIcon />}
                        onClick={() => { onForzarCierre(); onClose(); }}
                        sx={{ textTransform: 'none', fontSize: '0.8rem' }}>
                        Forzar cierre
                    </Button>
                )}
                <Button onClick={onClose} size="small" sx={{ color: '#8b949e', textTransform: 'none', fontSize: '0.78rem' }}>
                    Cerrar
                </Button>
            </DialogActions>
        </Dialog>
    );
}
