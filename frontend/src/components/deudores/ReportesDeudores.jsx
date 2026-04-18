import React, { useState, useEffect } from 'react';
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
    Tabs,
    Tab,
    Card,
    CardContent,
    Menu,
    ListItemIcon,
    ListItemText,
    CircularProgress,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import ApiIcon from '@mui/icons-material/Api';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SendIcon from '@mui/icons-material/Send';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import TableChartIcon from '@mui/icons-material/TableChart';
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

    // Tab actual
    const [tab, setTab] = useState(0); // 0 = empresas, 1 = remesas

    // Filtros
    const [empresa, setEmpresa] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [canal, setCanal] = useState('');
    const [remesa, setRemesa] = useState('');

    // Data
    const [reportes, setReportes] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    const [loading, setLoading] = useState(false);
    const [empresas, setEmpresas] = useState([]);
    const [remesasList, setRemesasList] = useState([]);
    const [error, setError] = useState(null);

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

    // Cargar remesas al cambiar la empresa
    useEffect(() => {
        const cargarRemesas = async () => {
            if (!empresa) {
                setRemesasList([]);
                setRemesa('');
                return;
            }
            try {
                const res = await api.get(`/deudores/remesas?empresa=${encodeURIComponent(empresa)}`);
                setRemesasList(res.data || []);
            } catch (err) {
                console.error('Error al cargar remesas:', err);
            }
        };
        cargarRemesas();
    }, [empresa]);

    // Cargar reportes cuando cambian filtros, tab, o paginación
    useEffect(() => {
        cargarReportes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, empresa, desde, hasta, page, rowsPerPage]);

    const cargarReportes = async () => {
        // Validar que haya al menos un filtro en tab 0, o empresa en tab 1
        if (tab === 0 && !empresa && !desde && !hasta) {
            setReportes([]);
            setTotal(0);
            setKpis({ totalDeudores: 0, totalEnvios: 0, tasaAperturaEmail: 0, tasaLecturaWapi: 0 });
            setLoading(false);
            return;
        }
        if (tab === 1 && !empresa) {
            setReportes([]);
            setTotal(0);
            setKpis({ totalDeudores: 0, totalEnvios: 0, tasaAperturaEmail: 0, tasaLecturaWapi: 0 });
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const endpoint = tab === 0 ? '/deudores/reportes/empresas' : '/deudores/reportes/remesas';
            const params = {
                page,
                size: rowsPerPage,
            };
            if (empresa) params.empresa = empresa;
            if (desde) params.desde = new Date(desde).toISOString();
            if (hasta) params.hasta = new Date(hasta).toISOString();

            const res = await api.get(endpoint, { params });
            setReportes(res.data.data || []);
            setTotal(res.data.total || 0);

            // Calcular KPIs de la página actual
            calcularKpis(res.data.data || []);
        } catch (err) {
            console.error('Error al cargar reportes:', err);
            setError('Error al cargar los reportes. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

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

    const handleLimpiarFiltros = () => {
        setEmpresa('');
        setDesde('');
        setHasta('');
        setCanal('');
        setRemesa('');
        setPage(0);
    };

    const handleTabChange = (event, newValue) => {
        setTab(newValue);
        setPage(0);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleExportar = async (formato) => {
        setAnchorExport(null);
        setExportando(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                tipo: tab === 0 ? 'empresa' : 'remesa',
                formato,
            });
            if (empresa) params.append('empresa', empresa);
            if (desde) params.append('desde', new Date(desde).toISOString());
            if (hasta) params.append('hasta', new Date(hasta).toISOString());

            const response = await api.get(`/deudores/reportes/exportar?${params.toString()}`, {
                responseType: 'blob',
            });

            const disposition = response.headers['content-disposition'] || '';
            const match = disposition.match(/filename="?([^";]+)"?/);
            const filename = match ? match[1] : `reporte-${formato}.${formato}`;

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
            if (empresa) params.append('empresa', empresa);
            if (desde) params.append('desde', new Date(desde).toISOString());
            if (hasta) params.append('hasta', new Date(hasta).toISOString());
            if (canal) params.append('canal', canal);
            if (remesa) params.append('remesa', remesa);

            const response = await api.get(`/deudores/reportes/exportar-detalle?${params.toString()}`, {
                responseType: 'blob',
            });

            const disposition = response.headers['content-disposition'] || '';
            const match = disposition.match(/filename="?([^";]+)"?/);
            const filename = match ? match[1] : `actividades-${formato}.${formato}`;

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
                <Tabs value={tab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tab label="Por empresa" />
                    <Tab label="Por remesa" />
                </Tabs>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                    {tab === 1 && (
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Empresa</InputLabel>
                                <Select
                                    value={empresa}
                                    label="Empresa"
                                    onChange={(e) => { setEmpresa(e.target.value); setPage(0); }}
                                >
                                    <MenuItem value="">Todas</MenuItem>
                                    {empresas.map((emp) => (
                                        <MenuItem key={emp} value={emp}>{emp}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    )}
                    <Grid item xs={12} md={tab === 1 ? 2 : 2}>
                        <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="Desde"
                            value={desde}
                            onChange={(e) => { setDesde(e.target.value); setPage(0); }}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={12} md={tab === 1 ? 2 : 2}>
                        <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="Hasta"
                            value={hasta}
                            onChange={(e) => { setHasta(e.target.value); setPage(0); }}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={12} md={tab === 1 ? 3 : 4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Canal (Exporte)</InputLabel>
                            <Select
                                value={canal}
                                label="Canal (Exporte)"
                                onChange={(e) => { setCanal(e.target.value); setPage(0); }}
                            >
                                <MenuItem value="">Todos</MenuItem>
                                <MenuItem value="whatsapp">WhatsApp Legacy</MenuItem>
                                <MenuItem value="email">Email</MenuItem>
                                <MenuItem value="wapi">WhatsApp Meta</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={tab === 1 ? 2 : 2}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Remesa (Exporte)</InputLabel>
                            <Select
                                value={remesa}
                                label="Remesa (Exporte)"
                                onChange={(e) => { setRemesa(e.target.value); setPage(0); }}
                                disabled={!empresa || remesasList.length === 0}
                            >
                                <MenuItem value="">Todas</MenuItem>
                                {remesasList.map((r) => (
                                    <MenuItem key={r} value={r}>{r}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={tab === 1 ? 1 : 2}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<ClearIcon />}
                            onClick={handleLimpiarFiltros}
                            sx={{ height: '100%' }}
                        >
                            Limpiar
                        </Button>
                    </Grid>
                </Grid>

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

            <Paper sx={{ bgcolor: theme.palette.background.paper }}>
                {error && (
                    <Alert severity="error" sx={{ m: 2 }}>
                        {error}
                    </Alert>
                )}

                {!loading && !error && reportes.length === 0 && (tab === 0 ? (empresa || desde || hasta) : empresa) && (
                    <Alert severity="info" sx={{ m: 2 }}>
                        Sin datos en el período seleccionado para los filtros aplicados.
                    </Alert>
                )}

                <Box sx={{ overflowX: 'auto' }}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5' }}>
                                <TableCell><strong>Empresa</strong></TableCell>
                                {tab === 1 && <TableCell><strong>Remesa</strong></TableCell>}
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
                            {tab === 0 && !empresa && !desde && !hasta ? (
                                <TableRow>
                                    <TableCell colSpan={16} align="center" sx={{ py: 4 }}>
                                        <Typography variant="body1" color="text.secondary">
                                            Utilice los filtros superiores para ver los reportes
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : tab === 1 && !empresa ? (
                                <TableRow>
                                    <TableCell colSpan={16} align="center" sx={{ py: 4 }}>
                                        <Typography variant="body1" color="text.secondary">
                                            Debe seleccionar una empresa para ver reportes por remesa
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <SkeletonRow key={i} columns={tab === 0 ? 15 : 16} />
                                ))
                            ) : reportes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={16} align="center" sx={{ py: 4 }}>
                                        <Typography variant="body1" color="text.secondary">
                                            No se encontraron reportes con estos filtros
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reportes.map((r, idx) => (
                                    <TableRow key={idx} hover>
                                        <TableCell>{r.empresa}</TableCell>
                                        {tab === 1 && <TableCell>{r.remesa}</TableCell>}
                                        <TableCell align="center">{r.totalDeudores.toLocaleString()}</TableCell>
                                        <TableCell align="center">
                                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <Chip icon={<WhatsAppIcon />} label={r.contactosPorCanal.whatsapp} size="small" color="success" />
                                                <Chip icon={<EmailIcon />} label={r.contactosPorCanal.email} size="small" color="primary" />
                                                <Chip icon={<ApiIcon />} label={r.contactosPorCanal.wapi} size="small" color="secondary" />
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <Chip icon={<WhatsAppIcon />} label={r.envios.whatsapp} size="small" variant="outlined" color="success" />
                                                <Chip icon={<EmailIcon />} label={r.envios.email} size="small" variant="outlined" color="primary" />
                                                <Chip icon={<ApiIcon />} label={r.envios.wapi} size="small" variant="outlined" color="secondary" />
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
