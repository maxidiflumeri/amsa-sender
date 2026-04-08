import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
    IconButton, LinearProgress, Paper, Stack, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import BlockIcon from '@mui/icons-material/Block';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import { io } from 'socket.io-client';
import api from '../../api/axios';

const ESTADO_CHIP = {
    pendiente:  { label: 'Pendiente',  color: 'default' },
    agendada:   { label: 'Agendada',   color: 'info' },
    procesando: { label: 'En vivo',    color: 'success' },
    pausada:    { label: 'Pausada',    color: 'warning' },
    finalizada: { label: 'Finalizada', color: 'default' },
    error:      { label: 'Error',      color: 'error' },
};

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

const MAX_LOGS = 500;

function MetricCard({ label, value, pct, sublabel, color }) {
    return (
        <Card variant="outlined" sx={{ flex: 1, minWidth: 110 }}>
            <CardContent sx={{ p: '12px 16px !important' }}>
                <Typography variant="caption" color="text.secondary" display="block">
                    {label}
                </Typography>
                <Typography variant="h4" fontWeight="bold" color={color ?? 'text.primary'}>
                    {value ?? 0}
                </Typography>
                {pct !== undefined && (
                    <Typography variant="caption" color="text.secondary">
                        {pct}%{sublabel ? ` ${sublabel}` : ''}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

export default function WapiLiveDashboard() {
    const { id } = useParams();
    const campañaId = Number(id);
    const navigate = useNavigate();

    const [campania, setCampania] = useState(null);
    const [enviados, setEnviados] = useState(0);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState({ entregados: 0, leidos: 0, fallidos: 0 });
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accionLoading, setAccionLoading] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [cargandoHistorial, setCargandoHistorial] = useState(false);
    const [error, setError] = useState(null);

    const bottomRef = useRef(null);
    const scrollRef = useRef(null);
    const pollingRef = useRef(null);
    const ultimoHistorialTsRef = useRef(null);

    const agregarLog = useCallback((entry) => {
        setLogs(prev => {
            const next = [...prev, entry];
            return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
        });
    }, []);

    const fetchReportes = useCallback(async () => {
        try {
            const res = await api.get(`/wapi/campanias/${campañaId}/reportes`);
            const { enviados: env, entregados, leidos, fallidos, total: tot } = res.data;
            setStats({ entregados, leidos, fallidos });
            setEnviados(env);
            setTotal(tot);
        } catch { /* silencioso — el socket mantiene enviados/total */ }
    }, [campañaId]);

    // Carga inicial
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const [campRes] = await Promise.all([
                    api.get(`/wapi/campanias/${campañaId}`),
                    fetchReportes(),
                ]);
                setCampania(campRes.data);
            } catch {
                setError('No se pudo cargar la campaña.');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [campañaId, fetchReportes]);

    // Socket + historial de logs
    useEffect(() => {
        if (!campañaId) return;

        setLogs([]);
        ultimoHistorialTsRef.current = null;

        let socketReady = false;
        const pendientes = [];

        const socket = io(import.meta.env.VITE_HOST_SOCKET);
        socket.emit('join_campaña', campañaId);

        socket.on('progreso', ({ campañaId: cid, enviados: env, total: tot }) => {
            if (cid !== campañaId) return;
            setEnviados(env);
            setTotal(tot);
        });

        socket.on('campania_log', (entry) => {
            if (entry.campañaId !== campañaId) return;
            if (!socketReady) {
                pendientes.push(entry);
            } else {
                if (ultimoHistorialTsRef.current && entry.timestamp <= ultimoHistorialTsRef.current) return;
                agregarLog(entry);
            }
        });

        socket.on('campania_estado', ({ campañaId: cid, estado }) => {
            if (cid !== campañaId) return;
            setCampania(prev => prev ? { ...prev, estado } : prev);
            if (estado === 'finalizada') fetchReportes();
        });

        socket.on('campania_finalizada', ({ campañaId: cid }) => {
            if (cid !== campañaId) return;
            setCampania(prev => prev ? { ...prev, estado: 'finalizada' } : prev);
            fetchReportes();
        });

        socket.on('campania_pausada', ({ campañaId: cid }) => {
            if (cid !== campañaId) return;
            setCampania(prev => prev ? { ...prev, estado: 'pausada' } : prev);
        });

        // Historial de logs desde Redis
        setCargandoHistorial(true);
        api.get(`/campania-logs/${campañaId}?tipo=wapi`)
            .then(res => {
                const historico = res.data ?? [];
                if (historico.length > 0) {
                    ultimoHistorialTsRef.current = historico[historico.length - 1].timestamp;
                }
                const nuevos = pendientes.filter(
                    e => !ultimoHistorialTsRef.current || e.timestamp > ultimoHistorialTsRef.current,
                );
                setLogs([...historico, ...nuevos].slice(-MAX_LOGS));
            })
            .catch(() => setLogs([...pendientes]))
            .finally(() => {
                socketReady = true;
                setCargandoHistorial(false);
            });

        return () => socket.disconnect();
    }, [campañaId, agregarLog, fetchReportes]);

    // Polling para entregados/leídos/fallidos (solo mientras procesa)
    useEffect(() => {
        if (campania?.estado !== 'procesando') {
            clearInterval(pollingRef.current);
            return;
        }
        pollingRef.current = setInterval(fetchReportes, 20_000);
        return () => clearInterval(pollingRef.current);
    }, [campania?.estado, fetchReportes]);

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

    const handlePausar = async () => {
        setAccionLoading(true);
        try { await api.post(`/wapi/campanias/${campañaId}/pausar`); }
        catch { } finally { setAccionLoading(false); }
    };

    const handleReanudar = async () => {
        setAccionLoading(true);
        try { await api.post(`/wapi/campanias/${campañaId}/reanudar`); }
        catch { } finally { setAccionLoading(false); }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box p={4}>
                <Alert severity="error">{error}</Alert>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/wapi/campanias')} sx={{ mt: 2 }}>
                    Volver
                </Button>
            </Box>
        );
    }

    const estadoActual = campania?.estado ?? 'pendiente';
    const esProcesando = estadoActual === 'procesando';
    const progresoPorc = total > 0 ? Math.round((enviados / total) * 100) : 0;
    const chip = ESTADO_CHIP[estadoActual] ?? { label: estadoActual, color: 'default' };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* ── Header ── */}
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                <Tooltip title="Volver a campañas">
                    <IconButton onClick={() => navigate('/wapi/campanias')} size="small">
                        <ArrowBackIcon />
                    </IconButton>
                </Tooltip>
                <Box flex={1} minWidth={0}>
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                        <Typography variant="h6" fontWeight="bold" noWrap>
                            {campania?.nombre}
                        </Typography>
                        <Chip label={chip.label} color={chip.color} size="small" />
                        {esProcesando && (
                            <Box sx={{
                                width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', flexShrink: 0,
                                animation: 'livePulse 1.5s ease-in-out infinite',
                                '@keyframes livePulse': {
                                    '0%, 100%': { opacity: 1 },
                                    '50%': { opacity: 0.25 },
                                },
                            }} />
                        )}
                    </Stack>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                    {esProcesando && (
                        <Button
                            variant="outlined"
                            color="warning"
                            size="small"
                            startIcon={<PauseIcon />}
                            onClick={handlePausar}
                            disabled={accionLoading}
                        >
                            Pausar
                        </Button>
                    )}
                    {estadoActual === 'pausada' && (
                        <Button
                            variant="outlined"
                            color="success"
                            size="small"
                            startIcon={<PlayArrowIcon />}
                            onClick={handleReanudar}
                            disabled={accionLoading}
                        >
                            Reanudar
                        </Button>
                    )}
                    <Tooltip title="Actualizar stats">
                        <IconButton size="small" onClick={fetchReportes}>
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Box>

            {/* ── Barra de progreso ── */}
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2" color="text.secondary">Progreso de envíos</Typography>
                    <Typography variant="body2" fontWeight="bold">
                        {enviados} / {total} &nbsp;({progresoPorc}%)
                    </Typography>
                </Stack>
                <LinearProgress
                    variant={total > 0 ? 'determinate' : 'indeterminate'}
                    value={progresoPorc}
                    sx={{ height: 8, borderRadius: 4 }}
                    color={esProcesando ? 'success' : 'inherit'}
                />
            </Paper>

            {/* ── Cards de métricas ── */}
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <MetricCard label="Total contactos" value={total} />
                <MetricCard
                    label="Enviados"
                    value={enviados}
                    pct={pct(enviados, total)}
                    sublabel="del total"
                    color="info.main"
                />
                <MetricCard
                    label="Entregados"
                    value={stats.entregados}
                    pct={pct(stats.entregados, enviados)}
                    sublabel="de enviados"
                    color="primary.main"
                />
                <MetricCard
                    label="Leídos"
                    value={stats.leidos}
                    pct={pct(stats.leidos, enviados)}
                    sublabel="de enviados"
                    color="success.main"
                />
                <MetricCard
                    label="Fallidos"
                    value={stats.fallidos}
                    pct={pct(stats.fallidos, total)}
                    sublabel="del total"
                    color={stats.fallidos > 0 ? 'error.main' : 'text.secondary'}
                />
            </Stack>

            {/* ── Feed de logs ── */}
            <Paper
                variant="outlined"
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    minHeight: 280,
                    bgcolor: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: 2,
                }}
            >
                {/* Log header */}
                <Box sx={{
                    px: 2, py: 1,
                    bgcolor: '#161b22',
                    borderBottom: '1px solid #30363d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                }}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#8b949e', flex: 1 }}>
                        📋 Log en tiempo real
                        {cargandoHistorial && (
                            <CircularProgress size={10} sx={{ ml: 1, color: '#8b949e', verticalAlign: 'middle' }} />
                        )}
                    </Typography>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#484f58' }}>
                        {logs.length} líneas
                    </Typography>
                </Box>

                {/* Log body */}
                <Box
                    ref={scrollRef}
                    onScroll={handleScroll}
                    sx={{
                        flex: 1,
                        overflowY: 'auto',
                        p: '10px 14px',
                        position: 'relative',
                        '&::-webkit-scrollbar': { width: 6 },
                        '&::-webkit-scrollbar-track': { bgcolor: '#161b22' },
                        '&::-webkit-scrollbar-thumb': { bgcolor: '#30363d', borderRadius: 3 },
                    }}
                >
                    {cargandoHistorial && logs.length === 0 ? (
                        <Box display="flex" justifyContent="center" py={4}>
                            <CircularProgress size={20} sx={{ color: '#30363d' }} />
                        </Box>
                    ) : logs.length === 0 ? (
                        <Typography sx={{ color: '#484f58', fontFamily: 'monospace', fontSize: '0.82rem', textAlign: 'center', mt: 3 }}>
                            {esProcesando ? '⏳ Esperando logs...' : '— sin logs disponibles —'}
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
                                <Typography component="span" sx={{
                                    color: '#484f58', fontFamily: 'monospace', fontSize: '0.72rem',
                                    flexShrink: 0, userSelect: 'none', pt: '1px',
                                }}>
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </Typography>
                                <Typography component="span" sx={{
                                    color: NIVEL_COLORS[log.nivel] || '#c9d1d9',
                                    fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all',
                                }}>
                                    {log.mensaje}
                                </Typography>
                            </Box>
                        ))
                    )}
                    <div ref={bottomRef} />
                </Box>

                {/* Botón ir al final */}
                {!autoScroll && logs.length > 0 && (
                    <Box sx={{ position: 'relative', height: 0 }}>
                        <Tooltip title="Ir al último log">
                            <IconButton
                                onClick={() => {
                                    setAutoScroll(true);
                                    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                size="small"
                                sx={{
                                    position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                                    bgcolor: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
                                    '&:hover': { bgcolor: '#30363d' }, zIndex: 10,
                                }}
                            >
                                <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}
