import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { CheckCheck, CircleAlert, CircleCheck, Megaphone, MessageCircle, Pause, Play, RefreshCw, Send } from 'lucide-react';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { useAlReanudar, useEventoSocket, useSalaSocket } from '../../context/SocketContext';
import { migasDe } from '../layout/navConfig';
import { BloqueEstado, ConfirmDialog, EmptyState, PageHeader, StatusChip } from '../ui';
import { estadoCampania } from '../campanias/estados';
import { pedirAvance, porcentaje } from '../campanias/wapi/datos';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EN_CURSO = ['procesando', 'pausada'];
const RECARGA_LISTA_MS = 60_000;

const pct = (num, den) => (den > 0 ? `${Math.round((num / den) * 1000) / 10}%` : '—');
const numero = (n) => (n ?? 0).toLocaleString('es-AR');

// ─── Anillo de progreso ────────────────────────────────────────────────────────

// `procesados` null significa "no se sabe todavía": se muestra "—" y no 0 %.
function RingProgress({ procesados, total, estado }) {
    const theme = useTheme();
    const color = estado === 'procesando' ? theme.palette.success.main : estado === 'pausada' ? theme.palette.warning.main : theme.palette.primary.main;
    const valor = porcentaje(procesados, total);
    return (
        <Box sx={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
            <CircularProgress variant="determinate" value={100} size={130} thickness={4} sx={{ color: theme.palette.divider, position: 'absolute', top: 0, left: 0 }} />
            <CircularProgress
                variant="determinate"
                value={valor ?? 0}
                size={130}
                thickness={4}
                sx={{ color, position: 'absolute', top: 0, left: 0 }}
                aria-label="Avance de la campaña"
            />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: 'text.primary', fontWeight: 800, fontSize: 26, lineHeight: 1.1 }}>
                    {valor === null ? '—' : `${valor}%`}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {procesados === null ? '—' : numero(procesados)}/{numero(total)}
                </Typography>
            </Box>
        </Box>
    );
}

// ─── Fila de métrica ──────────────────────────────────────────────────────────

function MetricRow({ icon, label, value, pctVal, color }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, py: '3px' }}>
            <Box sx={{ color, display: 'flex', flexShrink: 0 }} aria-hidden>{icon}</Box>
            <Typography sx={{ color: 'text.secondary', fontSize: 13, flex: 1 }}>{label}</Typography>
            <Typography sx={{ color: 'text.primary', fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
            {pctVal && (
                <Typography sx={{ color: 'text.secondary', fontSize: 12, minWidth: 48, textAlign: 'right' }}>{pctVal}</Typography>
            )}
        </Box>
    );
}

// ─── Tarjeta de campaña ───────────────────────────────────────────────────────

function CampaignCard({ campania, resaltada, onFinished }) {
    const theme = useTheme();
    const feedback = useFeedback();
    const campañaId = campania.id;
    const [estado, setEstado] = useState(campania.estado);
    // Los procesados arrancan desconocidos (null) y se completan con lo que dice la base; después manda el socket.
    const [procesados, setProcesados] = useState(null);
    const [totalContactos, setTotalContactos] = useState(campania._count?.contactos ?? 0);
    const [stats, setStats] = useState({ enviados: 0, entregados: 0, leidos: 0, fallidos: 0 });
    const [respondieron, setRespondieron] = useState(null);
    const [ultimaActividad, setUltimaActividad] = useState(null);
    const [accionLoading, setAccionLoading] = useState(false);
    const [confirmarPausa, setConfirmarPausa] = useState(false);
    const ref = useRef(null);

    useSalaSocket('join_campaña', campañaId);

    // El estado que decide la lista (recarga, otra pestaña) tiene que verse también acá.
    useEffect(() => { setEstado(campania.estado); }, [campania.estado]);

    // El avance de la base: sirve para campañas pausadas o recién abiertas, que no emiten progreso.
    const fetchAvance = useCallback(async () => {
        try {
            const a = await pedirAvance(campañaId);
            setStats({ enviados: a.enviados, entregados: a.entregados, leidos: a.leidos, fallidos: a.fallidos });
            // El socket puede ir más adelantado que la base: nunca se retrocede.
            setProcesados((prev) => Math.max(prev ?? 0, a.procesados));
        } catch { /* el anillo queda en "—" y las métricas en lo último que se supo */ }
    }, [campañaId]);

    const fetchRespondieron = useCallback(async () => {
        try {
            const res = await api.get(`/wapi/analitica/campania/${campañaId}`);
            setRespondieron(res.data?.engagement?.respondieron ?? 0);
        } catch { /* puede fallar si no tiene permiso de analítica */ }
    }, [campañaId]);

    useEffect(() => {
        fetchAvance();
        fetchRespondieron();
    }, [fetchAvance, fetchRespondieron]);

    // Si viene resaltada desde "Ver en vivo", se trae a la vista.
    useEffect(() => {
        if (resaltada) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, [resaltada]);

    useEventoSocket('progreso', ({ campañaId: cid, enviados: env, total: tot }) => {
        if (cid !== campañaId) return;
        setProcesados(env);
        setTotalContactos(tot); // tot = contactos.length, siempre estable
    });
    useEventoSocket('campania_log', (entry) => {
        if (entry.campañaId === campañaId) setUltimaActividad(entry);
    });
    useEventoSocket('campania_estado', ({ campañaId: cid, estado: nuevo }) => {
        if (cid !== campañaId) return;
        setEstado(nuevo);
        if (nuevo === 'finalizada') {
            fetchAvance();
            onFinished?.(campañaId);
        }
    });
    useEventoSocket('campania_finalizada', ({ campañaId: cid }) => {
        if (cid !== campañaId) return;
        setEstado('finalizada');
        fetchAvance();
        onFinished?.(campañaId);
    });
    useEventoSocket('campania_pausada', ({ campañaId: cid }) => {
        if (cid === campañaId) setEstado('pausada');
    });
    useAlReanudar(fetchAvance);

    // Entregados y leídos los confirma Meta de forma asíncrona: mientras se envía, se consulta cada 20 s.
    useEffect(() => {
        if (estado !== 'procesando') return undefined;
        let tick = 0;
        const t = setInterval(() => {
            tick++;
            fetchAvance();
            if (tick % 2 === 0) fetchRespondieron();
        }, 20_000);
        return () => clearInterval(t);
    }, [estado, fetchAvance, fetchRespondieron]);

    const accion = async (ruta, exito, error) => {
        if (accionLoading) return;
        setAccionLoading(true);
        try {
            await api.post(`/wapi/campanias/${campañaId}/${ruta}`);
            feedback.exito(exito);
        } catch (err) {
            feedback.error(mensajeDeError(err, error));
        } finally {
            setAccionLoading(false);
        }
    };

    const esProcesando = estado === 'procesando';
    const e = estadoCampania(estado);
    const colorBorde = resaltada
        ? theme.palette.primary.main
        : esProcesando ? alpha(theme.palette.success.main, 0.5)
            : estado === 'pausada' ? alpha(theme.palette.warning.main, 0.5)
                : theme.palette.divider;
    const colorNivel = {
        ok: theme.palette.success.main, warn: theme.palette.warning.main, error: theme.palette.error.main,
        skip: theme.palette.info.main, info: theme.palette.text.secondary,
    };

    return (
        <Box
            ref={ref}
            sx={{
                bgcolor: 'background.paper',
                border: `${resaltada ? 2 : 1}px solid ${colorBorde}`,
                borderRadius: '14px',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 0,
            }}
        >
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                <StatusChip label={esProcesando ? 'En vivo' : e.label} tono={e.tono} vivo={esProcesando} />
                <Typography sx={{ color: 'text.primary', fontWeight: 700, fontSize: 15, lineHeight: 1.3, overflowWrap: 'anywhere', flex: 1, minWidth: 0 }}>
                    {campania.nombre}
                </Typography>
            </Stack>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'center', sm: 'flex-start' }, gap: 2 }}>
                <RingProgress procesados={procesados} total={totalContactos} estado={estado} />

                <Box flex={1} width="100%">
                    <MetricRow icon={<Send size={16} strokeWidth={1.75} />} label="Enviados" value={numero(stats.enviados)} pctVal={pct(stats.enviados, totalContactos)} color="primary.main" />
                    <MetricRow icon={<CircleCheck size={16} strokeWidth={1.75} />} label="Entregados" value={numero(stats.entregados)} pctVal={pct(stats.entregados, stats.enviados)} color="info.main" />
                    <MetricRow icon={<CheckCheck size={16} strokeWidth={1.75} />} label="Leídos" value={numero(stats.leidos)} pctVal={pct(stats.leidos, stats.enviados)} color="success.main" />
                    <MetricRow
                        icon={<MessageCircle size={16} strokeWidth={1.75} />}
                        label="Respondieron"
                        value={respondieron !== null ? numero(respondieron) : '—'}
                        pctVal={respondieron !== null ? pct(respondieron, stats.enviados) : null}
                        color="ia.main"
                    />
                    <MetricRow
                        icon={<CircleAlert size={16} strokeWidth={1.75} />}
                        label="Fallidos"
                        value={numero(stats.fallidos)}
                        pctVal={pct(stats.fallidos, totalContactos)}
                        color={stats.fallidos > 0 ? 'error.main' : 'text.disabled'}
                    />
                </Box>
            </Box>

            {/* Última línea del log */}
            <Box sx={{ bgcolor: 'action.hover', border: 1, borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 0.8, minHeight: 36, display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                {ultimaActividad ? (
                    <>
                        <Typography component="span" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 12, flexShrink: 0 }}>
                            {new Date(ultimaActividad.timestamp).toLocaleTimeString('es-AR')}
                        </Typography>
                        <Typography component="span" sx={{ color: colorNivel[ultimaActividad.nivel] || 'text.secondary', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ultimaActividad.mensaje}
                        </Typography>
                    </>
                ) : (
                    <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
                        {esProcesando ? 'Esperando actividad…' : estado === 'finalizada' ? 'Campaña terminada' : 'Campaña en pausa'}
                    </Typography>
                )}
            </Box>

            {(esProcesando || estado === 'pausada') && (
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                    {esProcesando && (
                        <Button
                            variant="outlined"
                            color="warning"
                            startIcon={<Pause size={18} strokeWidth={1.75} aria-hidden />}
                            onClick={() => setConfirmarPausa(true)}
                            disabled={accionLoading}
                            sx={{ minHeight: { xs: 44, md: 36 } }}
                        >
                            Pausar
                        </Button>
                    )}
                    {estado === 'pausada' && (
                        <Button
                            variant="outlined"
                            color="success"
                            startIcon={accionLoading ? <CircularProgress size={16} color="inherit" /> : <Play size={18} strokeWidth={1.75} aria-hidden />}
                            onClick={() => accion('reanudar', 'Envío reanudado.', 'No se pudo reanudar la campaña.')}
                            disabled={accionLoading}
                            sx={{ minHeight: { xs: 44, md: 36 } }}
                        >
                            Reanudar
                        </Button>
                    )}
                </Stack>
            )}

            <ConfirmDialog
                open={confirmarPausa}
                titulo="Pausar la campaña"
                mensaje={`Se deja de enviar «${campania.nombre}»${procesados !== null ? `: quedan ${numero(Math.max(totalContactos - procesados, 0))} mensajes sin enviar` : ''}. Podés reanudarla cuando quieras.`}
                confirmarTexto="Pausar"
                cargando={accionLoading}
                onCancelar={() => setConfirmarPausa(false)}
                onConfirmar={async () => {
                    await accion('pausar', 'Campaña en pausa.', 'No se pudo pausar la campaña.');
                    setConfirmarPausa(false);
                }}
            />
        </Box>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function WapiLiveDashboard() {
    const navigate = useNavigate();
    const feedback = useFeedback();
    const [params] = useSearchParams();
    const campaniaResaltada = Number(params.get('campania')) || null;
    const [campanias, setCampanias] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(false);
    const [terminoDeVerse, setTerminoDeVerse] = useState(false);

    // `conservar`: las campañas que ya estaban en pantalla y terminaron se quedan hasta que se actualice a mano, para
    // no perder los números finales de golpe. La recarga automática conserva; el botón "Actualizar" las saca.
    const cargar = useCallback(async ({ conservar = false, silencioso = false } = {}) => {
        try {
            const res = await api.get('/wapi/campanias');
            const todas = res.data;
            const activas = todas.filter((c) => EN_CURSO.includes(c.estado));
            setCampanias((prev) => {
                if (!conservar) return activas;
                const idsActivas = new Set(activas.map((c) => c.id));
                const quedan = prev
                    .filter((c) => !idsActivas.has(c.id))
                    .map((c) => todas.find((t) => t.id === c.id))
                    .filter(Boolean);
                return [...activas, ...quedan];
            });
            setTerminoDeVerse(!!campaniaResaltada && !todas.some((c) => c.id === campaniaResaltada && EN_CURSO.includes(c.estado)));
            setError(false);
        } catch (err) {
            if (silencioso) feedback.error(mensajeDeError(err, 'No se pudo actualizar el monitor.'));
            else setError(true);
        } finally {
            setCargando(false);
        }
    }, [campaniaResaltada, feedback]);

    useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Arrancó (o terminó) una campaña: la lista se actualiza sola.
    useEventoSocket('campania_estado', () => cargar({ conservar: true, silencioso: true }));
    useAlReanudar(() => cargar({ conservar: true, silencioso: true }));

    // Y cada 60 s mientras la pestaña esté a la vista, por si algún evento no llegó.
    useEffect(() => {
        const t = setInterval(() => {
            if (document.visibilityState === 'visible') cargar({ conservar: true, silencioso: true });
        }, RECARGA_LISTA_MS);
        return () => clearInterval(t);
    }, [cargar]);

    const hayEnVivo = campanias.some((c) => c.estado === 'procesando');

    return (
        <>
            <PageHeader
                title="Monitor en vivo"
                subtitle={hayEnVivo ? 'Campañas de WhatsApp API enviando ahora, con su avance en tiempo real.' : 'Las campañas de WhatsApp API que están enviando o en pausa.'}
                breadcrumbs={migasDe('/wapi/live')}
                back="/wapi/campanias"
                backLabel="Volver a campañas"
                actions={(
                    <Button
                        variant="outlined"
                        startIcon={<RefreshCw size={18} strokeWidth={1.75} aria-hidden />}
                        onClick={() => { setCargando(true); cargar(); }}
                    >
                        Actualizar
                    </Button>
                )}
            />

            {terminoDeVerse && (
                <Box sx={{ mb: 2, p: 1.5, border: 1, borderColor: 'divider', borderRadius: '14px', bgcolor: 'action.hover' }}>
                    <Typography variant="body2">La campaña que buscabas ya no está en curso.</Typography>
                </Box>
            )}

            {cargando ? (
                <BloqueEstado estado="cargando" mensaje="Cargando campañas en curso…" />
            ) : error ? (
                <BloqueEstado estado="error" mensaje="No se pudieron cargar las campañas en curso." onReintentar={() => { setCargando(true); cargar(); }} />
            ) : campanias.length === 0 ? (
                <EmptyState
                    icon={Megaphone}
                    title="No hay campañas en curso"
                    description="Cuando una campaña esté enviando o en pausa, la vas a ver acá."
                    action={{ label: 'Ver campañas', onClick: () => navigate('/wapi/campanias') }}
                />
            ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 2, alignItems: 'start' }}>
                    {campanias.map((c) => (
                        <CampaignCard key={c.id} campania={c} resaltada={c.id === campaniaResaltada} />
                    ))}
                </Box>
            )}
        </>
    );
}
