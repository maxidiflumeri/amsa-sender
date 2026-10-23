import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Button, InputAdornment, Tab, TablePagination, Tabs, TextField } from '@mui/material';
import { BarChart3, Download, History, Search, MessageSquareText } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { BloqueEstado, DataTableResponsive, EmptyState, PageHeader, ResponsiveDialog, SectionCard, StatusChip, WaBurbuja, formatoWhatsApp } from './ui';
import { migasDe } from './layout/navConfig';
import { SelectorCampaniaWeb, useCampaniaElegida, useCampaniasWeb } from './analitica/campaniasWeb';
import useTabUrl from './analitica/useTabUrl';
import { fmtFecha } from './analitica/formato';
import { descargarCsv } from '../utils/descargar';

const PESTANIAS = ['reportes', 'mensajes'];

const ESTADOS_ENVIO = {
    enviado: { label: 'Enviado', tono: 'ok' },
    fallido: { label: 'Fallido', tono: 'error' },
    pendiente: { label: 'Pendiente', tono: 'neutro' },
};

function ChipEnvio({ estado }) {
    const e = ESTADOS_ENVIO[estado] ?? { label: estado ?? '—', tono: 'neutro' };
    return <StatusChip label={e.label} tono={e.tono} />;
}

export default function VerReportes() {
    const { hasPermiso } = useAuth();
    const { campanias, estado: estadoLista, recargar } = useCampaniasWeb();
    const { campania, campaniaId, elegir } = useCampaniaElegida(campanias);
    const [tab, setTab] = useTabUrl(PESTANIAS);
    const [params, setParams] = useSearchParams();
    const busqueda = params.get('q') ?? '';

    const [reportes, setReportes] = useState([]);
    const [mensajes, setMensajes] = useState([]);
    const [estadoReportes, setEstadoReportes] = useState('inicial');
    const [estadoMensajes, setEstadoMensajes] = useState('inicial');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // La conversación con un número, en un diálogo.
    const [conv, setConv] = useState({ abierta: false, numero: null, mensajes: [], estado: 'cargando' });

    const cargarReportes = useCallback((id) => {
        setEstadoReportes('cargando');
        return api.get(`/whatsapp/reportes?campañaId=${id}`)
            .then((res) => {
                setReportes(res.data);
                setEstadoReportes('ok');
            })
            .catch(() => setEstadoReportes('error'));
    }, []);

    const cargarMensajes = useCallback((id) => {
        setEstadoMensajes('cargando');
        return api.get(`/whatsapp/mensajes?campañaId=${id}`)
            .then((res) => {
                setMensajes(res.data);
                setEstadoMensajes('ok');
            })
            .catch(() => setEstadoMensajes('error'));
    }, []);

    useEffect(() => {
        setPage(0);
        if (!campania?.id) {
            setReportes([]);
            setMensajes([]);
            setEstadoReportes('inicial');
            setEstadoMensajes('inicial');
            return;
        }
        cargarReportes(campania.id);
        cargarMensajes(campania.id);
    }, [campania?.id, cargarReportes, cargarMensajes]);

    const cambiarBusqueda = (valor) => {
        setPage(0);
        setParams((previos) => {
            const sig = new URLSearchParams(previos);
            if (valor) sig.set('q', valor);
            else sig.delete('q');
            return sig;
        }, { replace: true });
    };

    const cambiarTab = (v) => {
        setPage(0);
        setTab(v);
    };

    const abrirConversacion = async (numero) => {
        setConv({ abierta: true, numero, mensajes: [], estado: 'cargando' });
        try {
            const res = await api.get('/whatsapp/mensajes/por-campania', { params: { campaniaId: campania.id, numero } });
            setConv({ abierta: true, numero, mensajes: res.data, estado: 'ok' });
        } catch {
            setConv({ abierta: true, numero, mensajes: [], estado: 'error' });
        }
    };

    const enReportes = tab === 0;
    const fuente = enReportes ? reportes : mensajes;
    const estadoActual = enReportes ? estadoReportes : estadoMensajes;

    const filtrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return q ? fuente.filter((item) => String(item.numero ?? '').toLowerCase().includes(q)) : fuente;
    }, [fuente, busqueda]);
    const visibles = filtrados.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((r, i) => ({ ...r, _k: `${page}-${i}` }));

    const exportarReportes = () => {
        // Las columnas de "datos" son las que traía cada fila del Excel original: se juntan todas las claves.
        const claves = [...new Set(reportes.flatMap((r) => (r.datos ? Object.keys(r.datos) : [])))];
        descargarCsv(
            `reporte_campaña_${campania?.id}_${campania?.nombre ?? ''}`,
            [
                { key: 'numero', label: 'Número' },
                { key: 'mensaje', label: 'Mensaje' },
                { key: 'estado', label: 'Estado' },
                { key: 'campania', label: 'Campaña', valor: (r) => r.campaña?.nombre ?? '' },
                { key: 'aniEnvio', label: 'Línea móvil de origen' },
                { key: 'enviadoAt', label: 'Fecha de envío', valor: (r) => (r.enviadoAt ? fmtFecha(r.enviadoAt) : '') },
                ...claves.map((k) => ({ key: `datos.${k}`, label: k, valor: (r) => r.datos?.[k] ?? '' })),
            ],
            reportes,
        );
    };

    const exportarMensajes = () => {
        descargarCsv(
            `mensajes_campaña_${campania?.id}_${campania?.nombre ?? ''}`,
            [
                { key: 'tipo', label: 'Tipo', valor: (m) => (m.fromMe ? 'Enviado' : 'Recibido') },
                { key: 'numero', label: 'Número' },
                { key: 'mensaje', label: 'Mensaje' },
                { key: 'fecha', label: 'Fecha', valor: (m) => fmtFecha(m.fecha) },
            ],
            mensajes,
        );
    };

    const datosDe = (r) => (r.datos ? (
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, px: 1.5, py: 1, fontSize: 13, fontFamily: 'monospace', maxHeight: 120, overflowY: 'auto' }}>
            {Object.entries(r.datos).map(([clave, val]) => (
                <div key={clave}><strong>{clave}:</strong> {String(val)}</div>
            ))}
        </Box>
    ) : '—');

    const columnasReportes = [
        { key: 'numero', label: 'Número', primary: true },
        { key: 'estado', label: 'Estado', secondary: true, render: (r) => <ChipEnvio estado={r.estado} /> },
        { key: 'mensaje', label: 'Mensaje', render: (r) => r.mensaje || '—' },
        { key: 'enviadoAt', label: 'Fecha', render: (r) => (r.enviadoAt ? fmtFecha(r.enviadoAt) : '—') },
        { key: 'datos', label: 'Datos', render: datosDe },
    ];

    const columnasMensajes = [
        { key: 'numero', label: 'Número', primary: true },
        { key: 'tipo', label: 'Tipo', secondary: true, render: (m) => <StatusChip label={m.fromMe ? 'Enviado' : 'Recibido'} tono={m.fromMe ? 'acento' : 'info'} /> },
        { key: 'mensaje', label: 'Mensaje', render: (m) => m.mensaje || '—' },
        { key: 'fecha', label: 'Fecha', render: (m) => fmtFecha(m.fecha) },
    ];

    const sinCampania = !campania;
    const vinculo = campaniaId ? `?campania=${campaniaId}` : '';

    return (
        <Box>
            <PageHeader
                title="Reportes de WhatsApp Web"
                subtitle="Qué se envió en cada campaña y cómo respondió la gente."
                breadcrumbs={migasDe('/reportes')}
                actions={
                    <>
                        {hasPermiso('whatsapp.metricas') && (
                            <Button component={RouterLink} to={`/metricas${vinculo}`} variant="outlined" startIcon={<BarChart3 size={18} strokeWidth={1.75} aria-hidden />}>
                                Ver métricas
                            </Button>
                        )}
                        <Button
                            variant="contained"
                            startIcon={<Download size={18} strokeWidth={1.75} aria-hidden />}
                            onClick={enReportes ? exportarReportes : exportarMensajes}
                            // Cada pestaña se exporta según SUS datos (antes "Mensajes" se habilitaba con `reportes.length`).
                            disabled={sinCampania || fuente.length === 0}
                        >
                            {enReportes ? 'Exportar reporte a CSV' : 'Exportar mensajes a CSV'}
                        </Button>
                    </>
                }
            />

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 2 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <SelectorCampaniaWeb campanias={campanias} estado={estadoLista} onReintentar={recargar} value={campania} onChange={elegir} />
                </Box>
                <TextField
                    label="Buscar número"
                    value={busqueda}
                    onChange={(e) => cambiarBusqueda(e.target.value)}
                    disabled={sinCampania}
                    slotProps={{
                        input: { startAdornment: <InputAdornment position="start"><Search size={18} strokeWidth={1.75} aria-hidden /></InputAdornment> },
                    }}
                    sx={{ width: { xs: '100%', md: 280 } }}
                />
            </Box>

            {sinCampania ? (
                estadoLista !== 'error' && (
                    <SectionCard>
                        <EmptyState
                            compact
                            icon={MessageSquareText}
                            title="Elegí una campaña"
                            description="Buscala arriba para ver sus envíos y los mensajes que se intercambiaron."
                        />
                    </SectionCard>
                )
            ) : (
                <SectionCard noPadding>
                    <Tabs value={tab} onChange={(_, v) => cambiarTab(v)} aria-label="Secciones del reporte" sx={{ px: { xs: 1, sm: 2 }, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 48 } }}>
                        <Tab label={`Envíos (${reportes.length})`} />
                        <Tab label={`Mensajes (${mensajes.length})`} />
                    </Tabs>
                    {estadoActual === 'error' ? (
                        <Box sx={{ p: 2 }}>
                            <BloqueEstado
                                estado="error"
                                mensaje={enReportes ? 'No se pudieron cargar los envíos.' : 'No se pudieron cargar los mensajes.'}
                                onReintentar={() => (enReportes ? cargarReportes(campania.id) : cargarMensajes(campania.id))}
                            />
                        </Box>
                    ) : (
                        <DataTableResponsive
                            ariaLabel={enReportes ? 'Envíos de la campaña' : 'Mensajes de la campaña'}
                            columns={enReportes ? columnasReportes : columnasMensajes}
                            rows={visibles}
                            rowKey={(r) => r._k}
                            loading={estadoActual === 'cargando'}
                            skeletonRows={Math.min(rowsPerPage, 6)}
                            acciones={enReportes ? (r) => (
                                <Button size="small" startIcon={<History size={16} strokeWidth={1.75} aria-hidden />} onClick={() => abrirConversacion(r.numero)}>
                                    Ver conversación
                                </Button>
                            ) : undefined}
                            empty={<EmptyState compact title={busqueda ? 'Sin coincidencias' : 'Sin datos'} description={busqueda ? 'Ningún número coincide con la búsqueda.' : 'Esta campaña todavía no tiene registros acá.'} />}
                        />
                    )}
                    <TablePagination
                        component="div"
                        count={filtrados.length}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                        rowsPerPageOptions={[5, 10, 25, 50, 100]}
                        labelRowsPerPage="Filas por página"
                        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                    />
                </SectionCard>
            )}

            <ResponsiveDialog
                open={conv.abierta}
                onClose={() => setConv((c) => ({ ...c, abierta: false }))}
                title={`Conversación con ${conv.numero ?? ''}`}
                cerrarConFondo
                maxWidth="sm"
                contentSx={{ bgcolor: 'whatsapp.fondo' }}
            >
                {conv.estado === 'cargando' && <BloqueEstado estado="cargando" mensaje="Cargando la conversación…" />}
                {conv.estado === 'error' && (
                    <BloqueEstado estado="error" mensaje="No se pudo cargar la conversación." onReintentar={() => abrirConversacion(conv.numero)} />
                )}
                {conv.estado === 'ok' && conv.mensajes.length === 0 && <EmptyState compact title="Sin mensajes" description="No hay mensajes con este número en la campaña." />}
                {conv.estado === 'ok' && conv.mensajes.length > 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {conv.mensajes.map((m, i) => (
                            <WaBurbuja key={i} direccion={m.fromMe ? 'saliente' : 'entrante'} hora={fmtFecha(m.fecha)}>
                                {formatoWhatsApp(m.mensaje)}
                            </WaBurbuja>
                        ))}
                    </Box>
                )}
            </ResponsiveDialog>
        </Box>
    );
}
