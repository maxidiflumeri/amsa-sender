import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import ApiIcon from '@mui/icons-material/Api';
import ClearIcon from '@mui/icons-material/Clear';
import api from '../../api/axios';

const SkeletonRow = () => (
    <TableRow>
        {[80, 200, 120, 150, 120, 100, 150].map((w, i) => (
            <TableCell key={i}>
                <Skeleton variant="text" width={w} />
            </TableCell>
        ))}
    </TableRow>
);

export default function ListadoDeudores() {
    const theme = useTheme();
    const navigate = useNavigate();

    // Filtros
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [empresa, setEmpresa] = useState('');
    const [nroEmpresa, setNroEmpresa] = useState('');
    const [remesa, setRemesa] = useState('');

    // Data
    const [deudores, setDeudores] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    // Loading states
    const [loading, setLoading] = useState(true);
    const [empresas, setEmpresas] = useState([]);
    const [remesas, setRemesas] = useState([]);
    const [error, setError] = useState(null);

    // Debounce para el campo de búsqueda
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQ(q);
            setPage(0); // Reset a primera página cuando cambia búsqueda
        }, 400);

        return () => clearTimeout(timer);
    }, [q]);

    // Cargar empresas al montar
    useEffect(() => {
        const cargarEmpresas = async () => {
            try {
                const res = await api.get('/deudores/empresas');
                setEmpresas(res.data);
            } catch (err) {
                console.error('Error al cargar empresas:', err);
            }
        };
        cargarEmpresas();
    }, []);

    // Cargar remesas cuando cambia empresa
    useEffect(() => {
        const cargarRemesas = async () => {
            try {
                const params = empresa ? { empresa } : {};
                const res = await api.get('/deudores/remesas', { params });
                setRemesas(res.data);
            } catch (err) {
                console.error('Error al cargar remesas:', err);
            }
        };
        cargarRemesas();
    }, [empresa]);

    // Buscar deudores
    const buscarDeudores = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params = {
                page,
                size: rowsPerPage,
            };

            if (debouncedQ) params.q = debouncedQ;
            if (empresa) params.empresa = empresa;
            if (nroEmpresa) params.nroEmpresa = nroEmpresa;
            if (remesa) params.remesa = remesa;

            const res = await api.get('/deudores/buscar', { params });
            setDeudores(res.data.data);
            setTotal(res.data.total);
        } catch (err) {
            setError(err.response?.data?.message || 'Error al buscar deudores');
            setDeudores([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [debouncedQ, empresa, nroEmpresa, remesa, page, rowsPerPage]);

    // Ejecutar búsqueda cuando cambian los filtros o la paginación
    useEffect(() => {
        buscarDeudores();
    }, [buscarDeudores]);

    const limpiarFiltros = () => {
        setQ('');
        setDebouncedQ('');
        setEmpresa('');
        setNroEmpresa('');
        setRemesa('');
        setPage(0);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleRowClick = (deudorId) => {
        navigate(`/deudores/${deudorId}`);
    };

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <PersonSearchIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
                <Typography variant="h4" component="h1" sx={{ color: theme.palette.text.primary }}>
                    Buscar Deudores
                </Typography>
            </Box>

            {/* Filtros */}
            <Paper
                sx={{
                    p: 3,
                    mb: 3,
                    bgcolor: theme.palette.background.paper,
                    borderRadius: 2,
                }}
            >
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            label="Buscar"
                            placeholder="ID, Nombre, Documento, Nro. Empresa..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Empresa</InputLabel>
                            <Select
                                value={empresa}
                                label="Empresa"
                                onChange={(e) => {
                                    setEmpresa(e.target.value);
                                    setPage(0);
                                }}
                            >
                                <MenuItem value="">Todas</MenuItem>
                                {empresas.map((emp) => (
                                    <MenuItem key={emp} value={emp}>
                                        {emp}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <TextField
                            fullWidth
                            label="Nro. Empresa"
                            value={nroEmpresa}
                            onChange={(e) => {
                                setNroEmpresa(e.target.value);
                                setPage(0);
                            }}
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Remesa</InputLabel>
                            <Select
                                value={remesa}
                                label="Remesa"
                                onChange={(e) => {
                                    setRemesa(e.target.value);
                                    setPage(0);
                                }}
                            >
                                <MenuItem value="">Todas</MenuItem>
                                {remesas.map((rem) => (
                                    <MenuItem key={rem} value={rem}>
                                        {rem}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={1}>
                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={limpiarFiltros}
                            startIcon={<ClearIcon />}
                            sx={{ height: '40px' }}
                        >
                            Limpiar
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Error */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Tabla */}
            <Paper
                sx={{
                    bgcolor: theme.palette.background.paper,
                    borderRadius: 2,
                    overflow: 'hidden',
                }}
            >
                <Box sx={{ overflowX: 'auto' }}>
                    <Table>
                        <TableHead>
                            <TableRow
                                sx={{
                                    bgcolor:
                                        theme.palette.mode === 'light'
                                            ? '#e8f0fe'
                                            : '#2c2c2c',
                                }}
                            >
                                <TableCell sx={{ fontWeight: 'bold' }}>ID Deudor</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Documento</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Empresa</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Nro. Empresa</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Remesa</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Canales</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <>
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                </>
                            ) : deudores.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                        <Typography
                                            variant="body1"
                                            color={theme.palette.text.secondary}
                                        >
                                            No se encontraron deudores
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                deudores.map((deudor) => (
                                    <TableRow
                                        key={deudor.id}
                                        hover
                                        onClick={() => handleRowClick(deudor.id)}
                                        sx={{
                                            cursor: 'pointer',
                                            '&:hover': {
                                                bgcolor:
                                                    theme.palette.mode === 'light'
                                                        ? '#f5f5f5'
                                                        : '#2a2a2a',
                                            },
                                        }}
                                    >
                                        <TableCell>{deudor.idDeudor || '-'}</TableCell>
                                        <TableCell>{deudor.nombre || '-'}</TableCell>
                                        <TableCell>{deudor.documento || '-'}</TableCell>
                                        <TableCell>{deudor.empresa || '-'}</TableCell>
                                        <TableCell>{deudor.nroEmpresa || '-'}</TableCell>
                                        <TableCell>{deudor.remesa || '-'}</TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                {deudor.canales.whatsapp > 0 && (
                                                    <Chip
                                                        icon={<WhatsAppIcon />}
                                                        label={deudor.canales.whatsapp}
                                                        size="small"
                                                        color="success"
                                                        sx={{ fontSize: 11 }}
                                                    />
                                                )}
                                                {deudor.canales.email > 0 && (
                                                    <Chip
                                                        icon={<EmailIcon />}
                                                        label={deudor.canales.email}
                                                        size="small"
                                                        color="primary"
                                                        sx={{ fontSize: 11 }}
                                                    />
                                                )}
                                                {deudor.canales.wapi > 0 && (
                                                    <Chip
                                                        icon={<ApiIcon />}
                                                        label={deudor.canales.wapi}
                                                        size="small"
                                                        color="info"
                                                        sx={{ fontSize: 11 }}
                                                    />
                                                )}
                                                {deudor.canales.whatsapp === 0 &&
                                                    deudor.canales.email === 0 &&
                                                    deudor.canales.wapi === 0 && (
                                                        <Typography
                                                            variant="caption"
                                                            color={theme.palette.text.secondary}
                                                        >
                                                            Sin canales
                                                        </Typography>
                                                    )}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Box>

                {/* Paginación */}
                <TablePagination
                    component="div"
                    count={total}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[10, 20, 50, 100]}
                    labelRowsPerPage="Filas por página:"
                    labelDisplayedRows={({ from, to, count }) =>
                        `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
                    }
                    sx={{
                        borderTop: `1px solid ${theme.palette.mode === 'light' ? '#e0e0e0' : '#333'}`,
                        bgcolor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                    }}
                />
            </Paper>
        </Container>
    );
}
