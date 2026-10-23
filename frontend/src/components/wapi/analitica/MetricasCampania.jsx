import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Chip, MenuItem, Stack, TablePagination, TextField, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowLeft, MessageSquareText } from 'lucide-react';
import {
    Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import api from '../../../api/axios';
import { BloqueEstado, DataTableResponsive, EmptyState, SectionCard, StatusChip } from '../../ui';
import { estadoCampania } from '../../campanias/estados';
import { estadoConversacion, estadoMensaje } from '../../analitica/estados';
import { fmtDuracion, fmtFecha, fmtNumero, porcentaje } from '../../analitica/formato';
import { useGraficos } from '../../analitica/graficos';
import GrillaKpi from '../../analitica/GrillaKpi';
import PanelAnalisisIA from './PanelAnalisisIA';

const FILTROS = [
    { value: 'todos', label: 'Todos' },
    { value: 'enviados', label: 'Enviados' },
    { value: 'entregados', label: 'Entregados' },
    { value: 'leidos', label: 'Leídos' },
    { value: 'fallidos', label: 'Fallidos' },
    { value: 'respondieron', label: 'Respondieron' },
    { value: 'bajas', label: 'Bajas' },
];

const POR_PAGINA = 20;

const cortar = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

export default function MetricasCampania() {
    const theme = useTheme();
    const g = useGraficos();
    const navigate = useNavigate();
    const celular = useMediaQuery(theme.breakpoints.down('sm'));
    // La campaña abierta vive en la URL (`?c=`): el atrás vuelve a la lista.
    const [params, setParams] = useSearchParams();
    const campaniaId = params.get('c');

    const [campanias, setCampanias] = useState([]);
    const [estadoLista, setEstadoLista] = useState('cargando');

    const [metricas, setMetricas] = useState(null);
    const [estadoMetricas, setEstadoMetricas] = useState('cargando');

    const [contactos, setContactos] = useState([]);
    const [totalContactos, setTotalContactos] = useState(0);
    const [pageCont, setPageCont] = useState(0);
    const [filtro, setFiltro] = useState('todos');
    const [estadoCont, setEstadoCont] = useState('cargando');

    const [convs, setConvs] = useState([]);
    const [estadoConvs, setEstadoConvs] = useState('cargando');

    // Si el usuario cambia de filtro o de página mientras viaja un pedido, el viejo no pisa al nuevo.
    const pedidoCont = useRef(0);

    const cargarLista = useCallback(() => {
        setEstadoLista('cargando');
        api.get('/wapi/campanias')
            .then((r) => {
                setCampanias(r.data || []);
                setEstadoLista('ok');
            })
            .catch(() => setEstadoLista('error'));
    }, []);

    useEffect(() => {
        cargarLista();
    }, [cargarLista]);

    const cargarMetricas = useCallback((id) => {
        setEstadoMetricas('cargando');
        api.get(`/wapi/analitica/campania/${id}`)
            .then((r) => {
                setMetricas(r.data);
                setEstadoMetricas('ok');
            })
            .catch(() => setEstadoMetricas('error'));
    }, []);

    const cargarContactos = useCallback((id, page, flt) => {
        const n = ++pedidoCont.current;
        setEstadoCont('cargando');
        api.get(`/wapi/analitica/campania/${id}/contactos`, { params: { page: page + 1, limit: POR_PAGINA, filtro: flt } })
            .then((r) => {
                if (n !== pedidoCont.current) return;
                setContactos(r.data.data || []);
                setTotalContactos(r.data.total || 0);
                setEstadoCont('ok');
            })
            .catch(() => {
                if (n === pedidoCont.current) setEstadoCont('error');
            });
    }, []);

    const cargarConvs = useCallback((id) => {
        setEstadoConvs('cargando');
        api.get(`/wapi/analitica/campania/${id}/conversaciones`)
            .then((r) => {
                setConvs(r.data || []);
                setEstadoConvs('ok');
            })
            .catch(() => setEstadoConvs('error'));
    }, []);

    // Al abrir (o cambiar) la campaña se recarga todo desde cero.
    useEffect(() => {
        if (!campaniaId) return;
        setMetricas(null);
        setContactos([]);
        setConvs([]);
        setPageCont(0);
        setFiltro('todos');
        cargarMetricas(campaniaId);
        cargarContactos(campaniaId, 0, 'todos');
        cargarConvs(campaniaId);
    }, [campaniaId, cargarMetricas, cargarContactos, cargarConvs]);

    const abrir = (id) => setParams((p) => { const s = new URLSearchParams(p); s.set('c', String(id)); return s; });
    const volver = () => setParams((p) => { const s = new URLSearchParams(p); s.delete('c'); return s; });

    const cambiarFiltro = (f) => {
        setFiltro(f);
        setPageCont(0);
        cargarContactos(campaniaId, 0, f);
    };

    const cambiarPagina = (_, nueva) => {
        setPageCont(nueva);
        cargarContactos(campaniaId, nueva, filtro);
    };

    const irAlInbox = (conversacionId) => navigate(`/wapi/inbox?c=${conversacionId}`);

    // ----- Lista de campañas -----
    if (!campaniaId) {
        const columnas = [
            { key: 'nombre', label: 'Campaña', primary: true },
            { key: 'estado', label: 'Estado', secondary: true, render: (c) => { const e = estadoCampania(c.estado); return <StatusChip label={e.label} tono={e.tono} vivo={e.vivo} />; } },
            { key: 'template', label: 'Plantilla', render: (c) => c.template?.metaNombre ?? '—', hideBelow: 'lg' },
            { key: 'enviadoAt', label: 'Envío', render: (c) => fmtFecha(c.enviadoAt) },
        ];
        return (
            <SectionCard title="Elegí una campaña" subtitle="Tocá una fila para ver sus métricas." noPadding>
                {estadoLista === 'cargando' ? (
                    <BloqueEstado estado="cargando" />
                ) : estadoLista === 'error' ? (
                    <Box sx={{ px: 2, pb: 2 }}><BloqueEstado estado="error" mensaje="No se pudieron cargar las campañas." onReintentar={cargarLista} /></Box>
                ) : (
                    <DataTableResponsive
                        ariaLabel="Campañas de WhatsApp API"
                        columns={columnas}
                        rows={campanias}
                        onRowClick={(c) => abrir(c.id)}
                        acciones={(c) => (
                            <Button size="small" variant="outlined" onClick={() => abrir(c.id)}>Ver métricas</Button>
                        )}
                        empty={<EmptyState compact title="Todavía no hay campañas" description="Cuando envíes una campaña de WhatsApp API van a aparecer sus métricas acá." />}
                    />
                )}
            </SectionCard>
        );
    }

    // ----- Detalle -----
    const cabecera = (
        <Button startIcon={<ArrowLeft size={18} strokeWidth={1.75} aria-hidden />} onClick={volver} sx={{ mb: 2, minHeight: { xs: 44, sm: 36 } }}>
            Volver a las campañas
        </Button>
    );

    if (estadoMetricas === 'cargando' && !metricas) {
        return <Box>{cabecera}<BloqueEstado estado="cargando" mensaje="Cargando métricas…" /></Box>;
    }
    if (estadoMetricas === 'error' || !metricas) {
        return (
            <Box>
                {cabecera}
                <BloqueEstado estado="error" mensaje="No se pudieron cargar las métricas de la campaña." onReintentar={() => cargarMetricas(campaniaId)} />
            </Box>
        );
    }

    const { campania, conteos, tasas, engagement, tiempos } = metricas;
    const estadoC = estadoCampania(campania.estado);
    const respondieron = engagement.respondieron;

    const kpis = [
        { titulo: 'Total', valor: fmtNumero(conteos.total) },
        { titulo: 'Enviados', valor: fmtNumero(conteos.enviados), leyenda: `${porcentaje(conteos.enviados, conteos.total)}% del total` },
        { titulo: 'Entregados', valor: fmtNumero(conteos.entregados), leyenda: `${tasas.entrega}% de los enviados` },
        { titulo: 'Leídos', valor: fmtNumero(conteos.leidos), leyenda: `${tasas.lectura}% de los enviados` },
        { titulo: 'Respondieron', valor: fmtNumero(respondieron), leyenda: `${porcentaje(respondieron, conteos.enviados)}% de los enviados` },
        { titulo: 'Fallidos', valor: fmtNumero(conteos.fallidos), leyenda: `${tasas.fallo}% del total`, tonoLeyenda: conteos.fallidos > 0 ? 'error' : 'normal' },
        { titulo: 'Omitidos por baja', valor: fmtNumero(conteos.omitidosPorBaja), leyenda: `${porcentaje(conteos.omitidosPorBaja, conteos.total)}% del total` },
        { titulo: 'Tiempo hasta la entrega', valor: fmtDuracion(tiempos.avgEntregaMs), leyenda: 'promedio' },
        { titulo: 'Tiempo hasta la lectura', valor: fmtDuracion(tiempos.avgLecturaMs), leyenda: 'promedio' },
    ];

    const embudo = [
        { nombre: 'Enviados', valor: conteos.enviados, color: g.info },
        { nombre: 'Entregados', valor: conteos.entregados, color: g.primary },
        { nombre: 'Leídos', valor: conteos.leidos, color: g.success },
        { nombre: 'Respondieron', valor: respondieron, color: g.warning },
    ];

    // El color va en cada dato, no por índice: antes se filtraban las categorías en 0 y los colores se corrían.
    const estados = [
        { name: 'Leídos', value: conteos.leidos, color: g.success },
        { name: 'Entregados', value: Math.max(0, conteos.entregados - conteos.leidos), color: g.primary },
        { name: 'Enviados', value: Math.max(0, conteos.enviados - conteos.entregados), color: g.info },
        { name: 'Fallidos', value: conteos.fallidos, color: g.error },
        { name: 'Pendientes', value: conteos.pendientes, color: g.neutro },
    ].filter((d) => d.value > 0);

    const columnasContactos = [
        { key: 'numero', label: 'Número', primary: true },
        { key: 'nombre', label: 'Nombre', secondary: true, render: (c) => c.nombre ?? '—' },
        { key: 'estado', label: 'Estado', render: (c) => { const e = estadoMensaje(c.estado); return <StatusChip label={e.label} tono={e.tono} />; } },
        { key: 'enviadoAt', label: 'Enviado', render: (c) => fmtFecha(c.enviadoAt), hideBelow: 'lg' },
        { key: 'entregadoAt', label: 'Entregado', render: (c) => fmtFecha(c.entregadoAt), hideBelow: 'lg' },
        { key: 'leidoAt', label: 'Leído', render: (c) => fmtFecha(c.leidoAt), hideBelow: 'lg' },
        { key: 'respondio', label: 'Respondió', render: (c) => (c.respondio ? 'Sí' : 'No') },
        { key: 'presionoBoton', label: 'Botón', render: (c) => (c.presionoBoton ? `Sí${c.payload ? ` (${c.payload})` : ''}` : 'No') },
        { key: 'dioDebaja', label: 'Baja', render: (c) => (c.dioDebaja ? 'Sí' : 'No') },
    ];

    const columnasConvs = [
        { key: 'numero', label: 'Número', primary: true },
        { key: 'nombre', label: 'Nombre', secondary: true, render: (c) => c.nombre ?? '—' },
        { key: 'estado', label: 'Estado', render: (c) => { const e = estadoConversacion(c.estado); return <StatusChip label={e.label} tono={e.tono} />; } },
        { key: 'asesor', label: 'Asesor', render: (c) => c.asignadoA?.nombre ?? '—' },
        { key: 'primeraRespuestaAt', label: '1ª respuesta', render: (c) => fmtFecha(c.primeraRespuestaAt), hideBelow: 'lg' },
        { key: 'resolvedAt', label: 'Resuelta', render: (c) => fmtFecha(c.resolvedAt), hideBelow: 'lg' },
    ];

    const filasContactos = contactos.map((c, i) => ({ ...c, _k: `${pageCont}-${i}` }));

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>{cabecera}</Box>

            <SectionCard
                title={campania.nombre}
                action={<StatusChip label={estadoC.label} tono={estadoC.tono} vivo={estadoC.vivo} />}
                subtitle={`Plantilla: ${campania.template?.metaNombre ?? '—'} · Línea: ${campania.config?.nombre ?? '—'} · Envío: ${fmtFecha(campania.enviadoAt)}`}
            >
                <PanelAnalisisIA endpoint={`/wapi/analitica/campania/${campaniaId}/ai`} label="Analizar campaña con IA" />
                <GrillaKpi items={kpis} max={5} />
            </SectionCard>

            <SectionCard title="Embudo de la campaña" subtitle="Cuántos contactos llegaron a cada paso.">
                <Box sx={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={embudo} margin={{ left: 0, right: celular ? 44 : 60, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={g.grilla} horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="nombre" type="category" width={celular ? 92 : 110} {...g.eje} axisLine={false} />
                            <RTooltip {...g.tooltip} formatter={(v) => [fmtNumero(v), 'Contactos']} />
                            <Bar dataKey="valor" radius={[0, 4, 4, 0]} name="Contactos">
                                <LabelList dataKey="valor" position="right" formatter={fmtNumero} style={{ fontSize: 12, fontWeight: 600, fill: g.texto }} />
                                {embudo.map((d) => <Cell key={d.nombre} fill={d.color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
            </SectionCard>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' } }}>
                <SectionCard title="Estado de los mensajes" subtitle="Cada contacto cuenta una sola vez, en su último estado.">
                    {estados.length === 0 ? (
                        <EmptyState compact title="Sin mensajes todavía" />
                    ) : (
                        <Box sx={{ height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={estados} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={celular ? 48 : 60} outerRadius={celular ? 80 : 95} stroke={theme.palette.background.paper}>
                                        {estados.map((d) => <Cell key={d.name} fill={d.color} />)}
                                    </Pie>
                                    <RTooltip {...g.tooltip} formatter={(v, n) => [fmtNumero(v), n]} />
                                    <Legend iconSize={12} wrapperStyle={{ fontSize: 12 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </Box>
                    )}
                </SectionCard>

                <SectionCard title="A qué hora se leyeron" subtitle="Lecturas por hora del día.">
                    <Box sx={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={tiempos.distribucionHorariaLecturas} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={g.grilla} vertical={false} />
                                <XAxis dataKey="hora" tickFormatter={(h) => `${h}h`} interval={celular ? 2 : 1} {...g.eje} />
                                <YAxis width={celular ? 32 : 40} allowDecimals={false} {...g.eje} axisLine={false} />
                                <RTooltip {...g.tooltip} formatter={(v) => [fmtNumero(v), 'Lecturas']} labelFormatter={(h) => `${h}:00 hs`} />
                                <Bar dataKey="count" fill={g.success} name="Lecturas" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                </SectionCard>
            </Box>

            <SectionCard title="Respuestas" subtitle="Lo que hicieron los contactos después de recibir el mensaje.">
                <GrillaKpi
                    max={3}
                    items={[
                        { titulo: 'Respondieron', valor: fmtNumero(respondieron) },
                        { titulo: 'Tocaron un botón', valor: fmtNumero(engagement.presionaronBoton) },
                        { titulo: 'Se dieron de baja', valor: fmtNumero(engagement.bajas) },
                    ]}
                />
                {engagement.payloadBreakdown.length > 0 && (
                    <Box sx={{ mt: 2.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Botones más tocados</Typography>
                        <Box sx={{ height: Math.max(140, engagement.payloadBreakdown.length * 34) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={engagement.payloadBreakdown} margin={{ left: 0, right: 24 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={g.grilla} horizontal={false} />
                                    <XAxis type="number" allowDecimals={false} {...g.eje} />
                                    <YAxis dataKey="payload" type="category" width={celular ? 84 : 140} tickFormatter={(p) => cortar(p, celular ? 12 : 22)} {...g.eje} axisLine={false} />
                                    <RTooltip {...g.tooltip} formatter={(v) => [fmtNumero(v), 'Toques']} />
                                    <Bar dataKey="count" fill={g.warning} radius={[0, 4, 4, 0]} name="Toques" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Box>
                )}
            </SectionCard>

            <SectionCard title="Contactos" subtitle={`${fmtNumero(totalContactos)} en este filtro`} noPadding>
                <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 1.5 }}>
                    <TextField
                        select
                        size="small"
                        label="Mostrar"
                        value={filtro}
                        onChange={(e) => cambiarFiltro(e.target.value)}
                        sx={{ display: { xs: 'block', md: 'none' }, maxWidth: 280 }}
                        fullWidth
                    >
                        {FILTROS.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
                    </TextField>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ display: { xs: 'none', md: 'flex' } }} role="group" aria-label="Filtrar contactos">
                        {FILTROS.map((f) => (
                            <Chip
                                key={f.value}
                                label={f.label}
                                onClick={() => cambiarFiltro(f.value)}
                                color={filtro === f.value ? 'primary' : 'default'}
                                variant={filtro === f.value ? 'filled' : 'outlined'}
                                aria-pressed={filtro === f.value}
                            />
                        ))}
                    </Stack>
                </Box>
                {estadoCont === 'error' ? (
                    <Box sx={{ px: 2, pb: 2 }}><BloqueEstado estado="error" mensaje="No se pudieron cargar los contactos." onReintentar={() => cargarContactos(campaniaId, pageCont, filtro)} /></Box>
                ) : (
                    <DataTableResponsive
                        ariaLabel="Contactos de la campaña"
                        columns={columnasContactos}
                        rows={filasContactos}
                        rowKey={(c) => c._k}
                        loading={estadoCont === 'cargando'}
                        onRowClick={(c) => c.conversacionId && irAlInbox(c.conversacionId)}
                        acciones={(c) => c.conversacionId ? (
                            <Button size="small" startIcon={<MessageSquareText size={16} strokeWidth={1.75} aria-hidden />} onClick={() => irAlInbox(c.conversacionId)}>
                                Ver conversación
                            </Button>
                        ) : null}
                        empty={<EmptyState compact title="Sin resultados" description="Ningún contacto cumple con este filtro." />}
                    />
                )}
                <TablePagination
                    component="div"
                    count={totalContactos}
                    page={pageCont}
                    onPageChange={cambiarPagina}
                    rowsPerPage={POR_PAGINA}
                    rowsPerPageOptions={[POR_PAGINA]}
                    labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                />
            </SectionCard>

            <SectionCard
                title={`Conversaciones (${fmtNumero(metricas.conversaciones.total)})`}
                subtitle={`Sin asignar: ${fmtNumero(metricas.conversaciones.sinAsignar)} · Asignadas: ${fmtNumero(metricas.conversaciones.asignadas)} · Resueltas: ${fmtNumero(metricas.conversaciones.resueltas)}`}
                noPadding
            >
                {estadoConvs === 'error' ? (
                    <Box sx={{ px: 2, pb: 2 }}><BloqueEstado estado="error" mensaje="No se pudieron cargar las conversaciones." onReintentar={() => cargarConvs(campaniaId)} /></Box>
                ) : (
                    <DataTableResponsive
                        ariaLabel="Conversaciones de la campaña"
                        columns={columnasConvs}
                        rows={convs}
                        loading={estadoConvs === 'cargando'}
                        onRowClick={(c) => irAlInbox(c.id)}
                        acciones={(c) => (
                            <Button size="small" startIcon={<MessageSquareText size={16} strokeWidth={1.75} aria-hidden />} onClick={() => irAlInbox(c.id)}>
                                Abrir
                            </Button>
                        )}
                        empty={<EmptyState compact title="Sin conversaciones" description="Nadie respondió todavía." />}
                    />
                )}
            </SectionCard>

            {metricas.errores.length > 0 && (
                <SectionCard
                    title="Errores de envío"
                    subtitle={`${fmtNumero(metricas.errores.reduce((a, e) => a + e.count, 0))} mensajes fallidos`}
                    noPadding
                >
                    <DataTableResponsive
                        ariaLabel="Errores de envío"
                        columns={[
                            { key: 'error', label: 'Error', primary: true, render: (e) => <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 12.5 }}>{e.error}</Box> },
                            { key: 'count', label: 'Cantidad', align: 'right', render: (e) => fmtNumero(e.count) },
                        ]}
                        rows={metricas.errores}
                        rowKey={(e) => e.error}
                    />
                </SectionCard>
            )}
        </Box>
    );
}
