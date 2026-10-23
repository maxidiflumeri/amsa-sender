import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Box,
    Button,
    Drawer,
    IconButton,
    InputAdornment,
    LinearProgress,
    Link,
    MenuItem,
    Paper,
    Skeleton,
    Tab,
    TablePagination,
    Tabs,
    TextField,
    Typography,
    useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Area, AreaChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, ExternalLink, RefreshCw, Search, X } from 'lucide-react';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { descargarBlob } from '../../utils/descargar';
import { BloqueEstado, DataTableResponsive, EmptyState, PageHeader, ResponsiveDialog, StatusChip } from '../ui';
import { migasDe } from '../layout/navConfig';
import useTabUrl from '../analitica/useTabUrl';
import GrillaKpi from '../analitica/GrillaKpi';
import { useGraficos } from '../analitica/graficos';
import { aDiaLocal, fmtDiaCorto, fmtFecha, fmtHora, fmtNumero } from '../analitica/formato';

const PESTANIAS = ['resumen', 'aperturas', 'rebotes'];
const RANGOS = [
    { value: 'hoy', label: 'Hoy' },
    { value: '7d', label: 'Últimos 7 días' },
    { value: '30d', label: 'Últimos 30 días' },
];
const DETALLE_INICIAL = { pageOpen: 0, sizeOpen: 10, pageClick: 0, sizeClick: 10, pageBounce: 0, sizeBounce: 10 };
const ESPERA_BUSQUEDA_MS = 400;

// El backend recibe fechas locales sin zona ("2026-10-23T23:59:59"), como siempre.
const pad = (n) => String(n).padStart(2, '0');
function isoLocal(fecha, finDelDia = false) {
    const hms = finDelDia ? '23:59:59' : `${pad(fecha.getHours())}:${pad(fecha.getMinutes())}:${pad(fecha.getSeconds())}`;
    return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${hms}`;
}

/** Desde/hasta de un rango; el "hasta" es el final de hoy. */
function fechasDe(rango) {
    const ahora = new Date();
    const desde = new Date(ahora);
    if (rango === '7d') desde.setDate(ahora.getDate() - 7);
    else if (rango === '30d') desde.setDate(ahora.getDate() - 30);
    else desde.setHours(0, 0, 0, 0);
    return { since: isoLocal(desde), until: isoLocal(ahora, true) };
}

/** Un día "YYYY-MM-DD" completo, de 00:00:00 a 23:59:59 locales. */
function diaCompleto(dia) {
    const [y, m, d] = dia.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    return { desde: isoLocal(base).replace(/T.*/, 'T00:00:00'), hasta: isoLocal(base, true) };
}

// =====================================================
// Pedidos a la API
// =====================================================
async function pedirResumen({ since, until, query, page, size }) {
    const { data } = await api.get('/email/reportes/overview', {
        params: { since, until, q: query || undefined, includeSparkline: 'true', page, size },
    });
    return {
        total: data.total,
        items: (data.items || []).map((c) => ({
            ...c,
            sparkline: (c.sparkline || []).map((p) => ({ t: p.day, abiertos: Number(p.abiertos), clics: Number(p.clics) })),
        })),
    };
}

async function pedirDetalle(campaniaId, { since, until, ...paginas }) {
    const { data } = await api.get(`/email/reportes/campanias/${campaniaId}/engagement`, { params: { since, until, ...paginas } });
    return {
        ...data,
        aperturas: Array.isArray(data.aperturas) ? data.aperturas : [],
        clicks: Array.isArray(data.clicks) ? data.clicks : [],
        // normalización defensiva por si el backend todavía no manda el array
        rebotes: Array.isArray(data.rebotes) ? data.rebotes : [],
    };
}

// =====================================================
// Piezas
// =====================================================
/** Una métrica con su ayuda siempre a la vista (en el celular no existe el hover de un Tooltip). */
function Metrica({ etiqueta, valor, ayuda }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Box component="dt" sx={{ fontSize: 12.5, color: 'text.secondary' }}>{etiqueta}</Box>
            <Box component="dd" sx={{ m: 0, fontSize: 18, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{valor}</Box>
            {ayuda && <Box component="dd" sx={{ m: 0, fontSize: 12, color: 'text.secondary' }}>{ayuda}</Box>}
        </Box>
    );
}

function TarjetaCampania({ campania, onVerDetalle }) {
    const g = useGraficos();
    const aperturaPct = Math.round((campania.tasaApertura || 0) * 100);
    const clickPct = Math.round((campania.tasaClick || 0) * 100);
    const datos = campania.sparkline;

    return (
        <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0, width: '100%' }}>
            <Box>
                <Typography
                    component="h3"
                    title={campania.nombre}
                    sx={{ fontSize: 16, fontWeight: 650, lineHeight: 1.3, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                >
                    {campania.nombre}
                </Typography>
                <Typography variant="body2" color="text.secondary">{fmtNumero(campania.totalContactos)} contactos</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <StatusChip label={`Aperturas ${aperturaPct}%`} tono={aperturaPct >= 50 ? 'ok' : 'neutro'} />
                <StatusChip label={`Clics ${clickPct}%`} tono={clickPct >= 10 ? 'acento' : 'neutro'} />
            </Box>

            {datos.length > 1 ? (
                <Box>
                    <Box sx={{ height: 110 }} aria-hidden>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={datos} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                                <XAxis dataKey="t" hide />
                                <YAxis hide />
                                <RTooltip {...g.tooltip} labelFormatter={(l) => fmtDiaCorto(l)} formatter={(v, n) => [fmtNumero(v), n]} />
                                {/* Dos series, dos colores: aperturas en verde y clics en celeste, con relleno plano. */}
                                <Area type="monotone" dataKey="abiertos" name="Aperturas" stroke={g.success} fill={g.success} fillOpacity={0.14} strokeWidth={2} isAnimationActive={false} />
                                <Area type="monotone" dataKey="clics" name="Clics" stroke={g.info} fill={g.info} fillOpacity={0.14} strokeWidth={2} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                            <Box component="span" sx={{ width: 10, height: 3, borderRadius: 1, bgcolor: g.success }} /> Aperturas
                        </Box>
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                            <Box component="span" sx={{ width: 10, height: 3, borderRadius: 1, bgcolor: g.info }} /> Clics
                        </Box>
                    </Box>
                </Box>
            ) : (
                <Typography variant="body2" color="text.secondary">Todavía no hay suficientes días para dibujar la evolución.</Typography>
            )}

            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
                <Metrica etiqueta="Enviados" valor={fmtNumero(campania.enviados)} />
                <Metrica etiqueta="Desuscriptos" valor={fmtNumero(campania.desuscriptos)} />
                <Metrica etiqueta="Rebotes previos" valor={fmtNumero(campania.rebotesPrevios)} />
                <Metrica etiqueta="Tasa de apertura" valor={`${aperturaPct}%`} ayuda="Aperturas únicas sobre enviados" />
                <Metrica etiqueta="Tasa de clic" valor={`${clickPct}%`} ayuda="Clics únicos sobre enviados" />
            </Box>

            <Box sx={{ mt: 'auto', pt: 0.5 }}>
                <Button variant="outlined" fullWidth startIcon={<BarChart3 size={18} strokeWidth={1.75} aria-hidden />} onClick={onVerDetalle}>
                    Ver detalle
                </Button>
            </Box>
        </Paper>
    );
}

function TarjetaEsqueleto() {
    return (
        <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2, minHeight: 300 }}>
            <Skeleton width="60%" height={26} />
            <Skeleton width="30%" />
            <Skeleton variant="rounded" height={110} sx={{ my: 1.5 }} />
            <Skeleton width="45%" />
            <Skeleton width="55%" />
        </Paper>
    );
}

/** Un enlace que nunca desborda: las URL de los clics pueden ser larguísimas. */
function EnlaceExterno({ url }) {
    if (!url) return '—';
    return (
        <Link href={url} target="_blank" rel="noopener noreferrer" sx={{ overflowWrap: 'anywhere' }}>
            {url}
            <ExternalLink size={14} strokeWidth={1.75} aria-hidden style={{ marginLeft: 4, verticalAlign: '-2px' }} />
        </Link>
    );
}

const dispositivo = (e) => {
    const partes = [e.browserName, e.osName].filter(Boolean).join(' · ');
    return partes || (e.userAgent ? String(e.userAgent).slice(0, 80) : '—');
};

/** Texto largo de un rebote con "Ver más" que abre el diálogo. */
function DescripcionRebote({ fila, limite, onVerMas }) {
    const texto = fila.descripcion;
    return (
        <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{texto ?? '—'}</Box>
            {texto && texto.length > limite && (
                <Button size="small" variant="text" onClick={() => onVerMas(fila)} sx={{ px: 0, minHeight: { xs: 44, md: 28 } }}>
                    Ver más
                </Button>
            )}
        </Box>
    );
}

// =====================================================
// Detalle de una campaña (panel lateral)
// =====================================================
function PanelDetalle({ abierto, onCerrar, campania, detalle, estado, paginas, onPaginar, onReintentar, onVerRebote }) {
    const theme = useTheme();
    const celular = useMediaQuery(theme.breakpoints.down('md'));
    const [tab, setTab] = useState(0);

    useEffect(() => {
        if (abierto) setTab(0);
    }, [abierto]);

    const columnasAperturas = [
        { key: 'email', label: 'Email', primary: true },
        { key: 'timestamp', label: 'Fecha y hora', secondary: true, render: (e) => fmtFecha(e.timestamp) },
        { key: 'ip', label: 'IP', render: (e) => e.ip ?? '—' },
        { key: 'agente', label: 'Dispositivo', render: dispositivo },
    ];
    const columnasClics = [
        { key: 'email', label: 'Email', primary: true },
        { key: 'timestamp', label: 'Fecha y hora', secondary: true, render: (e) => fmtFecha(e.timestamp) },
        { key: 'url', label: 'Enlace', render: (e) => <EnlaceExterno url={e.url} /> },
        { key: 'ip', label: 'IP', render: (e) => e.ip ?? '—' },
    ];
    const columnasRebotes = [
        { key: 'email', label: 'Email', primary: true },
        { key: 'timestamp', label: 'Fecha y hora', secondary: true, render: (e) => fmtFecha(e.timestamp) },
        { key: 'codigo', label: 'Código', render: (e) => e.codigo ?? '—' },
        { key: 'descripcion', label: 'Descripción', render: (e) => <DescripcionRebote fila={e} limite={200} onVerMas={onVerRebote} /> },
    ];

    // La paginación es del servidor: cada lista trae solo su página y el total. Las filas NO se vuelven a cortar acá.
    const bloque = (rows, total, columnas, page, size, claves, vacio) => (
        <>
            <DataTableResponsive ariaLabel="Eventos de la campaña" size="small" columns={columnas} rows={rows} empty={<EmptyState compact title={vacio} />} />
            <TablePagination
                component="div"
                count={total ?? rows.length}
                page={page}
                onPageChange={(_, p) => onPaginar({ [claves.page]: p })}
                rowsPerPage={size}
                onRowsPerPageChange={(e) => onPaginar({ [claves.page]: 0, [claves.size]: parseInt(e.target.value, 10) })}
                rowsPerPageOptions={[10, 25, 50, 100]}
                labelRowsPerPage="Filas"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
        </>
    );

    return (
        <Drawer
            anchor="right"
            open={abierto}
            onClose={onCerrar}
            variant="temporary"
            sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', md: 640 }, maxWidth: '100%', height: { xs: '100dvh', md: '100%' } } }}
            ModalProps={{ keepMounted: true }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography component="h2" sx={{ fontSize: 17, fontWeight: 650 }}>Detalle de campaña</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{campania?.nombre}</Typography>
                </Box>
                <IconButton aria-label="Cerrar" onClick={onCerrar} sx={{ width: 44, height: 44 }}>
                    <X size={20} strokeWidth={1.75} aria-hidden />
                </IconButton>
            </Box>

            <Box sx={{ p: 2, overflowY: 'auto', pb: 'calc(16px + env(safe-area-inset-bottom))' }}>
                {estado === 'error' && !detalle && (
                    <BloqueEstado estado="error" mensaje="No se pudo cargar el detalle de la campaña." onReintentar={onReintentar} />
                )}
                {estado === 'cargando' && !detalle && <BloqueEstado estado="cargando" mensaje="Cargando detalle…" />}

                {detalle && (
                    <>
                        {estado === 'cargando' && <LinearProgress sx={{ mb: 1.5 }} />}
                        {estado === 'error' && (
                            <Box sx={{ mb: 1.5 }}>
                                <BloqueEstado estado="error" mensaje="No se pudo actualizar la página. Se muestra la anterior." onReintentar={onReintentar} />
                            </Box>
                        )}
                        <GrillaKpi
                            max={4}
                            items={[
                                { titulo: 'Enviados', valor: fmtNumero(detalle.resumen.enviados) },
                                { titulo: 'Aperturas únicas', valor: fmtNumero(detalle.resumen.abiertosUnicos) },
                                { titulo: 'Clics únicos', valor: fmtNumero(detalle.resumen.clicsUnicos) },
                                { titulo: 'Rebotes', valor: fmtNumero(detalle.resumen.rebotes) },
                            ]}
                        />
                        {(detalle.resumen.primeroAbierto || detalle.resumen.primeroClick) && (
                            <Box sx={{ mt: 1.5, color: 'text.secondary', fontSize: 13 }}>
                                {detalle.resumen.primeroAbierto && <div>Primera apertura: {fmtFecha(detalle.resumen.primeroAbierto)}</div>}
                                {detalle.resumen.primeroClick && <div>Primer clic: {fmtFecha(detalle.resumen.primeroClick)}</div>}
                            </Box>
                        )}

                        <Tabs
                            value={tab}
                            onChange={(_, v) => setTab(v)}
                            variant="scrollable"
                            allowScrollButtonsMobile
                            scrollButtons={celular ? 'auto' : false}
                            sx={{ mt: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 48 } }}
                        >
                            <Tab label={`Aperturas (${fmtNumero(detalle.totalAperturas ?? detalle.aperturas.length)})`} />
                            <Tab label={`Clics (${fmtNumero(detalle.totalClicks ?? detalle.clicks.length)})`} />
                            <Tab label={`Rebotes (${fmtNumero(detalle.totalRebotes ?? detalle.rebotes.length)})`} />
                        </Tabs>

                        <Box sx={{ mt: 1 }}>
                            {tab === 0 && bloque(detalle.aperturas, detalle.totalAperturas, columnasAperturas, paginas.pageOpen, paginas.sizeOpen, { page: 'pageOpen', size: 'sizeOpen' }, 'Sin aperturas registradas')}
                            {tab === 1 && bloque(detalle.clicks, detalle.totalClicks, columnasClics, paginas.pageClick, paginas.sizeClick, { page: 'pageClick', size: 'sizeClick' }, 'Sin clics registrados')}
                            {tab === 2 && bloque(detalle.rebotes, detalle.totalRebotes, columnasRebotes, paginas.pageBounce, paginas.sizeBounce, { page: 'pageBounce', size: 'sizeBounce' }, 'Sin rebotes registrados')}
                        </Box>
                    </>
                )}
            </Box>
        </Drawer>
    );
}

// =====================================================
// Pestañas "por fecha": aperturas y clics / rebotes
// =====================================================
function BarraDeFecha({ fecha, onFecha, onActualizar, onDescargar, descargando, cargando }) {
    return (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, alignItems: { sm: 'center' }, flexWrap: 'wrap' }}>
            <TextField
                type="date"
                size="small"
                label="Fecha"
                value={fecha}
                onChange={(e) => e.target.value && onFecha(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: aDiaLocal() } }}
                sx={{ minWidth: 170 }}
            />
            <Button variant="outlined" onClick={onActualizar} disabled={cargando} startIcon={<RefreshCw size={18} strokeWidth={1.75} aria-hidden />}>
                Actualizar
            </Button>
            <Button variant="outlined" onClick={onDescargar} disabled={descargando} aria-busy={descargando} startIcon={<Download size={18} strokeWidth={1.75} aria-hidden />}>
                {descargando ? 'Descargando…' : 'Descargar CSV'}
            </Button>
        </Box>
    );
}

// =====================================================
// Página
// =====================================================
export default function VerReportesEmail() {
    const theme = useTheme();
    const navigate = useNavigate();
    const feedback = useFeedback();
    const celular = useMediaQuery(theme.breakpoints.down('sm'));
    const [tab, setTab] = useTabUrl(PESTANIAS);
    const [params, setParams] = useSearchParams();

    // Lo que se ve vive en la URL: rango, fecha de las pestañas por fecha y campaña abierta.
    const rango = RANGOS.some((r) => r.value === params.get('rango')) ? params.get('rango') : 'hoy';
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(params.get('fecha') ?? '') ? params.get('fecha') : aDiaLocal();
    const detalleId = params.get('detalle');

    const ponerParam = useCallback(
        (clave, valor, opciones) =>
            setParams((previos) => {
                const sig = new URLSearchParams(previos);
                if (valor) sig.set(clave, valor);
                else sig.delete(clave);
                return sig;
            }, opciones),
        [setParams],
    );

    // ----- Resumen por campaña -----
    const [busqueda, setBusqueda] = useState('');
    const [consulta, setConsulta] = useState('');
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(12);
    const [total, setTotal] = useState(0);
    const [resumen, setResumen] = useState([]);
    const [estadoResumen, setEstadoResumen] = useState('cargando');
    const [recarga, setRecarga] = useState(0);
    const pedidoResumen = useRef(0);

    // La búsqueda se aplica sola 400 ms después de dejar de escribir (Enter la aplica enseguida).
    useEffect(() => {
        const t = setTimeout(() => {
            setConsulta(busqueda.trim());
            setPage(0);
        }, ESPERA_BUSQUEDA_MS);
        return () => clearTimeout(t);
    }, [busqueda]);

    useEffect(() => {
        const n = ++pedidoResumen.current;
        setEstadoResumen('cargando');
        pedirResumen({ ...fechasDe(rango), query: consulta, page, size })
            .then(({ total: t, items }) => {
                if (n !== pedidoResumen.current) return;
                setTotal(t);
                setResumen(items);
                setEstadoResumen('ok');
            })
            .catch(() => {
                if (n === pedidoResumen.current) setEstadoResumen('error');
            });
    }, [rango, page, size, consulta, recarga]);

    const actualizar = () => {
        setConsulta(busqueda.trim());
        setPage(0);
        setRecarga((n) => n + 1);
    };

    // ----- Detalle de una campaña -----
    const [detalle, setDetalle] = useState(null);
    const [estadoDetalle, setEstadoDetalle] = useState('cargando');
    const [paginasDetalle, setPaginasDetalle] = useState(DETALLE_INICIAL);
    const pedidoDetalle = useRef(0);

    const cargarDetalle = useCallback(
        (id, paginas) => {
            const n = ++pedidoDetalle.current;
            setEstadoDetalle('cargando');
            pedirDetalle(id, { ...fechasDe(rango), ...paginas })
                .then((d) => {
                    if (n !== pedidoDetalle.current) return;
                    setDetalle(d);
                    setEstadoDetalle('ok');
                })
                .catch(() => {
                    if (n === pedidoDetalle.current) setEstadoDetalle('error');
                });
        },
        [rango],
    );

    useEffect(() => {
        setDetalle(null);
        setPaginasDetalle(DETALLE_INICIAL);
        if (detalleId) cargarDetalle(detalleId, DETALLE_INICIAL);
    }, [detalleId, cargarDetalle]);

    const paginarDetalle = (parche) => {
        const nuevas = { ...paginasDetalle, ...parche };
        setPaginasDetalle(nuevas);
        // No se vacía el detalle: el panel conserva la página anterior con una barra de carga hasta que llega la nueva.
        cargarDetalle(detalleId, nuevas);
    };

    const abiertoAca = useRef(false);
    const abrirDetalle = (c) => {
        abiertoAca.current = true;
        ponerParam('detalle', String(c.id));
    };
    const cerrarDetalle = () => {
        // Si se abrió desde esta pantalla, "cerrar" es volver atrás (así el atrás de Android no lo reabre). Si llegó
        // por un enlace con `?detalle=`, atrás saldría de la pantalla: ahí solo se quita el parámetro.
        if (abiertoAca.current) {
            abiertoAca.current = false;
            navigate(-1);
        } else {
            ponerParam('detalle', null, { replace: true });
        }
    };
    const campaniaDetalle = detalleId ? resumen.find((c) => String(c.id) === detalleId) ?? { id: detalleId, nombre: `Campaña ${detalleId}` } : null;

    // ----- Rebote con descripción larga (compartido por el panel y la pestaña) -----
    const [reboteAbierto, setReboteAbierto] = useState(null);

    // ----- Pestañas por fecha -----
    const [eventos, setEventos] = useState([]);
    const [estadoEventos, setEstadoEventos] = useState('inicial');
    const [rebotes, setRebotes] = useState([]);
    const [estadoRebotes, setEstadoRebotes] = useState('inicial');
    const [pageEventos, setPageEventos] = useState(0);
    const [rppEventos, setRppEventos] = useState(25);
    const [pageRebotes, setPageRebotes] = useState(0);
    const [rppRebotes, setRppRebotes] = useState(25);
    const [descargando, setDescargando] = useState(false);

    const cargarEventos = useCallback(() => {
        setEstadoEventos('cargando');
        api.get('/email/reportes/events/by-date', { params: { date: fecha, limit: 500000 } })
            .then(({ data }) => {
                setEventos(data);
                setPageEventos(0);
                setEstadoEventos('ok');
            })
            .catch(() => setEstadoEventos('error'));
    }, [fecha]);

    const cargarRebotes = useCallback(() => {
        setEstadoRebotes('cargando');
        api.get('/email/reportes/rebotes/by-date', { params: { date: fecha, limit: 500000 } })
            .then(({ data }) => {
                setRebotes(data);
                setPageRebotes(0);
                setEstadoRebotes('ok');
            })
            .catch(() => setEstadoRebotes('error'));
    }, [fecha]);

    useEffect(() => {
        if (tab === 1) cargarEventos();
        if (tab === 2) cargarRebotes();
    }, [tab, cargarEventos, cargarRebotes]);

    const descargarDelDia = async (ruta, params2, prefijo) => {
        setDescargando(true);
        try {
            const res = await api.get(ruta, { params: params2, responseType: 'blob' });
            const match = /filename="?([^"]+)"?/i.exec(res.headers?.['content-disposition'] || '');
            descargarBlob(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }), match?.[1] || `${prefijo}_${fecha}.csv`);
            feedback.exito('Se descargó el CSV.');
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo descargar el CSV.'), {
                accion: { etiqueta: 'Reintentar', onClick: () => descargarDelDia(ruta, params2, prefijo) },
            });
        } finally {
            setDescargando(false);
        }
    };
    const descargarEventos = () => descargarDelDia('/email/reportes/actividades.csv', { ...diaCompleto(fecha), tipo: 'all' }, 'actividades');
    const descargarRebotes = () => descargarDelDia('/email/reportes/rebotes.csv', diaCompleto(fecha), 'rebotes');

    const eventosVisibles = useMemo(() => eventos.slice(pageEventos * rppEventos, (pageEventos + 1) * rppEventos), [eventos, pageEventos, rppEventos]);
    const rebotesVisibles = useMemo(() => rebotes.slice(pageRebotes * rppRebotes, (pageRebotes + 1) * rppRebotes), [rebotes, pageRebotes, rppRebotes]);

    const columnasEventos = [
        { key: 'email', label: 'Email', primary: true },
        { key: 'campaña', label: 'Campaña', secondary: true, render: (e) => e.campañaNombre ?? `Campaña ${e.campañaId}` },
        { key: 'hora', label: 'Hora', render: (e) => fmtHora(e.timestamp) },
        { key: 'tipo', label: 'Tipo', render: (e) => <StatusChip label={e.tipo === 'OPEN' ? 'Apertura' : 'Clic'} tono={e.tipo === 'OPEN' ? 'ok' : 'info'} /> },
        { key: 'url', label: 'Enlace', render: (e) => <EnlaceExterno url={e.url} /> },
    ];
    const columnasRebotes = [
        { key: 'email', label: 'Email', primary: true },
        { key: 'campaña', label: 'Campaña', secondary: true, render: (r) => r.campañaNombre ?? (r.campañaId ? `Campaña ${r.campañaId}` : '—') },
        { key: 'hora', label: 'Hora', render: (r) => fmtHora(r.timestamp) },
        { key: 'codigo', label: 'Código', render: (r) => r.codigo ?? '—' },
        { key: 'descripcion', label: 'Descripción', render: (r) => <DescripcionRebote fila={r} limite={120} onVerMas={setReboteAbierto} /> },
    ];

    const pagina = (cantidad, page2, rpp, onPage, onRpp) => (
        <TablePagination
            component="div"
            count={cantidad}
            page={page2}
            onPageChange={(_, p) => onPage(p)}
            rowsPerPage={rpp}
            onRowsPerPageChange={(e) => { onRpp(parseInt(e.target.value, 10)); onPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Filas por página"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
    );

    return (
        <Box>
            <PageHeader
                title="Reportes de Email"
                subtitle="Aperturas, clics y rebotes de tus campañas."
                breadcrumbs={migasDe('/email/reportes')}
            />

            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                allowScrollButtonsMobile
                scrollButtons="auto"
                aria-label="Secciones de los reportes"
                sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, '& .MuiTab-root': { minHeight: 48 } }}
            >
                <Tab label="Resumen por campaña" />
                <Tab label="Aperturas y clics por fecha" />
                <Tab label="Rebotes por fecha" />
            </Tabs>

            {tab === 0 && (
                <>
                    <Box
                        sx={{
                            display: 'grid',
                            gap: 1.5,
                            mb: 2,
                            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) 210px auto' },
                            alignItems: 'start',
                        }}
                    >
                        <TextField
                            size="small"
                            label="Buscar campaña"
                            placeholder="Nombre de la campaña"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') actualizar();
                            }}
                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={18} strokeWidth={1.75} aria-hidden /></InputAdornment> } }}
                        />
                        <TextField
                            size="small"
                            select
                            label="Período"
                            value={rango}
                            onChange={(e) => { setPage(0); ponerParam('rango', e.target.value === 'hoy' ? null : e.target.value, { replace: true }); }}
                        >
                            {RANGOS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
                        </TextField>
                        <Button variant="outlined" onClick={actualizar} disabled={estadoResumen === 'cargando'} startIcon={<RefreshCw size={18} strokeWidth={1.75} aria-hidden />} sx={{ minHeight: { xs: 44, sm: 40 } }}>
                            Actualizar
                        </Button>
                    </Box>

                    {estadoResumen === 'error' && (
                        <BloqueEstado estado="error" mensaje="No se pudieron cargar los reportes de las campañas." onReintentar={actualizar} />
                    )}

                    {estadoResumen === 'cargando' && (
                        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
                            {Array.from({ length: Math.min(size, 6) }).map((_, i) => <TarjetaEsqueleto key={i} />)}
                        </Box>
                    )}

                    {estadoResumen === 'ok' && resumen.length === 0 && (
                        <Paper variant="outlined" sx={{ borderRadius: '14px' }}>
                            <EmptyState
                                compact
                                title={consulta ? 'Ninguna campaña coincide' : 'Sin campañas en el período'}
                                description={consulta ? 'Probá con otro nombre o ampliá el período.' : 'Probá con un período más largo.'}
                            />
                        </Paper>
                    )}

                    {estadoResumen === 'ok' && resumen.length > 0 && (
                        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
                            {resumen.map((c) => (
                                <TarjetaCampania key={c.id} campania={c} onVerDetalle={() => abrirDetalle(c)} />
                            ))}
                        </Box>
                    )}

                    {estadoResumen !== 'error' && total > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <TablePagination
                                component="div"
                                count={total}
                                page={page}
                                onPageChange={(_, p) => setPage(p)}
                                rowsPerPage={size}
                                onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }}
                                rowsPerPageOptions={[6, 12, 24, 48]}
                                labelRowsPerPage={celular ? 'Por página' : 'Tarjetas por página'}
                                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                            />
                        </Box>
                    )}
                </>
            )}

            {tab === 1 && (
                <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
                    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 650 }}>Eventos del {fecha.split('-').reverse().join('/')}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Aperturas y clics de todas las campañas, en ese día.</Typography>
                        <BarraDeFecha
                            fecha={fecha}
                            onFecha={(v) => ponerParam('fecha', v === aDiaLocal() ? null : v, { replace: true })}
                            onActualizar={cargarEventos}
                            onDescargar={descargarEventos}
                            descargando={descargando}
                            cargando={estadoEventos === 'cargando'}
                        />
                    </Box>
                    {estadoEventos === 'error' ? (
                        <Box sx={{ p: 2 }}><BloqueEstado estado="error" mensaje="No se pudieron cargar los eventos." onReintentar={cargarEventos} /></Box>
                    ) : (
                        <>
                            <DataTableResponsive
                                ariaLabel="Aperturas y clics del día"
                                columns={columnasEventos}
                                rows={eventosVisibles}
                                loading={estadoEventos === 'cargando' || estadoEventos === 'inicial'}
                                empty={<EmptyState compact title="Sin eventos en esa fecha" />}
                            />
                            {pagina(eventos.length, pageEventos, rppEventos, setPageEventos, setRppEventos)}
                        </>
                    )}
                </Paper>
            )}

            {tab === 2 && (
                <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
                    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 650 }}>Rebotes del {fecha.split('-').reverse().join('/')}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Rebotes de todas las campañas, en ese día.</Typography>
                        <BarraDeFecha
                            fecha={fecha}
                            onFecha={(v) => ponerParam('fecha', v === aDiaLocal() ? null : v, { replace: true })}
                            onActualizar={cargarRebotes}
                            onDescargar={descargarRebotes}
                            descargando={descargando}
                            cargando={estadoRebotes === 'cargando'}
                        />
                    </Box>
                    {estadoRebotes === 'error' ? (
                        <Box sx={{ p: 2 }}><BloqueEstado estado="error" mensaje="No se pudieron cargar los rebotes." onReintentar={cargarRebotes} /></Box>
                    ) : (
                        <>
                            <DataTableResponsive
                                ariaLabel="Rebotes del día"
                                columns={columnasRebotes}
                                rows={rebotesVisibles}
                                loading={estadoRebotes === 'cargando' || estadoRebotes === 'inicial'}
                                empty={<EmptyState compact title="Sin rebotes en esa fecha" />}
                            />
                            {pagina(rebotes.length, pageRebotes, rppRebotes, setPageRebotes, setRppRebotes)}
                        </>
                    )}
                </Paper>
            )}

            <PanelDetalle
                abierto={!!detalleId}
                onCerrar={cerrarDetalle}
                campania={campaniaDetalle}
                detalle={detalle}
                estado={estadoDetalle}
                paginas={paginasDetalle}
                onPaginar={paginarDetalle}
                onReintentar={() => cargarDetalle(detalleId, paginasDetalle)}
                onVerRebote={setReboteAbierto}
            />

            <ResponsiveDialog open={!!reboteAbierto} onClose={() => setReboteAbierto(null)} title="Descripción del rebote" cerrarConFondo maxWidth="md">
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{reboteAbierto?.email ?? ''}</Typography>
                <Box sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'monospace', fontSize: 13.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                    {reboteAbierto?.descripcion ?? '—'}
                </Box>
            </ResponsiveDialog>
        </Box>
    );
}
