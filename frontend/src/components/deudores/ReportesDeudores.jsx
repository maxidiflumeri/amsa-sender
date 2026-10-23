import { useCallback, useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, Button, CircularProgress, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem, Paper, TextField } from '@mui/material';
import { BarChart3, ChevronDown, Download, FileSpreadsheet, FileText, SearchX } from 'lucide-react';
import api from '../../api/axios';
import { useFeedback } from '../../context/FeedbackContext';
import { descargarBlob } from '../../utils/descargar';
import { migasDe } from '../layout/navConfig';
import { BloqueEstado, DataTableResponsive, EmptyState, KpiTile, PageContainer, PageHeader } from '../ui';
import { CanalChip, finDelDia, inicioDelDia, nombreDeEmpresa, PanelFiltros, Paginacion, useCatalogosDeudores } from './comunes';

const porcentaje = (v) => `${((v ?? 0) * 100).toFixed(2).replace('.', ',')}%`;
const numero = (v) => (v ?? 0).toLocaleString('es-AR');

// Parámetros de fecha y listas que entienden los tres endpoints (tabla, reporte exportado y actividades).
function paramsDe(f) {
    const p = {};
    if (f.empresas.length) p.empresas = f.empresas.map((e) => e.id).join(',');
    if (f.remesas.length) p.remesas = f.remesas.join(',');
    if (f.desde) p.desde = inicioDelDia(f.desde);
    if (f.hasta) p.hasta = finDelDia(f.hasta);
    return p;
}

export default function ReportesDeudores() {
    const feedback = useFeedback();

    // Lo que hay en el formulario
    const [empresasInput, setEmpresasInput] = useState([]);
    const [remesasInput, setRemesasInput] = useState([]);
    const [desdeInput, setDesdeInput] = useState('');
    const [hastaInput, setHastaInput] = useState('');
    const [canalInput, setCanalInput] = useState('');

    // Los filtros aplicados: los que usan la tabla y las exportaciones (antes la exportación leía los inputs).
    const [aplicados, setAplicados] = useState(null);

    const [reportes, setReportes] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [anchorExport, setAnchorExport] = useState(null);
    const [exportando, setExportando] = useState(false);

    const depurarRemesas = useCallback((lista) => {
        setRemesasInput((prev) => (prev.every((r) => lista.includes(r)) ? prev : prev.filter((r) => lista.includes(r))));
    }, []);
    const catalogos = useCatalogosDeudores(empresasInput, depurarRemesas);
    const { empresas, remesas, empresasMap } = catalogos;

    const hayInputs = Boolean(empresasInput.length || desdeInput || hastaInput);
    const filtrosActivos = (remesasInput.length ? 1 : 0) + (desdeInput ? 1 : 0) + (hastaInput ? 1 : 0) + (canalInput ? 1 : 0);

    const cargarReportes = useCallback(async () => {
        if (!aplicados) return;
        setLoading(true);
        setError(null);
        try {
            // El reporte por empresa no filtra por canal (el endpoint no lo acepta): el canal solo vale para el
            // detalle de actividades, que sí lo recibe.
            const res = await api.get('/deudores/reportes/empresas', { params: { page, size: rowsPerPage, ...paramsDe(aplicados) } });
            setReportes(res.data.data || []);
            setTotal(res.data.total || 0);
        } catch (err) {
            setReportes([]);
            setTotal(0);
            setError('No se pudieron cargar los reportes. Probá de nuevo.');
        } finally {
            setLoading(false);
        }
    }, [aplicados, page, rowsPerPage]);

    useEffect(() => {
        cargarReportes();
    }, [cargarReportes]);

    // El backend no devuelve totales generales, solo la página: se suman las filas que se ven y se rotula así.
    const kpis = useMemo(() => {
        let deudores = 0, envios = 0, abiertos = 0, entEmail = 0, leidos = 0, entWapi = 0;
        for (const r of reportes) {
            deudores += r.totalDeudores;
            envios += r.envios.whatsapp + r.envios.email + r.envios.wapi;
            abiertos += r.email.abiertos;
            entEmail += r.email.entregados;
            leidos += r.wapi.leidos;
            entWapi += r.wapi.entregados;
        }
        return { deudores, envios, aperturaEmail: entEmail > 0 ? abiertos / entEmail : 0, lecturaWapi: entWapi > 0 ? leidos / entWapi : 0 };
    }, [reportes]);

    const handleBuscar = () => {
        if (!hayInputs) return;
        setAplicados({ empresas: empresasInput, remesas: remesasInput, desde: desdeInput, hasta: hastaInput, canal: canalInput });
        setPage(0);
    };

    const handleLimpiar = () => {
        setEmpresasInput([]);
        setRemesasInput([]);
        setDesdeInput('');
        setHastaInput('');
        setCanalInput('');
        setAplicados(null);
        setReportes([]);
        setTotal(0);
        setPage(0);
        setError(null);
    };

    // Exporta con los filtros APLICADOS, así el archivo es el de la tabla que se está viendo.
    const exportar = async (que, formato) => {
        setAnchorExport(null);
        if (!aplicados || exportando) return;
        const actividades = que === 'actividades';
        const nombre = actividades ? 'actividades' : 'reporte';
        setExportando(true);
        feedback.info(`Preparando ${actividades ? 'las actividades' : 'el reporte'} en ${formato.toUpperCase()}…`);
        try {
            const params = { formato, ...paramsDe(aplicados) };
            if (!actividades) params.tipo = 'empresa';
            if (actividades && aplicados.canal) params.canal = aplicados.canal;
            const url = actividades ? '/deudores/reportes/exportar-detalle' : '/deudores/reportes/exportar';
            const response = await api.get(url, { params, responseType: 'blob' });
            const match = (response.headers['content-disposition'] || '').match(/filename="?([^";]+)"?/);
            const hoy = new Date().toISOString().slice(0, 10);
            descargarBlob(new Blob([response.data]), match ? match[1] : `${nombre}_${hoy}.${formato}`);
            feedback.exito(`${actividades ? 'Actividades' : 'Reporte'} exportado.`);
        } catch {
            feedback.error(`No se pudo exportar ${actividades ? 'las actividades' : 'el reporte'}.`, {
                accion: { etiqueta: 'Reintentar', onClick: () => exportar(que, formato) },
            });
        } finally {
            setExportando(false);
        }
    };

    const celdaCentro = { align: 'center' };
    const columnas = [
        { key: 'empresa', label: 'Empresa', primary: true, render: (r) => nombreDeEmpresa(empresasMap, r.empresa) },
        { key: 'totalDeudores', label: 'Deudores', ...celdaCentro, render: (r) => numero(r.totalDeudores) },
        {
            key: 'contactos',
            label: 'Contactos',
            ...celdaCentro,
            render: (r) => (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: { md: 'center' } }}>
                    <CanalChip canal="wapi" cantidad={r.contactosPorCanal.wapi} />
                    <CanalChip canal="whatsapp" cantidad={r.contactosPorCanal.whatsapp} />
                    <CanalChip canal="email" cantidad={r.contactosPorCanal.email} />
                </Box>
            ),
        },
        {
            key: 'envios',
            label: 'Envíos',
            ...celdaCentro,
            render: (r) => (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: { md: 'center' } }}>
                    <CanalChip canal="wapi" cantidad={r.envios.wapi} />
                    <CanalChip canal="whatsapp" cantidad={r.envios.whatsapp} />
                    <CanalChip canal="email" cantidad={r.envios.email} />
                </Box>
            ),
        },
        { key: 'emailEntregados', label: 'Email: entregados', ...celdaCentro, hideBelow: 'xl', hideInCard: true, render: (r) => numero(r.email.entregados) },
        { key: 'emailAbiertos', label: 'Email: abiertos', ...celdaCentro, hideBelow: 'xl', hideInCard: true, render: (r) => numero(r.email.abiertos) },
        { key: 'emailClicks', label: 'Email: clicks', ...celdaCentro, hideBelow: 'xl', hideInCard: true, render: (r) => numero(r.email.clicks) },
        { key: 'emailRebotes', label: 'Email: rebotes', ...celdaCentro, hideBelow: 'xl', hideInCard: true, render: (r) => numero(r.email.rebotes) },
        { key: 'emailApertura', label: 'Email: % apertura', ...celdaCentro, render: (r) => porcentaje(r.email.tasaApertura) },
        { key: 'emailClick', label: 'Email: % click', ...celdaCentro, render: (r) => porcentaje(r.email.tasaClick) },
        { key: 'wapiEntregados', label: 'WAPI: entregados', ...celdaCentro, hideBelow: 'xl', hideInCard: true, render: (r) => numero(r.wapi.entregados) },
        { key: 'wapiLeidos', label: 'WAPI: leídos', ...celdaCentro, hideBelow: 'xl', hideInCard: true, render: (r) => numero(r.wapi.leidos) },
        { key: 'wapiFallidos', label: 'WAPI: fallidos', ...celdaCentro, hideBelow: 'xl', hideInCard: true, render: (r) => numero(r.wapi.fallidos) },
        { key: 'wapiEntrega', label: 'WAPI: % entrega', ...celdaCentro, render: (r) => porcentaje(r.wapi.tasaEntrega) },
        { key: 'wapiLectura', label: 'WAPI: % lectura', ...celdaCentro, render: (r) => porcentaje(r.wapi.tasaLectura) },
    ];

    const vacio = !aplicados ? (
        <EmptyState
            icon={BarChart3}
            title="Armá un reporte"
            description="Elegí una empresa o un rango de fechas y tocá Buscar para ver el desempeño de los envíos."
        />
    ) : (
        <EmptyState icon={SearchX} compact title="Sin datos para estos filtros" description="No hay envíos en el período elegido." />
    );

    const itemMenu = (que, formato, Icono, texto) => (
        <MenuItem onClick={() => exportar(que, formato)} sx={{ minHeight: 44 }}>
            <ListItemIcon><Icono size={18} strokeWidth={1.75} aria-hidden /></ListItemIcon>
            <ListItemText>{texto}</ListItemText>
        </MenuItem>
    );

    return (
        <PageContainer>
            <PageHeader
                title="Reportes de deudores"
                breadcrumbs={migasDe('/deudores/reportes')}
                actions={
                    <>
                        <Button
                            variant="outlined"
                            color="inherit"
                            disabled={!aplicados || loading || exportando}
                            onClick={(e) => setAnchorExport(e.currentTarget)}
                            aria-haspopup="menu"
                            startIcon={exportando ? <CircularProgress size={16} color="inherit" /> : <Download size={18} strokeWidth={1.75} aria-hidden />}
                            endIcon={<ChevronDown size={16} strokeWidth={1.75} aria-hidden />}
                        >
                            Exportar
                        </Button>
                        <Menu anchorEl={anchorExport} open={Boolean(anchorExport)} onClose={() => setAnchorExport(null)}>
                            <ListSubheader sx={{ lineHeight: '32px' }}>Reporte por empresa</ListSubheader>
                            {itemMenu('reporte', 'csv', FileText, 'CSV')}
                            {itemMenu('reporte', 'xlsx', FileSpreadsheet, 'Excel (XLSX)')}
                            <ListSubheader sx={{ lineHeight: '32px' }}>Actividades (una fila por actividad)</ListSubheader>
                            {itemMenu('actividades', 'csv', FileText, 'CSV')}
                            {itemMenu('actividades', 'xlsx', FileSpreadsheet, 'Excel (XLSX)')}
                        </Menu>
                    </>
                }
            />

            {catalogos.error && <BloqueEstado estado="error" mensaje={catalogos.error} onReintentar={catalogos.reintentar} />}

            <PanelFiltros
                activos={filtrosActivos}
                onBuscar={handleBuscar}
                onLimpiar={handleLimpiar}
                buscando={loading}
                puedeBuscar={hayInputs}
                principal={
                    <Autocomplete
                        multiple
                        fullWidth
                        size="small"
                        options={empresas}
                        value={empresasInput}
                        onChange={(_, v) => {
                            setEmpresasInput(v);
                            if (v.length === 0) setRemesasInput([]);
                        }}
                        filterSelectedOptions
                        disableCloseOnSelect
                        limitTags={2}
                        getOptionLabel={(o) => (typeof o === 'string' ? o : o?.nombre ?? '')}
                        isOptionEqualToValue={(o, v) => o?.id === v?.id}
                        renderInput={(params) => <TextField {...params} label="Empresas" placeholder={empresasInput.length === 0 ? 'Todas' : ''} />}
                        noOptionsText="Sin coincidencias"
                        sx={{ gridColumn: { md: 'span 2' } }}
                    />
                }
                secundarios={
                    <>
                        <Autocomplete
                            multiple
                            fullWidth
                            size="small"
                            disabled={empresasInput.length === 0}
                            options={remesas}
                            value={remesasInput}
                            onChange={(_, v) => setRemesasInput(v)}
                            filterSelectedOptions
                            disableCloseOnSelect
                            limitTags={2}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Remesas"
                                    placeholder={empresasInput.length === 0 ? 'Elegí una empresa' : remesasInput.length === 0 ? 'Todas' : ''}
                                />
                            )}
                            noOptionsText="Sin coincidencias"
                        />
                        <TextField size="small" type="date" label="Desde" value={desdeInput} onChange={(e) => setDesdeInput(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                        <TextField size="small" type="date" label="Hasta" value={hastaInput} onChange={(e) => setHastaInput(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                        <TextField
                            select
                            size="small"
                            label="Canal"
                            value={canalInput}
                            onChange={(e) => setCanalInput(e.target.value)}
                            helperText="Solo para la exportación de actividades"
                        >
                            <MenuItem value="">Todos</MenuItem>
                            <MenuItem value="wapi">WhatsApp API</MenuItem>
                            <MenuItem value="whatsapp">WhatsApp Web</MenuItem>
                            <MenuItem value="email">Email</MenuItem>
                        </TextField>
                    </>
                }
            />

            {aplicados && !error && (
                <Box sx={{ display: 'grid', gap: 1.5, mb: 2.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
                    <KpiTile titulo="Deudores" valor={numero(kpis.deudores)} leyenda="en esta página" cargando={loading} />
                    <KpiTile titulo="Envíos" valor={numero(kpis.envios)} leyenda="en esta página" cargando={loading} />
                    <KpiTile titulo="Apertura de email" valor={porcentaje(kpis.aperturaEmail)} leyenda="en esta página" cargando={loading} />
                    <KpiTile titulo="Lectura WAPI" valor={porcentaje(kpis.lecturaWapi)} leyenda="en esta página" cargando={loading} />
                </Box>
            )}

            {error ? (
                <BloqueEstado estado="error" mensaje={error} onReintentar={cargarReportes} />
            ) : (
                <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
                    <DataTableResponsive
                        ariaLabel="Reporte por empresa"
                        columns={columnas}
                        rows={reportes}
                        rowKey={(r) => r.empresa}
                        loading={loading}
                        empty={vacio}
                    />
                    {aplicados && total > 0 && (
                        <Paginacion
                            total={total}
                            page={page}
                            rowsPerPage={rowsPerPage}
                            onPage={setPage}
                            onRowsPerPage={(n) => { setRowsPerPage(n); setPage(0); }}
                        />
                    )}
                </Paper>
            )}
        </PageContainer>
    );
}
