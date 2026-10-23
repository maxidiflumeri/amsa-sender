import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, ToggleButton, ToggleButtonGroup, Tooltip, TextField, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { ArrowLeft } from 'lucide-react';
import {
    Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import api from '../../../api/axios';
import { BloqueEstado, DataTableResponsive, EmptyState, SectionCard, StatusChip } from '../../ui';
import { estadoConversacion } from '../../analitica/estados';
import { aDiaLocal, diaLocalHaceDias, fmtDiaCorto, fmtDuracion, fmtFecha, fmtNumero } from '../../analitica/formato';
import { useGraficos } from '../../analitica/graficos';
import GrillaKpi from '../../analitica/GrillaKpi';
import PanelAnalisisIA from './PanelAnalisisIA';

const PRESETS = [
    { k: '1d', l: 'Hoy', dias: 0 },
    { k: '7d', l: '7 días', dias: 7 },
    { k: '30d', l: '30 días', dias: 30 },
];
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const rangoDe = (k) => {
    const p = PRESETS.find((x) => x.k === k) ?? PRESETS[2];
    return { desde: diaLocalHaceDias(p.dias), hasta: aDiaLocal() };
};

const cortar = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

/** Actividad de mensajes por hora y por agente. Las celdas se reparten el ancho: en el celular no hace falta scroll. */
function MapaActividad({ agentes }) {
    const theme = useTheme();
    const max = Math.max(1, ...agentes.flatMap((a) => (a.actividadPorHora || []).map((h) => h.count)));
    const horas = Array.from({ length: 24 }, (_, h) => h);
    const columnas = { xs: 'minmax(0, 1fr)', md: '120px minmax(0, 1fr)' };
    const fila24 = { display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))', gap: '2px' };

    return (
        <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: columnas, mb: 0.5 }}>
                <Box sx={{ display: { xs: 'none', md: 'block' } }} />
                <Box sx={fila24} aria-hidden>
                    {horas.map((h) => (
                        <Typography
                            key={h}
                            variant="caption"
                            sx={{ textAlign: 'center', fontSize: 11, color: 'text.secondary', visibility: { xs: h % 3 === 0 ? 'visible' : 'hidden', md: 'visible' } }}
                        >
                            {h}
                        </Typography>
                    ))}
                </Box>
            </Box>
            {agentes.map((a) => {
                const porHora = a.actividadPorHora || horas.map((hora) => ({ hora, count: 0 }));
                return (
                    <Box key={a.id} sx={{ display: 'grid', gridTemplateColumns: columnas, alignItems: 'center', mb: { xs: 1, md: 0.5 }, columnGap: 1 }}>
                        <Typography variant="caption" noWrap sx={{ fontSize: 12 }}>{a.nombre}</Typography>
                        <Box sx={fila24}>
                            {porHora.map((h) => (
                                <Tooltip key={h.hora} title={`${a.nombre}: ${h.count} mensajes a las ${h.hora}:00`} enterTouchDelay={0} arrow>
                                    <Box
                                        sx={{
                                            height: { xs: 22, md: 18 },
                                            borderRadius: '3px',
                                            bgcolor: h.count > 0 ? alpha(theme.palette.primary.main, 0.12 + 0.88 * (h.count / max)) : 'action.hover',
                                        }}
                                    />
                                </Tooltip>
                            ))}
                        </Box>
                    </Box>
                );
            })}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }} aria-hidden>
                <Typography variant="caption" color="text.secondary">Menos</Typography>
                {[0.12, 0.35, 0.55, 0.78, 1].map((o) => (
                    <Box key={o} sx={{ width: 16, height: 16, borderRadius: '3px', bgcolor: alpha(theme.palette.primary.main, o) }} />
                ))}
                <Typography variant="caption" color="text.secondary">Más</Typography>
            </Box>
        </Box>
    );
}

function DetalleAgente({ agente, rango, onVolver }) {
    const g = useGraficos();
    const celular = useMediaQuery((t) => t.breakpoints.down('sm'));
    const [detalle, setDetalle] = useState(null);
    const [estado, setEstado] = useState('cargando');

    const cargar = useCallback(() => {
        setEstado('cargando');
        api.get(`/wapi/analitica/agentes/${agente.id}`, { params: rango })
            .then((r) => {
                setDetalle(r.data);
                setEstado('ok');
            })
            .catch(() => setEstado('error'));
    }, [agente.id, rango]);

    useEffect(() => {
        setDetalle(null);
        cargar();
    }, [cargar]);

    const volver = (
        <Button startIcon={<ArrowLeft size={18} strokeWidth={1.75} aria-hidden />} onClick={onVolver} sx={{ mb: 2, minHeight: { xs: 44, sm: 36 } }}>
            Volver al equipo
        </Button>
    );

    if (estado === 'cargando') return <Box>{volver}<BloqueEstado estado="cargando" mensaje="Cargando el detalle…" /></Box>;
    if (estado === 'error' || !detalle) {
        return <Box>{volver}<BloqueEstado estado="error" mensaje="No se pudo cargar el detalle del agente." onReintentar={cargar} /></Box>;
    }

    const m = detalle.metricas;
    const porDia = detalle.actividadPorDia.map((d) => ({ dia: DIAS_SEMANA[d.dia], count: d.count }));

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>{volver}</Box>
            <SectionCard title={agente.nombre} subtitle={`Del ${rango.desde.split('-').reverse().join('/')} al ${rango.hasta.split('-').reverse().join('/')}`}>
                <GrillaKpi
                    max={6}
                    items={[
                        { titulo: 'Asignadas', valor: fmtNumero(m.asignadas) },
                        { titulo: 'Cerradas', valor: fmtNumero(m.resueltas), leyenda: m.conversacionesCerradas != null ? `en ${fmtNumero(m.conversacionesCerradas)} conversaciones` : undefined },
                        { titulo: 'Activas', valor: fmtNumero(m.activas) },
                        { titulo: 'Mensajes enviados', valor: fmtNumero(m.mensajesEnviados) },
                        { titulo: '1ª respuesta', valor: fmtDuracion(m.avgPrimeraRespuestaMs), leyenda: 'promedio' },
                        { titulo: 'Resolución', valor: fmtDuracion(m.avgResolucionMs), leyenda: 'promedio' },
                    ]}
                />
            </SectionCard>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' } }}>
                <SectionCard title="Actividad por hora">
                    <Box sx={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={detalle.actividadPorHora} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={g.grilla} vertical={false} />
                                <XAxis dataKey="hora" tickFormatter={(h) => `${h}h`} interval={celular ? 2 : 1} {...g.eje} />
                                <YAxis width={celular ? 32 : 40} allowDecimals={false} {...g.eje} axisLine={false} />
                                <RTooltip {...g.tooltip} formatter={(v) => [fmtNumero(v), 'Mensajes']} labelFormatter={(h) => `${h}:00 hs`} />
                                <Bar dataKey="count" fill={g.primary} radius={[4, 4, 0, 0]} name="Mensajes" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                </SectionCard>
                <SectionCard title="Actividad por día de la semana">
                    <Box sx={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={porDia} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={g.grilla} vertical={false} />
                                <XAxis dataKey="dia" {...g.eje} />
                                <YAxis width={celular ? 32 : 40} allowDecimals={false} {...g.eje} axisLine={false} />
                                <RTooltip {...g.tooltip} formatter={(v) => [fmtNumero(v), 'Mensajes']} />
                                <Bar dataKey="count" fill={g.info} radius={[4, 4, 0, 0]} name="Mensajes" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                </SectionCard>
            </Box>

            <SectionCard title="Conversaciones en el período" noPadding>
                <DataTableResponsive
                    ariaLabel="Conversaciones del agente"
                    columns={[
                        { key: 'numero', label: 'Número', primary: true },
                        { key: 'nombre', label: 'Nombre', secondary: true, render: (c) => c.nombre ?? '—' },
                        { key: 'estado', label: 'Estado', render: (c) => { const e = estadoConversacion(c.estado); return <StatusChip label={e.label} tono={e.tono} />; } },
                        { key: 'creadoAt', label: 'Creada', render: (c) => fmtFecha(c.creadoAt) },
                        { key: 'primeraRespuestaAt', label: '1ª respuesta', render: (c) => fmtFecha(c.primeraRespuestaAt), hideBelow: 'lg' },
                        { key: 'resolvedAt', label: 'Resuelta', render: (c) => fmtFecha(c.resolvedAt), hideBelow: 'lg' },
                    ]}
                    rows={detalle.conversaciones}
                    empty={<EmptyState compact title="Sin conversaciones" description="No atendió conversaciones en este período." />}
                />
            </SectionCard>
        </Box>
    );
}

export default function MetricasAgentes() {
    const g = useGraficos();
    const celular = useMediaQuery((t) => t.breakpoints.down('sm'));
    const [params, setParams] = useSearchParams();
    const agenteId = params.get('a');

    // `preset` es el botón marcado (null con un rango propio); `aplicado` es lo que realmente se consultó;
    // `desde`/`hasta` son lo tipeado, que no cuenta hasta tocar "Aplicar".
    const [preset, setPreset] = useState('30d');
    const [aplicado, setAplicado] = useState(() => rangoDe('30d'));
    const [desde, setDesde] = useState(aplicado.desde);
    const [hasta, setHasta] = useState(aplicado.hasta);

    const [datos, setDatos] = useState(null);
    const [estado, setEstado] = useState('cargando');

    const cargar = useCallback(() => {
        setEstado('cargando');
        api.get('/wapi/analitica/agentes', { params: aplicado })
            .then((r) => {
                setDatos(r.data);
                setEstado('ok');
            })
            .catch(() => setEstado('error'));
    }, [aplicado]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const elegirPreset = (_, k) => {
        if (!k) return;
        const r = rangoDe(k);
        setPreset(k);
        setAplicado(r);
        setDesde(r.desde);
        setHasta(r.hasta);
    };

    const rangoValido = !!desde && !!hasta && desde <= hasta;
    const cambioRango = desde !== aplicado.desde || hasta !== aplicado.hasta;
    const aplicarRango = () => {
        if (!rangoValido) return;
        setPreset(null);
        setAplicado({ desde, hasta });
    };

    const abrirAgente = (a) => setParams((p) => { const s = new URLSearchParams(p); s.set('a', String(a.id)); return s; });
    const cerrarAgente = () => setParams((p) => { const s = new URLSearchParams(p); s.delete('a'); return s; });

    // La productividad es lo que cada uno cerró: el ranking va por cierres.
    const ranking = useMemo(() => (datos ? [...datos.agentes].sort((a, b) => b.resueltas - a.resueltas || b.asignadas - a.asignadas) : []), [datos]);

    const agenteAbierto = agenteId && datos ? datos.agentes.find((a) => String(a.id) === agenteId) : null;
    if (agenteAbierto) return <DetalleAgente agente={agenteAbierto} rango={aplicado} onVolver={cerrarAgente} />;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { md: 'center' }, flexWrap: 'wrap' }}>
                <ToggleButtonGroup
                    exclusive
                    size="small"
                    color="primary"
                    value={preset}
                    onChange={elegirPreset}
                    aria-label="Período"
                    sx={{ '& .MuiToggleButton-root': { minHeight: { xs: 44, sm: 36 }, flex: { xs: 1, md: 'none' }, px: 2 } }}
                >
                    {PRESETS.map((p) => <ToggleButton key={p.k} value={p.k}>{p.l}</ToggleButton>)}
                </ToggleButtonGroup>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField type="date" size="small" label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: { xs: 1, md: 'none' }, minWidth: 140 }} />
                    <TextField type="date" size="small" label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: { xs: 1, md: 'none' }, minWidth: 140 }} />
                    <Button variant="outlined" onClick={aplicarRango} disabled={!rangoValido || !cambioRango} sx={{ minHeight: { xs: 44, sm: 36 }, width: { xs: '100%', sm: 'auto' } }}>
                        Aplicar
                    </Button>
                </Box>
            </Box>

            {estado === 'cargando' && <BloqueEstado estado="cargando" mensaje="Cargando métricas del equipo…" />}
            {estado === 'error' && <BloqueEstado estado="error" mensaje="No se pudieron cargar las métricas de los agentes." onReintentar={cargar} />}

            {estado === 'ok' && datos && (
                <>
                    <Box>
                        <PanelAnalisisIA
                            endpoint={`/wapi/analitica/agentes/ai?desde=${aplicado.desde}&hasta=${aplicado.hasta}`}
                            label="Analizar equipo con IA"
                        />
                        <GrillaKpi
                            items={[
                                { titulo: 'Conversaciones', valor: fmtNumero(datos.global.totalConvs) },
                                {
                                    // Cada cierre cuenta, en el día en que se hizo: no cambia si después la conversación se reabre.
                                    titulo: 'Cerradas',
                                    valor: fmtNumero(datos.global.resueltas),
                                    leyenda: datos.global.conversacionesCerradas != null ? `en ${fmtNumero(datos.global.conversacionesCerradas)} conversaciones` : undefined,
                                },
                                { titulo: '1ª respuesta', valor: fmtDuracion(datos.global.avgPrimeraRespuestaMs), leyenda: 'promedio' },
                                { titulo: 'Resolución', valor: fmtDuracion(datos.global.avgResolucionMs), leyenda: 'promedio' },
                            ]}
                        />
                    </Box>

                    {datos.agentes.length > 0 && (
                        <SectionCard title="Comparativa por agente" subtitle="Conversaciones asignadas y cierres de cada agente.">
                            <Box sx={{ height: 260 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={datos.agentes} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={g.grilla} vertical={false} />
                                        <XAxis dataKey="nombre" tickFormatter={(n) => cortar(n, celular ? 7 : 14)} interval={0} {...g.eje} />
                                        <YAxis width={celular ? 32 : 40} allowDecimals={false} {...g.eje} axisLine={false} />
                                        <RTooltip {...g.tooltip} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Bar dataKey="asignadas" name="Asignadas" fill={g.info} radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="resueltas" name="Cerradas" fill={g.success} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </SectionCard>
                    )}

                    {datos.evolucionDiaria.length > 0 && (
                        <SectionCard title="Evolución diaria">
                            <Box sx={{ height: 240 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={datos.evolucionDiaria} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={g.grilla} vertical={false} />
                                        <XAxis dataKey="fecha" tickFormatter={fmtDiaCorto} minTickGap={celular ? 32 : 16} {...g.eje} />
                                        <YAxis width={celular ? 32 : 40} allowDecimals={false} {...g.eje} axisLine={false} />
                                        <RTooltip {...g.tooltip} labelFormatter={fmtDiaCorto} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Line type="monotone" dataKey="convs" name="Conversaciones" stroke={g.info} strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="resueltas" name="Cerradas" stroke={g.success} strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Box>
                        </SectionCard>
                    )}

                    {datos.agentes.length > 0 && (
                        <SectionCard title="Actividad por hora" subtitle="Mensajes enviados por cada agente, hora por hora.">
                            <MapaActividad agentes={datos.agentes} />
                        </SectionCard>
                    )}

                    <SectionCard title="Ranking de agentes" subtitle="Cerradas: cada cierre cuenta, en el día en que se hizo, como en S1. Si una conversación se reabre y se vuelve a cerrar, suma dos; Conversaciones dice cuántas distintas fueron." noPadding>
                        <DataTableResponsive
                            ariaLabel="Ranking de agentes"
                            columns={[
                                { key: 'nombre', label: 'Agente', primary: true },
                                { key: 'asignadas', label: 'Asignadas', align: 'right', render: (a) => fmtNumero(a.asignadas) },
                                { key: 'resueltas', label: 'Cerradas', align: 'right', render: (a) => fmtNumero(a.resueltas) },
                                { key: 'conversacionesCerradas', label: 'Conversaciones', align: 'right', render: (a) => fmtNumero(a.conversacionesCerradas ?? 0), hideBelow: 'lg' },
                                { key: 'activas', label: 'Activas', align: 'right', render: (a) => fmtNumero(a.activas) },
                                { key: 'avgPrimeraRespuestaMs', label: '1ª respuesta', align: 'right', render: (a) => fmtDuracion(a.avgPrimeraRespuestaMs), hideBelow: 'lg' },
                                { key: 'avgResolucionMs', label: 'Resolución', align: 'right', render: (a) => fmtDuracion(a.avgResolucionMs), hideBelow: 'lg' },
                                { key: 'mensajesEnviados', label: 'Mensajes', align: 'right', render: (a) => fmtNumero(a.mensajesEnviados) },
                            ]}
                            rows={ranking}
                            onRowClick={abrirAgente}
                            acciones={(a) => <Button size="small" variant="outlined" onClick={() => abrirAgente(a)}>Ver detalle</Button>}
                            empty={<EmptyState compact title="Sin agentes" description="No hay actividad de agentes en este período." />}
                        />
                    </SectionCard>
                </>
            )}
        </Box>
    );
}
