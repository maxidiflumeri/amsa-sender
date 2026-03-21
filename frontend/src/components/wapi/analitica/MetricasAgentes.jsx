import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Grid, Button, ButtonGroup, Table, TableHead,
    TableRow, TableCell, TableBody, CircularProgress, Alert, Card,
    CardContent, Stack, IconButton, Tooltip, Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
    Legend, LineChart, Line, ResponsiveContainer,
} from 'recharts';
import api from '../../../api/axios';

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
                <Typography variant="h5" fontWeight="bold" color={color}>{value ?? '—'}</Typography>
                {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
            </CardContent>
        </Card>
    );
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function HeatmapActividad({ agentes }) {
    // Agregamos actividad por día-hora de todos los agentes
    const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));

    agentes.forEach(a => {
        if (!a.actividadPorHora) return;
        // actividadPorHora solo tiene horas, no días; el heatmap usa la data global
        // En MetricasAgentes usamos actividadPorHora simplificada (solo horas en total)
    });

    return null; // placeholder cuando no hay datos de día-hora por agente individual
}

export default function MetricasAgentes() {
    const [periodo, setPeriodo] = useState('30d');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [datos, setDatos] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [agenteDetalle, setAgenteDetalle] = useState(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [detalle, setDetalle] = useState(null);

    const getRango = useCallback((p) => {
        const hasta = new Date();
        const desde = new Date();
        if (p === '1d') desde.setDate(desde.getDate() - 1);
        else if (p === '7d') desde.setDate(desde.getDate() - 7);
        else desde.setDate(desde.getDate() - 30);
        return {
            desde: desde.toISOString().slice(0, 10),
            hasta: hasta.toISOString().slice(0, 10),
        };
    }, []);

    const cargar = useCallback(async (desdeStr, hastaStr) => {
        setLoading(true);
        setError('');
        try {
            const r = await api.get('/wapi/analitica/agentes', { params: { desde: desdeStr, hasta: hastaStr } });
            setDatos(r.data);
        } catch {
            setError('Error al cargar métricas de agentes');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const { desde: d, hasta: h } = getRango(periodo);
        setDesde(d);
        setHasta(h);
        cargar(d, h);
    }, [periodo, getRango, cargar]);

    const verDetalle = async (agente) => {
        setAgenteDetalle(agente);
        setLoadingDetalle(true);
        try {
            const { desde: d, hasta: h } = getDesdeHasta();
            const r = await api.get(`/wapi/analitica/agentes/${agente.id}`, { params: { desde: d, hasta: h } });
            setDetalle(r.data);
        } catch {
            setDetalle(null);
        } finally {
            setLoadingDetalle(false);
        }
    };

    const getDesdeHasta = () => {
        if (desde && hasta) return { desde, hasta };
        return getRango(periodo);
    };

    const aplicarRangoCustom = () => {
        if (desde && hasta) cargar(desde, hasta);
    };

    if (agenteDetalle) {
        return (
            <Box>
                <Button startIcon={<ArrowBackIcon />} onClick={() => { setAgenteDetalle(null); setDetalle(null); }} sx={{ mb: 2 }}>
                    Volver
                </Button>
                <Typography variant="h6" fontWeight="bold" mb={2}>
                    Detalle: {agenteDetalle.nombre}
                </Typography>
                {loadingDetalle && <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>}
                {detalle && (
                    <Box>
                        <Grid container spacing={2} mb={3}>
                            <Grid item xs={6} sm={4} md={2}>
                                <KpiCard label="Asignadas" value={detalle.metricas.asignadas} />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2}>
                                <KpiCard label="Resueltas" value={detalle.metricas.resueltas} color="success.main" />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2}>
                                <KpiCard label="Activas" value={detalle.metricas.activas} color="info.main" />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2}>
                                <KpiCard label="Mensajes enviados" value={detalle.metricas.mensajesEnviados} />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2}>
                                <KpiCard label="Avg 1ra resp." value={formatMs(detalle.metricas.avgPrimeraRespuestaMs)} />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2}>
                                <KpiCard label="Avg resolución" value={formatMs(detalle.metricas.avgResolucionMs)} />
                            </Grid>
                        </Grid>

                        {/* Distribución horaria */}
                        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                            <Typography variant="subtitle2" fontWeight="bold" mb={2}>Actividad por hora</Typography>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={detalle.actividadPorHora} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="hora" tickFormatter={h => `${h}h`} />
                                    <YAxis />
                                    <RTooltip formatter={(v) => [v, 'Mensajes']} labelFormatter={h => `${h}:00 hs`} />
                                    <Bar dataKey="count" fill="#1976d2" radius={[4, 4, 0, 0]} name="Mensajes" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>

                        {/* Actividad por día de semana */}
                        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                            <Typography variant="subtitle2" fontWeight="bold" mb={2}>Actividad por día de semana</Typography>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart
                                    data={detalle.actividadPorDia.map(d => ({
                                        dia: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.dia],
                                        count: d.count,
                                    }))}
                                    margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="dia" />
                                    <YAxis />
                                    <RTooltip />
                                    <Bar dataKey="count" fill="#4caf50" radius={[4, 4, 0, 0]} name="Mensajes" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>

                        {/* Conversaciones del asesor */}
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" fontWeight="bold" mb={2}>Conversaciones en el período</Typography>
                            <Box sx={{ overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: { xs: 300, sm: 520 } }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Número</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Nombre</TableCell>
                                        <TableCell>Estado</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Creada</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>1ra resp.</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Resuelta</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {detalle.conversaciones.length === 0 && (
                                        <TableRow><TableCell colSpan={6} align="center">Sin conversaciones</TableCell></TableRow>
                                    )}
                                    {detalle.conversaciones.map(c => (
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
                                            <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', sm: 'table-cell' } }}>{formatFecha(c.creadoAt)}</TableCell>
                                            <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>{formatFecha(c.primeraRespuestaAt)}</TableCell>
                                            <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>{formatFecha(c.resolvedAt)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </Box>
                        </Paper>
                    </Box>
                )}
            </Box>
        );
    }

    return (
        <Box>
            {/* Selector período */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} mb={3} flexWrap="wrap">
                <ButtonGroup size="small" variant="outlined">
                    {[{ k: '1d', l: 'Hoy' }, { k: '7d', l: '7 días' }, { k: '30d', l: '30 días' }].map(({ k, l }) => (
                        <Button key={k} variant={periodo === k ? 'contained' : 'outlined'} onClick={() => setPeriodo(k)}>
                            {l}
                        </Button>
                    ))}
                </ButtonGroup>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                        style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14, minWidth: 0, width: '100%', maxWidth: 140 }} />
                    <Typography variant="body2">—</Typography>
                    <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                        style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14, minWidth: 0, width: '100%', maxWidth: 140 }} />
                    <Button size="small" variant="outlined" onClick={aplicarRangoCustom}>Aplicar</Button>
                </Stack>
            </Stack>

            {loading && <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>}
            {error && <Alert severity="error">{error}</Alert>}

            {datos && !loading && (
                <Box>
                    {/* KPIs globales */}
                    <Grid container spacing={2} mb={3}>
                        <Grid item xs={6} sm={3}>
                            <KpiCard label="Total conversaciones" value={datos.global.totalConvs} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <KpiCard
                                label="Resueltas"
                                value={datos.global.resueltas}
                                color="success.main"
                                subtitle={datos.global.totalConvs > 0
                                    ? `${Math.round(datos.global.resueltas / datos.global.totalConvs * 100)}%`
                                    : ''}
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <KpiCard label="Avg 1ra respuesta" value={formatMs(datos.global.avgPrimeraRespuestaMs)} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <KpiCard label="Avg resolución" value={formatMs(datos.global.avgResolucionMs)} />
                        </Grid>
                    </Grid>

                    {/* Gráfico comparativo asignadas vs resueltas */}
                    {datos.agentes.length > 0 && (
                        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                            <Typography variant="subtitle2" fontWeight="bold" mb={2}>Comparativa por agente</Typography>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={datos.agentes} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="nombre" />
                                    <YAxis />
                                    <RTooltip />
                                    <Legend />
                                    <Bar dataKey="asignadas" name="Asignadas" fill="#2196f3" stackId="a" />
                                    <Bar dataKey="resueltas" name="Resueltas" fill="#4caf50" stackId="b" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>
                    )}

                    {/* Evolución diaria */}
                    {datos.evolucionDiaria.length > 0 && (
                        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                            <Typography variant="subtitle2" fontWeight="bold" mb={2}>Evolución diaria</Typography>
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={datos.evolucionDiaria} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="fecha" tickFormatter={f => f.slice(5)} />
                                    <YAxis />
                                    <RTooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="convs" name="Conversaciones" stroke="#2196f3" dot={false} />
                                    <Line type="monotone" dataKey="resueltas" name="Resueltas" stroke="#4caf50" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </Paper>
                    )}

                    {/* Heatmap de actividad (por hora por agente) */}
                    {datos.agentes.length > 0 && (() => {
                        const horasData = datos.agentes.flatMap(a =>
                            (a.actividadPorHora || []).map(h => ({ ...h, agente: a.nombre }))
                        );
                        const maxCount = Math.max(1, ...horasData.map(h => h.count));

                        return (
                            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                                <Typography variant="subtitle2" fontWeight="bold" mb={2}>Actividad por hora (agregada)</Typography>
                                {/* Wrapper con scroll horizontal para el heatmap en mobile */}
                                <Box sx={{ overflowX: 'auto', pb: 1 }}>
                                    <Box sx={{ minWidth: 620 }}>
                                        {/* Cabecera de horas */}
                                        <Box display="flex" alignItems="center" mb={0.5}>
                                            <Box width={90} flexShrink={0} />
                                            {Array.from({ length: 24 }, (_, h) => (
                                                <Box key={h} width={22} textAlign="center" flexShrink={0}>
                                                    <Typography variant="caption" sx={{ fontSize: 9 }}>{h}</Typography>
                                                </Box>
                                            ))}
                                        </Box>
                                        {datos.agentes.map(agente => (
                                            <Box key={agente.id} display="flex" alignItems="center" mb={0.25}>
                                                <Box width={90} flexShrink={0}>
                                                    <Typography variant="caption" noWrap sx={{ fontSize: 10 }}>{agente.nombre}</Typography>
                                                </Box>
                                                {(agente.actividadPorHora || Array.from({ length: 24 }, (_, h) => ({ hora: h, count: 0 }))).map(h => (
                                                    <Tooltip key={h.hora} title={`${h.hora}:00 — ${h.count} msgs`}>
                                                        <Box
                                                            width={20} height={16}
                                                            mx={0.1}
                                                            flexShrink={0}
                                                            sx={{
                                                                backgroundColor: `rgba(25, 118, 210, ${h.count / maxCount})`,
                                                                borderRadius: 0.5,
                                                                border: '1px solid rgba(0,0,0,0.08)',
                                                            }}
                                                        />
                                                    </Tooltip>
                                                ))}
                                            </Box>
                                        ))}
                                        <Box display="flex" alignItems="center" mt={1} gap={1}>
                                            <Typography variant="caption">Menos</Typography>
                                            {[0.1, 0.3, 0.5, 0.7, 1].map(o => (
                                                <Box key={o} width={16} height={16} sx={{ backgroundColor: `rgba(25, 118, 210, ${o})`, borderRadius: 0.5 }} />
                                            ))}
                                            <Typography variant="caption">Más</Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Paper>
                        );
                    })()}

                    {/* Tabla ranking */}
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={2}>Ranking de agentes</Typography>
                        <Box sx={{ overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: { xs: 360, sm: 600 } }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Agente</TableCell>
                                    <TableCell align="right">Asignadas</TableCell>
                                    <TableCell align="right">Resueltas (%)</TableCell>
                                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Activas</TableCell>
                                    <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Avg 1ra resp.</TableCell>
                                    <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Avg resolución</TableCell>
                                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Mensajes</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {datos.agentes.length === 0 && (
                                    <TableRow><TableCell colSpan={8} align="center">Sin datos</TableCell></TableRow>
                                )}
                                {[...datos.agentes].sort((a, b) => b.asignadas - a.asignadas).map(a => (
                                    <TableRow key={a.id} hover>
                                        <TableCell>{a.nombre}</TableCell>
                                        <TableCell align="right">{a.asignadas}</TableCell>
                                        <TableCell align="right">
                                            {a.resueltas}
                                            {a.asignadas > 0 && (
                                                <Typography component="span" variant="caption" color="text.secondary" ml={0.5}>
                                                    ({Math.round(a.resueltas / a.asignadas * 100)}%)
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{a.activas}</TableCell>
                                        <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>{formatMs(a.avgPrimeraRespuestaMs)}</TableCell>
                                        <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>{formatMs(a.avgResolucionMs)}</TableCell>
                                        <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{a.mensajesEnviados}</TableCell>
                                        <TableCell>
                                            <Tooltip title="Ver detalle">
                                                <IconButton size="small" onClick={() => verDetalle(a)}>
                                                    <PersonIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </Box>
                    </Paper>
                </Box>
            )}
        </Box>
    );
}
