import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Container,
    Paper,
    Typography,
    TextField,
    Select,
    MenuItem,
    Button,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TablePagination,
    Chip,
    Skeleton,
    Alert,
    useTheme,
    Grid,
    FormControl,
    InputLabel,
    Card,
    CardContent,
    Menu,
    ListItemIcon,
    ListItemText,
    CircularProgress,
    Autocomplete,
    LinearProgress,
    Fade,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import ApiIcon from '@mui/icons-material/Api';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import SendIcon from '@mui/icons-material/Send';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import TableChartIcon from '@mui/icons-material/TableChart';
import SearchIcon from '@mui/icons-material/Search';
import api from '../../api/axios';

const SkeletonRow = ({ columns }) => (
    <TableRow>
        {Array(columns).fill(0).map((_, i) => (
            <TableCell key={i}>
                <Skeleton variant="text" width={i === 0 ? 150 : 80} />
            </TableCell>
        ))}
    </TableRow>
);

const KpiCard = ({ title, value, icon: Icon, color, loading }) => {
    const theme = useTheme();
    return (
        <Card sx={{ height: '100%', bgcolor: theme.palette.background.paper }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                            {title}
                        </Typography>
                        {loading ? (
                            <Skeleton variant="text" width={100} height={32} />
                        ) : (
                            <Typography variant="h5" color={color || 'text.primary'}>
                                {value}
                            </Typography>
                        )}
                    </Box>
                    <Icon sx={{ fontSize: 40, color: color || theme.palette.text.secondary, opacity: 0.6 }} />
                </Box>
            </CardContent>
        </Card>
    );
};

const formatPercentage = (value) => {
    return `${(value * 100).toFixed(2)}%`;
};

export default function ReportesDeudores() {
    const theme = useTheme();

    // Inputs del formulario
    const [empresasInput, setEmpresasInput] = useState([]);
    const [desdeInput, setDesdeInput] = useState('');
    const [hastaInput, setHastaInput] = useState('');
    const [canalInput, setCanalInput] = useState('');
    const [remesasInput, setRemesasInput] = useState([]);

    // Filtros aplicados (los que realmente se usan)
    const [appliedFilters, setAppliedFilters] = useState(null);

    // Data
    const [reportes, setReportes] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    const [loading, setLoading] = useState(false);
    const [empresas, setEmpresas] = useState([]);
    const [remesasList, setRemesasList] = useState([]);
    const [error, setError] = useState(null);

    const empresasMap = useMemo(() => {
        const map = new Map();
        for (const e of empresas) {
            if (e && typeof e === 'object' && 'id' in e) map.set(e.id, e.nombre);
        }
        return map;
    }, [empresas]);
    const getEmpresaLabel = (id) => empresasMap.get(id) ?? id ?? '-';

    // Export states
    const [exportando, setExportando] = useState(false);
    const [anchorExport, setAnchorExport] = useState(null);

    const [exportandoActividades, setExportandoActividades] = useState(false);
    const [anchorExportActividades, setAnchorExportActividades] = useState(null);

    // KPIs calculados de la página actual
    const [kpis, setKpis] = useState({
        totalDeudores: 0,
        totalEnvios: 0,
        tasaAperturaEmail: 0,
        tasaLecturaWapi: 0,
    });

    // Cargar empresas al montar
    useEffect(() => {
        const cargarEmpresas = async () => {
            try {
                const res = await api.get('/deudores/empresas');
                setEmpresas(res.data || []);
            } catch (err) {
                console.error('Error al cargar empresas:', err);
            }
        };
        cargarEmpresas();
    }, []);

    // Cargar remesas al cambiar empresas del formulario
    // Nota: sólo se consulta si hay al menos una empresa seleccionada.
    useEffect(() => {
        if (empresasInput.length === 0) {
            setRemesasList([]);
            setRemesasInput([]);
            return;
        }
        const cargarRemesas = async () => {
            try {
                const params = { empresas: empresasInput.map((e) => e.id).join(',') };
                const res = await api.get('/deudores/remesas', { params });
                setRemesasList(res.data || []);
            } catch (err) {
                console.error('Error al cargar remesas:', err);
            }
        };
        cargarRemesas();
    }, [empresasInput]);

    // Depura remesas seleccionadas si no están en la lista nueva
    useEffect(() => {
        if (remesasInput.length === 0) return;
        const filtradas = remesasInput.filter((r) => remesasList.includes(r));
        if (filtradas.length !== remesasInput.length) {
            setRemesasInput(filtradas);
        }
    }, [remesasList, remesasInput]);

    // Validación mínima para habilitar la búsqueda
    const hasMinInputs = Boolean(empresasInput.length > 0 || desdeInput || hastaInput);

    const cargarReportes = useCallback(async () => {
        if (!appliedFilters) return;

        setLoading(true);
        setError(null);

        try {
            const endpoint = '/deudores/reportes/empresas';
            const params = {
                page,
                size: rowsPerPage,
            };
            if (appliedFilters.empresas && appliedFilters.empresas.length > 0) {
                params.empresas = appliedFilters.empresas.map((e) => e.id).join(',');
            }
            if (appliedFilters.desde) {
                const d = new Date(appliedFilters.desde);
                d.setHours(0, 0, 0, 0);
                params.desde = d.toISOString();
            }
            if (appliedFilters.hasta) {
                const h = new Date(appliedFilters.hasta);
                h.setHours(23, 59, 59, 999);
                params.hasta = h.toISOString();
            }
            if (appliedFilters.remesas && appliedFilters.remesas.length > 0) {
                params.remesas = appliedFilters.remesas.join(',');
            }

            const res = await api.get(endpoint, { params });
            setReportes(res.data.data || []);
            setTotal(res.data.total || 0);
            calcularKpis(res.data.data || []);
        } catch (err) {
            console.error('Error al cargar reportes:', err);
            setError('Error al cargar los reportes. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    }, [appliedFilters, page, rowsPerPage]);

    useEffect(() => {
        cargarReportes();
    }, [cargarReportes]);

    const calcularKpis = (data) => {
        if (!data || data.length === 0) {
            setKpis({ totalDeudores: 0, totalEnvios: 0, tasaAperturaEmail: 0, tasaLecturaWapi: 0 });
            return;
        }

        let sumDeudores = 0;
        let sumEnvios = 0;
        let sumAbiertosPonderado = 0;
        let sumEntregadosEmail = 0;
        let sumLeidosPonderado = 0;
        let sumEntregadosWapi = 0;

        for (const r of data) {
            sumDeudores += r.totalDeudores;
            sumEnvios += r.envios.whatsapp + r.envios.email + r.envios.wapi;
            sumAbiertosPonderado += r.email.abiertos;
            sumEntregadosEmail += r.email.entregados;
            sumLeidosPonderado += r.wapi.leidos;
            sumEntregadosWapi += r.wapi.entregados;
        }

        const tasaAperturaEmail = sumEntregadosEmail > 0 ? sumAbiertosPonderado / sumEntregadosEmail : 0;
        const tasaLecturaWapi = sumEntregadosWapi > 0 ? sumLeidosPonderado / sumEntregadosWapi : 0;

        setKpis({
            totalDeudores: sumDeudores,
            totalEnvios: sumEnvios,
            tasaAperturaEmail,
            tasaLecturaWapi,
        });
    };

    const handleBuscar = () => {
        if (!hasMinInputs) return;
        setAppliedFilters({
            empresas: empresasInput,
            desde: desdeInput,
            hasta: hastaInput,
            canal: canalInput,
            remesas: remesasInput,
        });
        setPage(0);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleBuscar();
        }
    };

    const handleLimpiarFiltros = () => {
        setEmpresasInput([]);
        setDesdeInput('');
        setHastaInput('');
        setCanalInput('');
        setRemesasInput([]);
        setAppliedFilters(null);
        setReportes([]);
        setTotal(0);
        setKpis({ totalDeudores: 0, totalEnvios: 0, tasaAperturaEmail: 0, tasaLecturaWapi: 0 });
        setPage(0);
        setError(null);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Para exportar se usan los inputs actuales (el usuario decide qué exporta)
    const handleExportar = async (formato) => {
        setAnchorExport(null);
        setExportando(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                tipo: 'empresa',
                formato,
            });
            if (empresasInput.length > 0) params.append('empresas', empresasInput.map((e) => e.id).join(','));
            if (desdeInput) {
                const d = new Date(desdeInput);
                d.setHours(0, 0, 0, 0);
                params.append('desde', d.toISOString());
            }
            if (hastaInput) {
                const h = new Date(hastaInput);
                h.setHours(23, 59, 59, 999);
                params.append('hasta', h.toISOString());
            }
            if (remesasInput.length > 0) params.append('remesas', remesasInput.join(','));

            const response = await api.get(`/deudores/reportes/exportar?${params.toString()}`, {
                responseType: 'blob',
            });

            const disposition = response.headers['content-disposition'] || '';
            const match = disposition.match(/filename="?([^";]+)"?/);
            
            let filename = match ? match[1] : '';
            if (!filename) {
                const sanitize = (s) => s?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() || '';
                const emp = empresasInput.length > 0 ? sanitize(empresasInput[0].nombre) : 'todas-emp';
                const rem = remesasInput.length > 0 ? sanitize(remesasInput.join('-')) : 'todas-rem';
                const start = desdeInput ? desdeInput.split('T')[0] : 'inicio';
                const end = hastaInput ? hastaInput.split('T')[0] : 'fin';
                const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
                filename = `reporte_${emp}_${rem}_${start}_${end}_${rand}.${formato}`;
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error al exportar reporte:', err);
            setError('Error al exportar el reporte. Intente nuevamente.');
        } finally {
            setExportando(false);
        }
    };

    const handleExportarActividades = async (formato) => {
        setAnchorExportActividades(null);
        setExportandoActividades(true);
        setError(null);

        try {
            const params = new URLSearchParams({ formato });
            if (empresasInput.length > 0) params.append('empresas', empresasInput.map((e) => e.id).join(','));
            if (desdeInput) {
                const d = new Date(desdeInput);
                d.setHours(0, 0, 0, 0);
                params.append('desde', d.toISOString());
            }
            if (hastaInput) {
                const h = new Date(hastaInput);
                h.setHours(23, 59, 59, 999);
                params.append('hasta', h.toISOString());
            }
            if (canalInput) params.append('canal', canalInput);
            if (remesasInput.length > 0) params.append('remesas', remesasInput.join(','));

            const response = await api.get(`/deudores/reportes/exportar-detalle?${params.toString()}`, {
                responseType: 'blob',
            });

            const disposition = response.headers['content-disposition'] || '';
            const match = disposition.match(/filename="?([^";]+)"?/);
            
            let filename = match ? match[1] : '';
            if (!filename) {
                const sanitize = (s) => s?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() || '';
                const emp = empresasInput.length > 0 ? sanitize(empresasInput[0].nombre) : 'todas-emp';
                const rem = remesasInput.length > 0 ? sanitize(remesasInput.join('-')) : 'todas-rem';
                const start = desdeInput ? desdeInput.split('T')[0] : 'inicio';
                const end = hastaInput ? hastaInput.split('T')[0] : 'fin';
                const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
                filename = `actividades_${emp}_${rem}_${start}_${end}_${rand}.${formato}`;
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error al exportar actividades:', err);
            setError('Error al exportar las actividades detalladas. Intente nuevamente.');
        } finally {
            setExportandoActividades(false);
        }
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <BarChartIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
                <Typography variant="h4" color="text.primary">
                    Reportes de Deudores
                </Typography>
            </Box>

            <Paper sx={{ mb: 3, p: 2, bgcolor: theme.palette.background.paper }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap', width: '100%', mb: 2 }}>
                    <Box sx={{ flex: 3, minWidth: 200 }}>
                        <Autocomplete
                            multiple
                            fullWidth
                            size="small"
                            options={empresas}
                            value={empresasInput}
                            onChange={(_, v) => setEmpresasInput(v)}
                            onKeyDown={handleKeyDown}
                            filterSelectedOptions
                            disableCloseOnSelect
                            limitTags={3}
                            ChipProps={{ size: 'small' }}
                            getOptionLabel={(o) => (typeof o === 'string' ? o : o?.nombre ?? '')}
                            isOptionEqualToValue={(o, v) => o?.id === v?.id}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    fullWidth
                                    label="Empresas"
                                    placeholder={empresasInput.length === 0 ? 'Todas' : ''}
                                />
                            )}
                            noOptionsText="Sin coincidencias"
                        />
                    </Box>
                    <Box sx={{ flex: 2, minWidth: 120 }}>
                        <Autocomplete
                            multiple
                            fullWidth
                            size="small"
                            disabled={empresasInput.length === 0}
                            options={remesasList}
                            value={remesasInput}
                            onChange={(_, v) => setRemesasInput(v)}
                            onKeyDown={handleKeyDown}
                            filterSelectedOptions
                            disableCloseOnSelect
                            limitTags={3}
                            ChipProps={{ size: 'small' }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    fullWidth
                                    label="Remesas"
                                    placeholder={
                                        empresasInput.length === 0
                                            ? 'Empresa...'
                                            : remesasInput.length === 0
                                                ? 'Todas'
                                                : ''
                                    }
                                />
                            )}
                            noOptionsText="Sin coincidencias"
                        />
                    </Box>
                    <Box sx={{ flex: 1.5, minWidth: 130 }}>
                        <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="Desde"
                            value={desdeInput}
                            onChange={(e) => setDesdeInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Box>
                    <Box sx={{ flex: 1.5, minWidth: 130 }}>
                        <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="Hasta"
                            value={hastaInput}
                            onChange={(e) => setHastaInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Box>
                    <Box sx={{ flex: 2, minWidth: 120 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Canal</InputLabel>
                            <Select
                                value={canalInput}
                                label="Canal"
                                onChange={(e) => setCanalInput(e.target.value)}
                            >
                                <MenuItem value="">Todos</MenuItem>
                                <MenuItem value="whatsapp">WhatsApp Legacy</MenuItem>
                                <MenuItem value="email">Email</MenuItem>
                                <MenuItem value="wapi">WhatsApp Meta</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                    <Box sx={{ flex: 2, minWidth: 120 }}>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={handleBuscar}
                                disabled={!hasMinInputs || loading}
                                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                                sx={{ height: 40, px: 1 }}
                            >
                                Buscar
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={handleLimpiarFiltros}
                                sx={{ height: 40, minWidth: 40, px: 0 }}
                                title="Limpiar filtros"
                            >
                                <ClearIcon fontSize="small" />
                            </Button>
                        </Box>
                    </Box>
                </Box>

                {/* KPI Cards */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <KpiCard
                            title="Total Deudores"
                            value={kpis.totalDeudores.toLocaleString()}
                            icon={BarChartIcon}
                            color={theme.palette.primary.main}
                            loading={loading}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <KpiCard
                            title="Total Envíos"
                            value={kpis.totalEnvios.toLocaleString()}
                            icon={SendIcon}
                            color={theme.palette.secondary.main}
                            loading={loading}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <KpiCard
                            title="Tasa Apertura Email"
                            value={formatPercentage(kpis.tasaAperturaEmail)}
                            icon={VisibilityIcon}
                            color={theme.palette.success.main}
                            loading={loading}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <KpiCard
                            title="Tasa Lectura WAPI"
                            value={formatPercentage(kpis.tasaLecturaWapi)}
                            icon={DoneAllIcon}
                            color={theme.palette.info.main}
                            loading={loading}
                        />
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ bgcolor: theme.palette.background.paper, position: 'relative' }}>
                <Fade in={loading} unmountOnExit>
                    <LinearProgress
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            zIndex: 2,
                            height: 3,
                        }}
                    />
                </Fade>

                {error && (
                    <Alert severity="error" sx={{ m: 2 }}>
                        {error}
                    </Alert>
                )}

                {!loading && !error && appliedFilters && reportes.length === 0 && (
                    <Alert severity="info" sx={{ m: 2 }}>
                        Sin datos en el período seleccionado para los filtros aplicados.
                    </Alert>
                )}

                <Box sx={{ overflowX: 'auto' }}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5' }}>
                                <TableCell><strong>Empresa</strong></TableCell>
                                <TableCell align="center"><strong>Deudores</strong></TableCell>
                                <TableCell align="center"><strong>Contactos</strong></TableCell>
                                <TableCell align="center"><strong>Envíos</strong></TableCell>
                                <TableCell align="center"><strong>Email: Entregados</strong></TableCell>
                                <TableCell align="center"><strong>Email: Abiertos</strong></TableCell>
                                <TableCell align="center"><strong>Email: Clicks</strong></TableCell>
                                <TableCell align="center"><strong>Email: Rebotes</strong></TableCell>
                                <TableCell align="center"><strong>Email: % Apert.</strong></TableCell>
                                <TableCell align="center"><strong>Email: % Click</strong></TableCell>
                                <TableCell align="center"><strong>WAPI: Entregados</strong></TableCell>
                                <TableCell align="center"><strong>WAPI: Leídos</strong></TableCell>
                                <TableCell align="center"><strong>WAPI: Fallidos</strong></TableCell>
                                <TableCell align="center"><strong>WAPI: % Entrega</strong></TableCell>
                                <TableCell align="center"><strong>WAPI: % Lectura</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {!appliedFilters && !loading ? (
                                <TableRow>
                                    <TableCell colSpan={15} align="center" sx={{ py: 6 }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                            <SearchIcon sx={{ fontSize: 48, color: theme.palette.text.disabled }} />
                                            <Typography variant="body1" color="text.secondary">
                                                Utilice los filtros y presione <strong>Buscar</strong> para ver los reportes
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <SkeletonRow key={i} columns={15} />
                                ))
                            ) : reportes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={15} align="center" sx={{ py: 4 }}>
                                        <Typography variant="body1" color="text.secondary">
                                            No se encontraron reportes con estos filtros
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reportes.map((r, idx) => (
                                    <TableRow key={idx} hover>
                                        <TableCell>{getEmpresaLabel(r.empresa)}</TableCell>
                                        <TableCell align="center">{r.totalDeudores.toLocaleString()}</TableCell>
                                        <TableCell align="center">
                                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <Chip icon={<WhatsAppIcon />} label={r.contactosPorCanal.wapi} size="small" color="success" />
                                                <Chip icon={<EmailIcon />} label={r.contactosPorCanal.email} size="small" color="primary" />
                                                <Chip icon={<ApiIcon />} label={r.contactosPorCanal.whatsapp} size="small" color="secondary" />
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <Chip icon={<WhatsAppIcon />} label={r.envios.wapi} size="small" variant="outlined" color="success" />
                                                <Chip icon={<EmailIcon />} label={r.envios.email} size="small" variant="outlined" color="primary" />
                                                <Chip icon={<ApiIcon />} label={r.envios.whatsapp} size="small" variant="outlined" color="secondary" />
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">{r.email.entregados}</TableCell>
                                        <TableCell align="center">{r.email.abiertos}</TableCell>
                                        <TableCell align="center">{r.email.clicks}</TableCell>
                                        <TableCell align="center">{r.email.rebotes}</TableCell>
                                        <TableCell align="center">{formatPercentage(r.email.tasaApertura)}</TableCell>
                                        <TableCell align="center">{formatPercentage(r.email.tasaClick)}</TableCell>
                                        <TableCell align="center">{r.wapi.entregados}</TableCell>
                                        <TableCell align="center">{r.wapi.leidos}</TableCell>
                                        <TableCell align="center">{r.wapi.fallidos}</TableCell>
                                        <TableCell align="center">{formatPercentage(r.wapi.tasaEntrega)}</TableCell>
                                        <TableCell align="center">{formatPercentage(r.wapi.tasaLectura)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Box>

                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Box>
                            <Button
                                variant="outlined"
                                startIcon={exportando ? <CircularProgress size={16} /> : <DownloadIcon />}
                                onClick={(e) => setAnchorExport(e.currentTarget)}
                                disabled={exportando || loading || reportes.length === 0}
                            >
                                Exportar Reporte
                            </Button>
                            <Menu
                                anchorEl={anchorExport}
                                open={Boolean(anchorExport)}
                                onClose={() => setAnchorExport(null)}
                            >
                                <MenuItem onClick={() => handleExportar('csv')}>
                                    <ListItemIcon>
                                        <InsertDriveFileIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>Exportar a CSV</ListItemText>
                                </MenuItem>
                                <MenuItem onClick={() => handleExportar('xlsx')}>
                                    <ListItemIcon>
                                        <TableChartIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>Exportar a Excel (XLSX)</ListItemText>
                                </MenuItem>
                            </Menu>
                        </Box>

                        <Box>
                            <Button
                                color="secondary"
                                variant="outlined"
                                startIcon={exportandoActividades ? <CircularProgress size={16} /> : <DownloadIcon />}
                                onClick={(e) => setAnchorExportActividades(e.currentTarget)}
                                disabled={exportandoActividades || loading}
                            >
                                Exportar Actividades (Fila x Actv.)
                            </Button>
                            <Menu
                                anchorEl={anchorExportActividades}
                                open={Boolean(anchorExportActividades)}
                                onClose={() => setAnchorExportActividades(null)}
                            >
                                <MenuItem onClick={() => handleExportarActividades('csv')}>
                                    <ListItemIcon>
                                        <InsertDriveFileIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>Exportar a CSV</ListItemText>
                                </MenuItem>
                                <MenuItem onClick={() => handleExportarActividades('xlsx')}>
                                    <ListItemIcon>
                                        <TableChartIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>Exportar a Excel (XLSX)</ListItemText>
                                </MenuItem>
                            </Menu>
                        </Box>
                    </Box>

                    <TablePagination
                        component="div"
                        count={total}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[10, 20, 50, 100]}
                        labelRowsPerPage="Filas por página:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                    />
                </Box>
            </Paper>
        </Container>
    );
}
