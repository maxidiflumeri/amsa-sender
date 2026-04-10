import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Grid, Chip, Table, TableHead, TableRow,
    TableCell, TableBody, TablePagination, CircularProgress, Alert,
    Button, IconButton, Tooltip, Accordion, AccordionSummary,
    AccordionDetails, Card, CardContent, Divider, Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BarChartIcon from '@mui/icons-material/BarChart';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
    Legend, PieChart, Pie, Cell, ResponsiveContainer, LabelList,
} from 'recharts';
import api from '../../../api/axios';
import PanelAnalisisIA from './PanelAnalisisIA';

const ESTADO_MSG_CHIP = {
    sent:      { label: 'Enviado',   color: 'info' },
    delivered: { label: 'Entregado', color: 'primary' },
    read:      { label: 'Leído',     color: 'success' },
    failed:    { label: 'Fallido',   color: 'error' },
    pendiente: { label: 'Pendiente', color: 'default' },
};

const ESTADO_CAMPANIA_CHIP = {
    pendiente:  { label: 'Pendiente',  color: 'default' },
    agendada:   { label: 'Agendada',   color: 'info' },
    procesando: { label: 'Procesando', color: 'info' },
    pausada:    { label: 'Pausada',    color: 'warning' },
    finalizada: { label: 'Finalizada', color: 'success' },
    error:      { label: 'Error',      color: 'error' },
};

const PIE_COLORS = ['#4caf50', '#2196f3', '#ff9800', '#f44336', '#9e9e9e'];

function formatMs(ms) {
    if (!ms) return '—';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) return `${m}m ${rem}s`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatFecha(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function KpiCard({ label, value, color = 'text.primary', subtitle }) {
    return (
        <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent sx={{ pb: '8px !important' }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="h5" fontWeight="bold" color={color}>{value}</Typography>
                {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
            </CardContent>
        </Card>
    );
}

const FILTROS = [
    { value: 'todos',       label: 'Todos' },
    { value: 'enviados',    label: 'Enviados' },
    { value: 'entregados',  label: 'Entregados' },
    { value: 'leidos',      label: 'Leídos' },
    { value: 'fallidos',    label: 'Fallidos' },
    { value: 'respondieron',label: 'Respondieron' },
    { value: 'bajas',       label: 'Bajas' },
];

export default function MetricasCampania() {
    const [campanias, setCampanias] = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [campaniaId, setCampaniaId] = useState(null);
    const [metricas, setMetricas] = useState(null);
    const [loadingMetricas, setLoadingMetricas] = useState(false);
    const [errorMetricas, setErrorMetricas] = useState('');

    // Contactos paginados
    const [contactos, setContactos] = useState([]);
    const [totalContactos, setTotalContactos] = useState(0);
    const [pageCont, setPageCont] = useState(0);
    const [filtro, setFiltro] = useState('todos');
    const [loadingCont, setLoadingCont] = useState(false);

    // Conversaciones
    const [convs, setConvs] = useState([]);
    const [loadingConvs, setLoadingConvs] = useState(false);

    useEffect(() => {
        api.get('/wapi/campanias').then(r => {
            setCampanias(r.data || []);
        }).catch(() => {}).finally(() => setLoadingList(false));
    }, []);

    const cargarMetricas = useCallback(async (id) => {
        setLoadingMetricas(true);
        setErrorMetricas('');
        try {
            const r = await api.get(`/wapi/analitica/campania/${id}`);
            setMetricas(r.data);
        } catch {
            setErrorMetricas('Error al cargar métricas');
        } finally {
            setLoadingMetricas(false);
        }
    }, []);

    const cargarContactos = useCallback(async (id, page, flt) => {
        setLoadingCont(true);
        try {
            const r = await api.get(`/wapi/analitica/campania/${id}/contactos`, {
                params: { page: page + 1, limit: 20, filtro: flt },
            });
            setContactos(r.data.data || []);
            setTotalContactos(r.data.total || 0);
        } catch {
            setContactos([]);
        } finally {
            setLoadingCont(false);
        }
    }, []);

    const cargarConvs = useCallback(async (id) => {
        setLoadingConvs(true);
        try {
            const r = await api.get(`/wapi/analitica/campania/${id}/conversaciones`);
            setConvs(r.data || []);
        } catch {
            setConvs([]);
        } finally {
            setLoadingConvs(false);
        }
    }, []);

    const verMetricas = (id) => {
        setCampaniaId(id);
        cargarMetricas(id);
        cargarContactos(id, 0, 'todos');
        cargarConvs(id);
        setPageCont(0);
        setFiltro('todos');
    };

    const handleFiltro = (f) => {
        setFiltro(f);
        setPageCont(0);
        cargarContactos(campaniaId, 0, f);
    };

    const handlePageCont = (_, newPage) => {
        setPageCont(newPage);
        cargarContactos(campaniaId, newPage, filtro);
    };

    if (!campaniaId) {
        // Vista lista
        return (
            <Box>
                <Typography variant="h6" mb={2}>Seleccionar campaña para ver métricas</Typography>
                {loadingList ? (
                    <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
                ) : (
                    <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: { sm: 480 } }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Nombre</TableCell>
                                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Template</TableCell>
                                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Fecha envío</TableCell>
                                    <TableCell>Estado</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {campanias.length === 0 && (
                                    <TableRow><TableCell colSpan={5} align="center">Sin campañas</TableCell></TableRow>
                                )}
                                {campanias.map(c => {
                                    const chip = ESTADO_CAMPANIA_CHIP[c.estado] || { label: c.estado, color: 'default' };
                                    return (
                                        <TableRow key={c.id} hover>
                                            <TableCell>{c.nombre}</TableCell>
                                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{c.template?.metaNombre ?? '—'}</TableCell>
                                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{formatFecha(c.enviadoAt)}</TableCell>
                                            <TableCell>
                                                <Chip label={chip.label} color={chip.color} size="small" />
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title="Ver métricas">
                                                    <IconButton size="small" onClick={() => verMetricas(c.id)}>
                                                        <BarChartIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </Paper>
                )}
            </Box>
        );
    }

    // Vista detallada
    return (
        <Box>
            <Button startIcon={<ArrowBackIcon />} onClick={() => { setCampaniaId(null); setMetricas(null); }} sx={{ mb: 2 }}>
                Volver
            </Button>

            {loadingMetricas && <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>}
            {errorMetricas && <Alert severity="error">{errorMetricas}</Alert>}

            {metricas && !loadingMetricas && (
                <Box>
                    {/* Header campaña */}
                    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                            <Box flexGrow={1}>
                                <Typography variant="h6" fontWeight="bold">{metricas.campania.nombre}</Typography>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.25, sm: 1 }}>
                                    <Typography variant="body2" color="text.secondary">Template: {metricas.campania.template?.metaNombre ?? '—'}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>|</Typography>
                                    <Typography variant="body2" color="text.secondary">Línea: {metricas.campania.config?.nombre ?? '—'}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>|</Typography>
                                    <Typography variant="body2" color="text.secondary">Envío: {formatFecha(metricas.campania.enviadoAt)}</Typography>
                                </Stack>
                            </Box>
                            {(() => {
                                const chip = ESTADO_CAMPANIA_CHIP[metricas.campania.estado] || { label: metricas.campania.estado, color: 'default' };
                                return <Chip label={chip.label} color={chip.color} />;
                            })()}
                        </Stack>
                    </Paper>

                    <PanelAnalisisIA
                        endpoint={`/wapi/analitica/campania/${campaniaId}/ai`}
                        label="Analizar campaña con IA"
                    />

                    {/* KPI Cards */}
                    <Grid container spacing={1.5} mb={3}>
                        {[
                            { label: 'Total',            value: metricas.conteos.total },
                            { label: 'Enviados',         value: metricas.conteos.enviados,         color: 'info.main',    subtitle: `${metricas.tasas.entrega}% entrega` },
                            { label: 'Entregados',       value: metricas.conteos.entregados,       color: 'primary.main', subtitle: `${metricas.conteos.enviados > 0 ? ((metricas.conteos.entregados / metricas.conteos.enviados) * 100).toFixed(1) : 0}% entrega` },
                            { label: 'Leídos',           value: metricas.conteos.leidos,           color: 'success.main', subtitle: `${metricas.tasas.lectura}% lectura` },
                            { label: 'Respondidos',      value: metricas.engagement.respondieron,  color: 'secondary.main', subtitle: `${metricas.conteos.enviados > 0 ? ((metricas.engagement.respondieron / metricas.conteos.enviados) * 100).toFixed(1) : 0}% respuesta` },
                            { label: 'Fallidos',         value: metricas.conteos.fallidos,         color: 'error.main',   subtitle: `${metricas.tasas.fallo}% fallo` },
                            { label: 'Omitidos por baja',value: metricas.conteos.omitidosPorBaja,  color: 'warning.main', subtitle: `${metricas.conteos.total > 0 ? ((metricas.conteos.omitidosPorBaja / metricas.conteos.total) * 100).toFixed(1) : 0}% del total` },
                            { label: 'Avg entrega',      value: formatMs(metricas.tiempos.avgEntregaMs) },
                            { label: 'Avg lectura',      value: formatMs(metricas.tiempos.avgLecturaMs) },
                        ].map(k => (
                            <Grid item xs={6} sm={4} md={3} lg={true} key={k.label}>
                                <KpiCard {...k} />
                            </Grid>
                        ))}
                    </Grid>

                    {/* Funnel */}
                    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={2}>Funnel de campaña</Typography>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                                layout="vertical"
                                data={[
                                    { nombre: 'Enviados',     valor: metricas.conteos.enviados },
                                    { nombre: 'Entregados',   valor: metricas.conteos.entregados },
                                    { nombre: 'Leídos',       valor: metricas.conteos.leidos },
                                    { nombre: 'Respondieron', valor: metricas.engagement.respondieron },
                                ]}
                                margin={{ left: 10, right: 70, top: 5, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="nombre" type="category" width={100} />
                                <RTooltip />
                                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="valor" position="right" style={{ fontSize: 13, fontWeight: 'bold' }} />
                                    {['#2196f3', '#4caf50', '#8bc34a', '#ff9800'].map((color, i) => (
                                        <Cell key={i} fill={color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>

                    {/* Distribución de estados */}
                    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={2}>Distribución de estados</Typography>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Leídos',     value: metricas.conteos.leidos },
                                        { name: 'Entregados', value: Math.max(0, metricas.conteos.entregados - metricas.conteos.leidos) },
                                        { name: 'Enviados',   value: Math.max(0, metricas.conteos.enviados - metricas.conteos.entregados) },
                                        { name: 'Fallidos',   value: metricas.conteos.fallidos },
                                        { name: 'Pendientes', value: metricas.conteos.pendientes },
                                    ].filter(d => d.value > 0)}
                                    cx="50%" cy="45%"
                                    innerRadius={60} outerRadius={95}
                                    dataKey="value"
                                >
                                    {PIE_COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                                </Pie>
                                <RTooltip formatter={(v, n) => [v, n]} />
                                <Legend iconSize={12} />
                            </PieChart>
                        </ResponsiveContainer>
                    </Paper>

                    {/* Distribución horaria lecturas */}
                    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={2}>Distribución horaria de lecturas</Typography>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={metricas.tiempos.distribucionHorariaLecturas} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="hora" tickFormatter={h => `${h}h`} />
                                <YAxis />
                                <RTooltip formatter={(v) => [v, 'Lecturas']} labelFormatter={h => `${h}:00 hs`} />
                                <Bar dataKey="count" fill="#8bc34a" name="Lecturas" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>

                    {/* Engagement */}
                    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={2}>Engagement</Typography>
                        <Grid container spacing={2} mb={2}>
                            <Grid item xs={12} sm={4}>
                                <KpiCard label="Respondieron" value={metricas.engagement.respondieron} color="primary.main" />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <KpiCard label="Presionaron botón" value={metricas.engagement.presionaronBoton} color="secondary.main" />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <KpiCard label="Bajas" value={metricas.engagement.bajas} color="error.main" />
                            </Grid>
                        </Grid>
                        {metricas.engagement.payloadBreakdown.length > 0 && (
                            <Box>
                                <Typography variant="caption" color="text.secondary" mb={1} display="block">Breakdown de payloads</Typography>
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart
                                        layout="vertical"
                                        data={metricas.engagement.payloadBreakdown}
                                        margin={{ left: 10, right: 30 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="payload" type="category" width={120} />
                                        <RTooltip />
                                        <Bar dataKey="count" fill="#ff9800" radius={[0, 4, 4, 0]} name="Clicks" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        )}
                    </Paper>

                    {/* Tabla de contactos */}
                    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={2}>Contactos</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" mb={2} useFlexGap>
                            {FILTROS.map(f => (
                                <Chip
                                    key={f.value}
                                    label={f.label}
                                    onClick={() => handleFiltro(f.value)}
                                    color={filtro === f.value ? 'primary' : 'default'}
                                    variant={filtro === f.value ? 'filled' : 'outlined'}
                                    size="small"
                                />
                            ))}
                        </Stack>
                        {loadingCont ? (
                            <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box>
                        ) : (
                            <Box sx={{ overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: { xs: 380, sm: 640 } }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Número</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Nombre</TableCell>
                                        <TableCell>Estado</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Enviado</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Entregado</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Leído</TableCell>
                                        <TableCell>Resp.</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Botón</TableCell>
                                        <TableCell>Baja</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {contactos.length === 0 && (
                                        <TableRow><TableCell colSpan={9} align="center">Sin resultados</TableCell></TableRow>
                                    )}
                                    {contactos.map((c, i) => {
                                        const chip = ESTADO_MSG_CHIP[c.estado] || { label: c.estado, color: 'default' };
                                        return (
                                            <TableRow key={i} hover sx={{ cursor: c.conversacionId ? 'pointer' : 'default' }}
                                                onClick={() => c.conversacionId && alert(`Conversación #${c.conversacionId} — Ver en Inbox`)}>
                                                <TableCell>{c.numero}</TableCell>
                                                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{c.nombre ?? '—'}</TableCell>
                                                <TableCell>
                                                    <Chip label={chip.label} color={chip.color} size="small" />
                                                </TableCell>
                                                <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>{formatFecha(c.enviadoAt)}</TableCell>
                                                <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>{formatFecha(c.entregadoAt)}</TableCell>
                                                <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>{formatFecha(c.leidoAt)}</TableCell>
                                                <TableCell>{c.respondio ? '✓' : '✗'}</TableCell>
                                                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                                    {c.presionoBoton ? (
                                                        <Tooltip title={`Payload: ${c.payload ?? '?'}`}><span>✓</span></Tooltip>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell>{c.dioDebaja ? '✓' : '—'}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            </Box>
                        )}
                        <TablePagination
                            component="div"
                            count={totalContactos}
                            page={pageCont}
                            onPageChange={handlePageCont}
                            rowsPerPage={20}
                            rowsPerPageOptions={[20]}
                            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                        />
                    </Paper>

                    {/* Conversaciones */}
                    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={2}>
                            Conversaciones ({metricas.conversaciones.total})
                        </Typography>
                        <Stack direction="row" spacing={2} mb={2}>
                            <Chip label={`Sin asignar: ${metricas.conversaciones.sinAsignar}`} size="small" />
                            <Chip label={`Asignadas: ${metricas.conversaciones.asignadas}`} color="info" size="small" />
                            <Chip label={`Resueltas: ${metricas.conversaciones.resueltas}`} color="success" size="small" />
                        </Stack>
                        {loadingConvs ? (
                            <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box>
                        ) : (
                            <Box sx={{ overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: { xs: 300, sm: 520 } }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Número</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Nombre</TableCell>
                                        <TableCell>Estado</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Asesor</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>1ra respuesta</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Resuelta</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {convs.length === 0 && (
                                        <TableRow><TableCell colSpan={6} align="center">Sin conversaciones</TableCell></TableRow>
                                    )}
                                    {convs.map(c => (
                                        <TableRow key={c.id} hover>
                                            <TableCell>{c.numero}</TableCell>
                                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{c.nombre ?? '—'}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={c.estado.replace('_', ' ')}
                                                    color={c.estado === 'resuelta' ? 'success' : c.estado === 'asignada' ? 'info' : 'default'}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{c.asignadoA?.nombre ?? '—'}</TableCell>
                                            <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>{formatFecha(c.primeraRespuestaAt)}</TableCell>
                                            <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>{formatFecha(c.resolvedAt)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </Box>
                        )}
                    </Paper>

                    {/* Errores */}
                    {metricas.errores.length > 0 && (
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle2" fontWeight="bold">
                                    Errores ({metricas.errores.reduce((a, e) => a + e.count, 0)} mensajes fallidos)
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Box sx={{ overflowX: 'auto' }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Error</TableCell>
                                            <TableCell align="right">Cantidad</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {metricas.errores.map((e, i) => (
                                            <TableRow key={i}>
                                                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{e.error}</TableCell>
                                                <TableCell align="right">{e.count}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                </Box>
                            </AccordionDetails>
                        </Accordion>
                    )}
                </Box>
            )}
        </Box>
    );
}
