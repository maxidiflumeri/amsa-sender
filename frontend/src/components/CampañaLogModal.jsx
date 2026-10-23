import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, CircularProgress, IconButton, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { ArrowDown, Ban, Download, Eraser, Pause } from 'lucide-react';
import api from '../api/axios';
import { useAlReanudar, useEventoSocket, useSalaSocket } from '../context/SocketContext';
import { ConfirmDialog, ResponsiveDialog } from './ui';
import { descargarBlob } from '../utils/descargar';

const MAX_LOGS = 500; // igual al límite del historial en Redis

const NIVELES_VACIOS = { ok: 0, warn: 0, error: 0, skip: 0 };
const ETIQUETA_NIVEL = { ok: 'Enviados', warn: 'Avisos', error: 'Errores', skip: 'Omitidos' };

// El color de cada nivel sale del tema: en claro y en oscuro la consola mantiene el contraste sin pares escritos a mano.
function colorDeNivel(theme, nivel) {
    switch (nivel) {
        case 'ok': return theme.palette.success.main;
        case 'warn': return theme.palette.warning.main;
        case 'error': return theme.palette.error.main;
        case 'skip': return theme.palette.info.main;
        default: return theme.palette.text.secondary;
    }
}

/**
 * Modal de logs en tiempo real para campañas en procesamiento. Lo usan Email, WhatsApp Web y WhatsApp API.
 *
 * Props:
 *   open           - boolean
 *   onClose        - fn
 *   campañaId      - number
 *   campañaNombre  - string
 *   tipo           - 'whatsapp' | 'wapi' | 'email'
 *   estadoCampaña  - string
 *   progreso       - { enviados, total } | null   (progreso real desde el padre)
 *   onPausar       - fn | null  (WhatsApp Web y WhatsApp API; pide confirmación acá adentro)
 *   onForzarCierre - fn | null  (la confirmación la pide el padre)
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
    const theme = useTheme();
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(NIVELES_VACIOS);
    const [autoScroll, setAutoScroll] = useState(true);
    const [cargandoHistorial, setCargandoHistorial] = useState(false);
    const [confirmarPausa, setConfirmarPausa] = useState(false);
    const bottomRef = useRef(null);
    const scrollRef = useRef(null);
    // Timestamp del último log histórico, para no duplicar con lo que llega por el socket.
    const ultimoHistorialTsRef = useRef(null);
    // Mientras el historial no llegó, lo que entra por el socket espera acá.
    const listoRef = useRef(false);
    const pendientesRef = useRef([]);
    // Cada línea lleva una clave propia: con el índice como key, al recortar a 500 todas se re-renderizaban.
    const secuenciaRef = useRef(0);

    const conClave = useCallback((entry) => ({ ...entry, _k: ++secuenciaRef.current }), []);

    const contarStats = useCallback((entries) => {
        const acc = { ...NIVELES_VACIOS };
        for (const e of entries) {
            if (e.nivel in acc) acc[e.nivel]++;
        }
        return acc;
    }, []);

    const agregarLog = useCallback((entry) => {
        setLogs((prev) => {
            const next = [...prev, conClave(entry)];
            return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
        });
        setStats((prev) => ({ ...prev, [entry.nivel]: (prev[entry.nivel] ?? 0) + 1 }));
    }, [conClave]);

    // La sala se suscribe una sola vez en el socket único; acá solo se escucha el evento.
    useSalaSocket('join_campaña', open ? campañaId : null);
    useEventoSocket('campania_log', (entry) => {
        if (!open || entry.campañaId !== campañaId) return;
        if (!listoRef.current) {
            pendientesRef.current.push(entry);
            return;
        }
        // Ignorar si ya viene en el historial.
        if (ultimoHistorialTsRef.current && entry.timestamp <= ultimoHistorialTsRef.current) return;
        agregarLog(entry);
    });

    const cargarHistorial = useCallback(() => {
        if (!campañaId) return () => {};
        let cancelado = false;
        listoRef.current = false;
        pendientesRef.current = [];
        ultimoHistorialTsRef.current = null;
        setCargandoHistorial(true);
        const tipoApi = tipo === 'whatsapp' ? 'wa' : tipo === 'wapi' ? 'wapi' : 'email';
        api.get(`/campania-logs/${campañaId}?tipo=${tipoApi}`)
            .then((res) => {
                if (cancelado) return;
                const historico = res.data ?? [];
                if (historico.length > 0) ultimoHistorialTsRef.current = historico[historico.length - 1].timestamp;
                const nuevos = pendientesRef.current.filter(
                    (e) => !ultimoHistorialTsRef.current || e.timestamp > ultimoHistorialTsRef.current,
                );
                const todos = [...historico, ...nuevos].slice(-MAX_LOGS).map(conClave);
                setLogs(todos);
                setStats(contarStats(todos));
            })
            .catch(() => {
                // Si falla la carga histórica, igual mostramos lo que llegó en vivo.
                if (cancelado) return;
                const todos = pendientesRef.current.map(conClave);
                setLogs(todos);
                setStats(contarStats(todos));
            })
            .finally(() => {
                if (cancelado) return;
                listoRef.current = true;
                pendientesRef.current = [];
                setCargandoHistorial(false);
            });
        return () => { cancelado = true; };
    }, [campañaId, tipo, conClave, contarStats]);

    // Al abrir: historial desde Redis; lo que llega por el socket mientras tanto queda en espera.
    useEffect(() => {
        if (!open || !campañaId) return undefined;
        setLogs([]);
        setStats(NIVELES_VACIOS);
        setAutoScroll(true);
        return cargarHistorial();
    }, [open, campañaId, cargarHistorial]);

    // Al reconectar o volver de segundo plano se perdieron líneas: se vuelve a pedir el historial.
    useAlReanudar(() => {
        if (open && campañaId) cargarHistorial();
    });

    // Autoscroll inteligente: solo mientras el usuario está pegado al final.
    useEffect(() => {
        if (autoScroll && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
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
            .map((l) => `[${new Date(l.timestamp).toLocaleTimeString('es-AR')}] [${l.nivel.toUpperCase().padEnd(5)}] ${l.mensaje}`)
            .join('\n');
        descargarBlob(new Blob([texto], { type: 'text/plain' }), `logs-campana-${campañaId}-${Date.now()}.txt`);
    };

    // Solo limpia lo que se ve: el historial sigue en el servidor y vuelve al reabrir.
    const limpiarLogs = () => {
        setLogs([]);
        setStats(NIVELES_VACIOS);
    };

    const esProcesando = estadoCampaña === 'procesando';
    const puedePausar = (tipo === 'whatsapp' || tipo === 'wapi') && esProcesando && !!onPausar;
    const progresoPorc = progreso?.total > 0 ? Math.round((progreso.enviados / progreso.total) * 100) : null;
    const consola = theme.palette.mode === 'dark' ? theme.palette.background.default : theme.palette.action.hover;

    const chipStat = (nivel) => (
        <Chip
            key={nivel}
            size="small"
            label={`${ETIQUETA_NIVEL[nivel]} ${stats[nivel]}`}
            sx={{
                fontFamily: 'monospace',
                fontSize: 12,
                color: colorDeNivel(theme, nivel),
                bgcolor: alpha(colorDeNivel(theme, nivel), 0.12),
            }}
        />
    );

    return (
        <>
            <ResponsiveDialog
                open={open}
                onClose={onClose}
                title={campañaNombre ?? 'Log de la campaña'}
                maxWidth="md"
                cerrarConFondo
                PaperProps={{ sx: { height: { sm: '82vh' } } }}
                contentSx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                actions={(
                    <>
                        <Button
                            variant="text"
                            color="inherit"
                            startIcon={<Eraser size={18} strokeWidth={1.75} aria-hidden />}
                            onClick={limpiarLogs}
                            disabled={logs.length === 0}
                            title="Solo limpia lo que ves acá: el historial sigue guardado"
                        >
                            Limpiar vista
                        </Button>
                        <Button
                            variant="text"
                            color="inherit"
                            startIcon={<Download size={18} strokeWidth={1.75} aria-hidden />}
                            onClick={descargarLogs}
                            disabled={logs.length === 0}
                        >
                            Descargar .txt
                        </Button>
                        <Box sx={{ flex: 1 }} />
                        {puedePausar && (
                            <Button
                                variant="outlined"
                                color="warning"
                                startIcon={<Pause size={18} strokeWidth={1.75} aria-hidden />}
                                onClick={() => setConfirmarPausa(true)}
                            >
                                Pausar campaña
                            </Button>
                        )}
                        {esProcesando && onForzarCierre && (
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<Ban size={18} strokeWidth={1.75} aria-hidden />}
                                onClick={() => { onForzarCierre(); onClose(); }}
                            >
                                Forzar cierre
                            </Button>
                        )}
                        <Button onClick={onClose}>Cerrar</Button>
                    </>
                )}
            >
                {/* Estado y contadores: fijos arriba, no se van con el scroll del log */}
                <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        {esProcesando && (
                            <Box
                                aria-hidden
                                sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', flexShrink: 0 }}
                            />
                        )}
                        <Typography variant="body2" color="text.secondary">
                            {esProcesando ? 'Enviando en vivo' : 'Campaña sin envío en curso'}
                        </Typography>
                        {cargandoHistorial && <CircularProgress size={14} aria-label="Cargando historial" />}
                    </Stack>

                    {progreso?.total > 0 && (
                        <Box>
                            <Stack direction="row" justifyContent="space-between" mb={0.5}>
                                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Avance</Typography>
                                <Typography sx={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                    {progreso.enviados} / {progreso.total}
                                    {progresoPorc !== null && ` (${progresoPorc}%)`}
                                </Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={progresoPorc ?? 0} sx={{ height: 6, borderRadius: 3 }} />
                        </Box>
                    )}

                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {chipStat('ok')}
                        {chipStat('warn')}
                        {tipo === 'email' && chipStat('skip')}
                        {stats.error > 0 && chipStat('error')}
                        <Chip size="small" label={`${logs.length} líneas`} sx={{ fontFamily: 'monospace', fontSize: 12 }} />
                    </Stack>
                </Box>

                {/* Consola */}
                <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
                    <Box
                        ref={scrollRef}
                        onScroll={handleScroll}
                        role="log"
                        aria-live="off"
                        aria-label="Log de la campaña"
                        sx={{ flex: 1, overflowY: 'auto', bgcolor: consola, p: '10px 14px', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7 }}
                    >
                        {cargandoHistorial && logs.length === 0 ? (
                            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }} spacing={1}>
                                <CircularProgress size={24} />
                                <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Cargando historial…</Typography>
                            </Stack>
                        ) : logs.length === 0 ? (
                            <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 3, textAlign: 'center' }}>
                                {esProcesando
                                    ? 'Esperando logs… los mensajes aparecen acá en tiempo real.'
                                    : 'No hay logs para mostrar.'}
                            </Typography>
                        ) : (
                            logs.map((log) => (
                                <Box
                                    key={log._k}
                                    sx={{
                                        display: 'flex',
                                        gap: 1.5,
                                        px: 0.5,
                                        py: '1px',
                                        borderRadius: '3px',
                                        bgcolor: log.nivel === 'info' || !log.nivel ? 'transparent' : alpha(colorDeNivel(theme, log.nivel), 0.08),
                                    }}
                                >
                                    <Typography component="span" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 12, flexShrink: 0, userSelect: 'none', pt: '1px' }}>
                                        {new Date(log.timestamp).toLocaleTimeString('es-AR')}
                                    </Typography>
                                    <Typography component="span" sx={{ color: log.nivel && log.nivel !== 'info' ? colorDeNivel(theme, log.nivel) : 'text.primary', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-word' }}>
                                        {log.mensaje}
                                    </Typography>
                                </Box>
                            ))
                        )}
                        <div ref={bottomRef} />
                    </Box>

                    {!autoScroll && logs.length > 0 && (
                        <IconButton
                            onClick={scrollToBottom}
                            aria-label="Ir al último log"
                            sx={{
                                position: 'absolute',
                                bottom: 12,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 44,
                                height: 44,
                                bgcolor: 'background.paper',
                                border: 1,
                                borderColor: 'divider',
                                '&:hover': { bgcolor: 'action.hover' },
                            }}
                        >
                            <ArrowDown size={20} strokeWidth={1.75} aria-hidden />
                        </IconButton>
                    )}
                </Box>
            </ResponsiveDialog>

            <ConfirmDialog
                open={confirmarPausa}
                titulo="Pausar la campaña"
                mensaje={`Se deja de enviar «${campañaNombre ?? ''}» hasta que la reanudes${progreso?.total > 0 ? `. Faltan ${Math.max(progreso.total - progreso.enviados, 0)} de ${progreso.total} mensajes` : ''}.`}
                confirmarTexto="Pausar"
                onCancelar={() => setConfirmarPausa(false)}
                onConfirmar={() => {
                    setConfirmarPausa(false);
                    onPausar?.();
                    onClose();
                }}
            />
        </>
    );
}
