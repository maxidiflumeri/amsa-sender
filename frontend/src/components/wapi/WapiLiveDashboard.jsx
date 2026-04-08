import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box, Button, Chip, CircularProgress, IconButton,
    Stack, Tooltip, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SendIcon from '@mui/icons-material/Send';
import GroupIcon from '@mui/icons-material/Group';
import { io } from 'socket.io-client';
import api from '../../api/axios';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pct = (num, den) =>
    den > 0 ? `${Math.round((num / den) * 1000) / 10}%` : '0%';

const NIVEL_ICON = { ok: '✅', warn: '⚠️', error: '❌', info: '•', skip: '⛔' };
const NIVEL_COLOR = {
    ok: '#3fb950', warn: '#e3b341', error: '#f85149', info: '#8b949e', skip: '#79c0ff',
};

// ─── Anillo de progreso ────────────────────────────────────────────────────────

function RingProgress({ value, total, enviados, esProcesando }) {
    const theme = useTheme();
    const color = esProcesando ? '#25D366' : '#e3b341';
    const safe = Math.min(Math.max(value, 0), 100);
    return (
        <Box sx={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
            {/* Track */}
            <CircularProgress
                variant="determinate"
                value={100}
                size={130}
                thickness={4}
                sx={{ color: theme.palette.divider, position: 'absolute', top: 0, left: 0 }}
            />
            {/* Value */}
            <CircularProgress
                variant={total > 0 ? 'determinate' : 'indeterminate'}
                value={safe}
                size={130}
                thickness={4}
                sx={{
                    color,
                    position: 'absolute', top: 0, left: 0,
                    filter: esProcesando ? `drop-shadow(0 0 6px ${color}88)` : 'none',
                    transition: 'all 0.6s ease',
                }}
            />
            {/* Label */}
            <Box sx={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 0,
            }}>
                <Typography sx={{ color: 'text.primary', fontWeight: 800, fontSize: 26, lineHeight: 1.1 }}>
                    {total > 0 ? `${Math.round(safe)}%` : '—'}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: 11, fontFamily: 'monospace' }}>
                    {enviados}/{total}
                </Typography>
            </Box>
        </Box>
    );
}

// ─── Fila de métrica ──────────────────────────────────────────────────────────

function MetricRow({ icon, label, value, pctVal, color }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, py: '3px' }}>
            <Box sx={{ color, display: 'flex', flexShrink: 0 }}>{icon}</Box>
            <Typography sx={{ color: 'text.secondary', fontSize: 13, flex: 1 }}>
                {label}
            </Typography>
            <Typography sx={{ color: 'text.primary', fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                {value}
            </Typography>
            {pctVal && (
                <Typography sx={{ color: 'text.disabled', fontSize: 11, minWidth: 42, textAlign: 'right' }}>
                    {pctVal}
                </Typography>
            )}
        </Box>
    );
}

// ─── Tarjeta de campaña ───────────────────────────────────────────────────────

function CampaignCard({ campania: campInicial, onFinished }) {
    const [campania, setCampania] = useState(campInicial);
    const [enviados, setEnviados] = useState(0);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState({ entregados: 0, leidos: 0, fallidos: 0 });
    const [respondieron, setRespondieron] = useState(null);
    const [ultimaActividad, setUltimaActividad] = useState(null);
    const [accionLoading, setAccionLoading] = useState(false);

    const campañaId = campInicial.id;
    const pollingRef = useRef(null);

    const fetchReportes = useCallback(async () => {
        try {
            const res = await api.get(`/wapi/campanias/${campañaId}/reportes`);
            const { enviados: env, entregados, leidos, fallidos, total: tot } = res.data;
            setEnviados(env);
            setTotal(tot);
            setStats({ entregados, leidos, fallidos });
        } catch { /* silencioso */ }
    }, [campañaId]);

    const fetchRespondieron = useCallback(async () => {
        try {
            const res = await api.get(`/wapi/analitica/campania/${campañaId}`);
            setRespondieron(res.data?.engagement?.respondieron ?? 0);
        } catch { /* puede fallar si no tiene permiso */ }
    }, [campañaId]);

    // Carga inicial
    useEffect(() => {
        fetchReportes();
        fetchRespondieron();
    }, [fetchReportes, fetchRespondieron]);

    // Socket
    useEffect(() => {
        const socket = io(import.meta.env.VITE_HOST_SOCKET);
        socket.emit('join_campaña', campañaId);

        socket.on('progreso', ({ campañaId: cid, enviados: env, total: tot }) => {
            if (cid !== campañaId) return;
            setEnviados(env);
            setTotal(tot);
        });

        socket.on('campania_log', (entry) => {
            if (entry.campañaId !== campañaId) return;
            setUltimaActividad(entry);
        });

        socket.on('campania_estado', ({ campañaId: cid, estado }) => {
            if (cid !== campañaId) return;
            setCampania(prev => ({ ...prev, estado }));
            if (estado === 'finalizada') {
                fetchReportes();
                onFinished?.(campañaId);
            }
        });

        socket.on('campania_finalizada', ({ campañaId: cid }) => {
            if (cid !== campañaId) return;
            setCampania(prev => ({ ...prev, estado: 'finalizada' }));
            fetchReportes();
            onFinished?.(campañaId);
        });

        socket.on('campania_pausada', ({ campañaId: cid }) => {
            if (cid !== campañaId) return;
            setCampania(prev => ({ ...prev, estado: 'pausada' }));
        });

        return () => socket.disconnect();
    }, [campañaId, fetchReportes, onFinished]);

    // Polling reportes (20s) y respondieron (40s), solo mientras procesa
    useEffect(() => {
        if (campania.estado !== 'procesando') {
            clearInterval(pollingRef.current);
            return;
        }
        let tick = 0;
        pollingRef.current = setInterval(() => {
            tick++;
            fetchReportes();
            if (tick % 2 === 0) fetchRespondieron();
        }, 20_000);
        return () => clearInterval(pollingRef.current);
    }, [campania.estado, fetchReportes, fetchRespondieron]);

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

    const theme = useTheme();
    const estado = campania.estado;
    const esProcesando = estado === 'procesando';
    const progresoPorc = total > 0 ? Math.round((enviados / total) * 100) : 0;

    const borderColor = esProcesando
        ? 'rgba(37,211,102,0.4)'
        : estado === 'pausada'
            ? 'rgba(227,179,65,0.35)'
            : theme.palette.divider;

    const glowColor = esProcesando
        ? 'rgba(37,211,102,0.07)'
        : estado === 'pausada'
            ? 'rgba(227,179,65,0.05)'
            : 'transparent';

    return (
        <Box sx={{
            bgcolor: 'background.paper',
            border: `1px solid ${borderColor}`,
            borderRadius: 3,
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            boxShadow: `0 0 24px ${glowColor}`,
            transition: 'box-shadow 0.5s ease, border-color 0.5s ease',
            minWidth: 0,
        }}>
            {/* ── Header ── */}
            <Box display="flex" alignItems="flex-start" gap={1.5}>
                {/* Anillo */}
                <RingProgress
                    value={progresoPorc}
                    total={total}
                    enviados={enviados}
                    esProcesando={esProcesando}
                />

                {/* Info */}
                <Box flex={1} minWidth={0}>
                    <Stack direction="row" alignItems="center" spacing={0.8} flexWrap="wrap" useFlexGap mb={0.5}>
                        {esProcesando && (
                            <Box sx={{
                                width: 7, height: 7, borderRadius: '50%', bgcolor: '#25D366', flexShrink: 0,
                                animation: 'liveDot 1.4s ease-in-out infinite',
                                '@keyframes liveDot': {
                                    '0%, 100%': { opacity: 1, boxShadow: '0 0 4px #25D366' },
                                    '50%': { opacity: 0.2, boxShadow: 'none' },
                                },
                            }} />
                        )}
                        <Chip
                            size="small"
                            label={esProcesando ? 'EN VIVO' : estado === 'pausada' ? 'PAUSADA' : estado.toUpperCase()}
                            sx={{
                                height: 18,
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: 0.5,
                                bgcolor: esProcesando ? 'rgba(37,211,102,0.12)' : estado === 'pausada' ? 'rgba(227,179,65,0.12)' : 'action.hover',
                                color: esProcesando ? '#25D366' : estado === 'pausada' ? '#e3b341' : 'text.disabled',
                                border: `1px solid ${esProcesando ? 'rgba(37,211,102,0.3)' : estado === 'pausada' ? 'rgba(227,179,65,0.3)' : 'transparent'}`,
                                '& .MuiChip-label': { px: 0.8, color: 'inherit' },
                            }}
                        />
                    </Stack>

                    <Typography sx={{
                        color: 'text.primary', fontWeight: 700, fontSize: 15,
                        lineHeight: 1.3, mb: 1.5, wordBreak: 'break-word',
                    }}>
                        {campania.nombre}
                    </Typography>

                    {/* Métricas */}
                    <Box>
                        <MetricRow
                            icon={<SendIcon sx={{ fontSize: 15 }} />}
                            label="Enviados"
                            value={enviados}
                            pctVal={pct(enviados, total)}
                            color="#79c0ff"
                        />
                        <MetricRow
                            icon={<CheckCircleIcon sx={{ fontSize: 15 }} />}
                            label="Entregados"
                            value={stats.entregados}
                            pctVal={pct(stats.entregados, enviados)}
                            color="#58a6ff"
                        />
                        <MetricRow
                            icon={<DoneAllIcon sx={{ fontSize: 15 }} />}
                            label="Leídos"
                            value={stats.leidos}
                            pctVal={pct(stats.leidos, enviados)}
                            color="#3fb950"
                        />
                        <MetricRow
                            icon={<ChatBubbleIcon sx={{ fontSize: 15 }} />}
                            label="Respondieron"
                            value={respondieron !== null ? respondieron : '—'}
                            pctVal={respondieron !== null ? pct(respondieron, enviados) : null}
                            color="#bc8cff"
                        />
                        <MetricRow
                            icon={<ErrorOutlineIcon sx={{ fontSize: 15 }} />}
                            label="Fallidos"
                            value={stats.fallidos}
                            pctVal={pct(stats.fallidos, total)}
                            color={stats.fallidos > 0 ? '#f85149' : 'text.disabled'}
                        />
                    </Box>
                </Box>
            </Box>

            {/* ── Última actividad ── */}
            <Box sx={{
                bgcolor: 'action.hover',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1.5,
                px: 1.5,
                py: 0.8,
                minHeight: 32,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                overflow: 'hidden',
            }}>
                {ultimaActividad ? (
                    <>
                        <Typography component="span" sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: 11, flexShrink: 0 }}>
                            {new Date(ultimaActividad.timestamp).toLocaleTimeString()}
                        </Typography>
                        <Typography component="span" sx={{ color: NIVEL_COLOR[ultimaActividad.nivel] || 'text.secondary', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {NIVEL_ICON[ultimaActividad.nivel]} {ultimaActividad.mensaje}
                        </Typography>
                    </>
                ) : (
                    <Typography sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: 12 }}>
                        {esProcesando ? 'Esperando actividad...' : estado === 'finalizada' ? '🏁 Campaña finalizada' : '⏸️ Campaña pausada'}
                    </Typography>
                )}
            </Box>

            {/* ── Acciones ── */}
            {(esProcesando || estado === 'pausada') && (
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                    {esProcesando && (
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PauseIcon />}
                            onClick={handlePausar}
                            disabled={accionLoading}
                            sx={{
                                borderColor: 'rgba(227,179,65,0.5)', color: '#e3b341',
                                '&:hover': { borderColor: '#e3b341', bgcolor: 'rgba(227,179,65,0.08)' },
                                textTransform: 'none', fontSize: 13,
                            }}
                        >
                            Pausar
                        </Button>
                    )}
                    {estado === 'pausada' && (
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PlayArrowIcon />}
                            onClick={handleReanudar}
                            disabled={accionLoading}
                            sx={{
                                borderColor: 'rgba(37,211,102,0.5)', color: '#25D366',
                                '&:hover': { borderColor: '#25D366', bgcolor: 'rgba(37,211,102,0.08)' },
                                textTransform: 'none', fontSize: 13,
                            }}
                        >
                            Reanudar
                        </Button>
                    )}
                </Stack>
            )}
        </Box>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function WapiLiveDashboard() {
    const navigate = useNavigate();
    const theme = useTheme();
    const [campanias, setCampanias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [finalizadas, setFinalizadas] = useState(new Set());

    const cargar = useCallback(async () => {
        try {
            const res = await api.get('/wapi/campanias');
            const activas = res.data.filter(c => ['procesando', 'pausada'].includes(c.estado));
            setCampanias(activas);
        } catch { /* silencioso */ } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const handleFinished = useCallback((id) => {
        setFinalizadas(prev => new Set([...prev, id]));
    }, []);

    return (
        <Box sx={{
            minHeight: '100%',
            pt: { xs: 3, md: 4 },
            px: { xs: 2, md: 3 },
            pb: { xs: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
        }}>
            {/* ── Header ── */}
            <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
                <Tooltip title="Volver a campañas">
                    <IconButton onClick={() => navigate('/wapi/campanias')} size="small">
                        <ArrowBackIcon />
                    </IconButton>
                </Tooltip>

                <Stack direction="row" alignItems="center" spacing={1} flex={1}>
                    {/* Indicador global live */}
                    {campanias.some(c => c.estado === 'procesando') && (
                        <Box sx={{
                            width: 10, height: 10, borderRadius: '50%', bgcolor: '#25D366', flexShrink: 0,
                            animation: 'globalLive 1.4s ease-in-out infinite',
                            '@keyframes globalLive': {
                                '0%, 100%': { boxShadow: '0 0 0 0 rgba(37,211,102,0.5)' },
                                '50%': { boxShadow: '0 0 0 6px rgba(37,211,102,0)' },
                            },
                        }} />
                    )}
                    <Typography sx={{ color: 'text.primary', fontWeight: 800, fontSize: { xs: 18, md: 22 }, letterSpacing: -0.5 }}>
                        Monitor en vivo
                    </Typography>
                    <Chip
                        size="small"
                        label={`${campanias.length} campaña${campanias.length !== 1 ? 's' : ''}`}
                        sx={{ fontSize: 11, '& .MuiChip-label': { color: 'inherit' } }}
                    />
                </Stack>

                <Tooltip title="Actualizar lista">
                    <IconButton onClick={cargar} size="small">
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* ── Contenido ── */}
            {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" flex={1} minHeight={300}>
                    <CircularProgress sx={{ color: '#25D366' }} />
                </Box>
            ) : campanias.length === 0 ? (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" flex={1} minHeight={300} gap={2}>
                    <GroupIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                    <Typography sx={{ color: 'text.secondary', fontSize: 15 }}>
                        No hay campañas activas en este momento
                    </Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => navigate('/wapi/campanias')}
                        sx={{ textTransform: 'none' }}
                    >
                        Ver campañas
                    </Button>
                </Box>
            ) : (
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, 1fr)',
                        xl: 'repeat(3, 1fr)',
                    },
                    gap: 2,
                    alignItems: 'start',
                }}>
                    {campanias.map(c => (
                        <CampaignCard
                            key={c.id}
                            campania={c}
                            onFinished={handleFinished}
                        />
                    ))}
                </Box>
            )}
        </Box>
    );
}
