import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Paper,
    Typography,
    TextField,
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
    Autocomplete,
    LinearProgress,
    CircularProgress,
    Fade,
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import ApiIcon from '@mui/icons-material/Api';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
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

    // Estado del formulario (inputs del usuario)
    const [qInput, setQInput] = useState('');
    const [empresasInput, setEmpresasInput] = useState([]);
    const [nroEmpresaInput, setNroEmpresaInput] = useState('');
    const [remesasInput, setRemesasInput] = useState([]);

    // Filtros aplicados (los que se usan para buscar)
    const [appliedFilters, setAppliedFilters] = useState(null);

    // Data
    const [deudores, setDeudores] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    // Loading states
    const [loading, setLoading] = useState(false);
    const [empresas, setEmpresas] = useState([]);
    const [remesas, setRemesas] = useState([]);
    const [error, setError] = useState(null);

    const empresasMap = useMemo(() => {
        const map = new Map();
        for (const e of empresas) {
            if (e && typeof e === 'object' && 'id' in e) map.set(e.id, e.nombre);
        }
        return map;
    }, [empresas]);
    const getEmpresaLabel = (id) => empresasMap.get(id) ?? id ?? '-';

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

    // Cargar remesas cuando cambian las empresas del formulario
    // Nota: sólo se consulta si hay al menos una empresa seleccionada.
    useEffect(() => {
        if (empresasInput.length === 0) {
            setRemesas([]);
            setRemesasInput([]);
            return;
        }
        const cargarRemesas = async () => {
            try {
                const params = { empresas: empresasInput.map((e) => e.id).join(',') };
                const res = await api.get('/deudores/remesas', { params });
                setRemesas(res.data || []);
            } catch (err) {
                console.error('Error al cargar remesas:', err);
            }
        };
        cargarRemesas();
    }, [empresasInput]);

    // Depura remesas seleccionadas si dejan de pertenecer al listado
    useEffect(() => {
        if (remesasInput.length === 0) return;
        const filtradas = remesasInput.filter((r) => remesas.includes(r));
        if (filtradas.length !== remesasInput.length) {
            setRemesasInput(filtradas);
        }
    }, [remesas, remesasInput]);

    const hasActiveInputs = Boolean(
        qInput ||
            empresasInput.length > 0 ||
            nroEmpresaInput ||
            remesasInput.length > 0,
    );

    // Buscar deudores
    const buscarDeudores = useCallback(async () => {
        if (!appliedFilters) return;

        setLoading(true);
        setError(null);

        try {
            const params = {
                page,
                size: rowsPerPage,
            };

            if (appliedFilters.q) params.q = appliedFilters.q;
            if (appliedFilters.empresas && appliedFilters.empresas.length > 0) {
                params.empresas = appliedFilters.empresas.map((e) => e.id).join(',');
            }
            if (appliedFilters.nroEmpresa) params.nroEmpresa = appliedFilters.nroEmpresa;
            if (appliedFilters.remesas && appliedFilters.remesas.length > 0) {
                params.remesas = appliedFilters.remesas.join(',');
            }

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
    }, [appliedFilters, page, rowsPerPage]);

    useEffect(() => {
        buscarDeudores();
    }, [buscarDeudores]);

    const handleBuscar = () => {
        if (!hasActiveInputs) return;
        setAppliedFilters({
            q: qInput.trim(),
            empresas: empresasInput,
            nroEmpresa: nroEmpresaInput.trim(),
            remesas: remesasInput,
        });
        setPage(0);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleBuscar();
        }
    };

    const limpiarFiltros = () => {
        setQInput('');
        setEmpresasInput([]);
        setNroEmpresaInput('');
        setRemesasInput([]);
        setAppliedFilters(null);
        setDeudores([]);
        setTotal(0);
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
                    <Grid item xs={12} md={6}>
                        <Autocomplete
                            multiple
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
                                    label="Empresas"
                                    placeholder={empresasInput.length === 0 ? 'Todas' : ''}
                                />
                            )}
                            noOptionsText="Sin coincidencias"
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Autocomplete
                            multiple
                            size="small"
                            disabled={empresasInput.length === 0}
                            options={remesas}
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
                                    label="Remesas"
                                    placeholder={
                                        empresasInput.length === 0
                                            ? 'Seleccione una empresa primero'
                                            : remesasInput.length === 0
                                                ? 'Todas'
                                                : ''
                                    }
                                />
                            )}
                            noOptionsText="Sin coincidencias"
                        />
                    </Grid>
                    <Grid item xs={12} sm={8} md={6}>
                        <TextField
                            fullWidth
                            label="Buscar (ID, Nombre, Documento)"
                            placeholder="Escriba y presione Buscar..."
                            value={qInput}
                            onChange={(e) => setQInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} sm={4} md={3}>
                        <TextField
                            fullWidth
                            label="Nro. Empresa"
                            value={nroEmpresaInput}
                            onChange={(e) => setNroEmpresaInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={handleBuscar}
                                disabled={!hasActiveInputs || loading}
                                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                                sx={{ height: 40 }}
                            >
                                Buscar
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={limpiarFiltros}
                                sx={{ height: 40, minWidth: 40, px: 1 }}
                                title="Limpiar filtros"
                            >
                                <ClearIcon fontSize="small" />
                            </Button>
                        </Box>
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
                    position: 'relative',
                }}
            >
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
                            {!appliedFilters && !loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                            <SearchIcon sx={{ fontSize: 48, color: theme.palette.text.disabled }} />
                                            <Typography
                                                variant="body1"
                                                color={theme.palette.text.secondary}
                                            >
                                                Utilice los filtros y presione <strong>Buscar</strong> para listar deudores
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : loading ? (
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
                                        <TableCell>{deudor.empresa ? getEmpresaLabel(deudor.empresa) : '-'}</TableCell>
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
