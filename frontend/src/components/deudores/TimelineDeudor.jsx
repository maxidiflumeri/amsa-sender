import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    TextField,
    Alert,
    Skeleton,
    Grid,
    TablePagination,
    useTheme,
    Divider,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import api from '../../api/axios';
import TimelineEntry from './TimelineEntry';

export default function TimelineDeudor({ deudorId }) {
    const theme = useTheme();

    const [entries, setEntries] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(30);
    const [canal, setCanal] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const cargarTimeline = async () => {
        if (!deudorId) {
            setError('ID de deudor inválido');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = {
                page,
                size,
            };

            if (canal) params.canal = canal;
            if (desde) params.desde = new Date(desde).toISOString();
            if (hasta) params.hasta = new Date(hasta).toISOString();

            const res = await api.get(`/deudores/${deudorId}/timeline`, { params });

            setEntries(res.data.data || []);
            setTotal(res.data.total || 0);
        } catch (err) {
            setError(err.response?.data?.message || 'Error al cargar el timeline');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarTimeline();
    }, [deudorId, page, size, canal, desde, hasta]);

    const handleLimpiarFiltros = () => {
        setCanal('');
        setDesde('');
        setHasta('');
        setPage(0);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setSize(parseInt(event.target.value, 10));
        setPage(0);
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <FilterListIcon sx={{ color: theme.palette.primary.main }} />
                <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
                    Historial de interacciones
                </Typography>
            </Box>

            <Divider sx={{ mb: 3, borderColor: theme.palette.mode === 'light' ? '#e0e0e0' : '#333' }} />

            {/* Filtros */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel id="canal-label">Canal</InputLabel>
                        <Select
                            labelId="canal-label"
                            value={canal}
                            label="Canal"
                            onChange={(e) => {
                                setCanal(e.target.value);
                                setPage(0);
                            }}
                            sx={{
                                bgcolor: theme.palette.background.paper,
                                color: theme.palette.text.primary,
                            }}
                        >
                            <MenuItem value="">Todos</MenuItem>
                            <MenuItem value="whatsapp">WhatsApp Web</MenuItem>
                            <MenuItem value="wapi">WhatsApp Meta</MenuItem>
                            <MenuItem value="email">Email</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <TextField
                        label="Desde"
                        type="date"
                        size="small"
                        fullWidth
                        value={desde}
                        onChange={(e) => {
                            setDesde(e.target.value);
                            setPage(0);
                        }}
                        InputLabelProps={{ shrink: true }}
                        sx={{
                            bgcolor: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                        }}
                    />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <TextField
                        label="Hasta"
                        type="date"
                        size="small"
                        fullWidth
                        value={hasta}
                        onChange={(e) => {
                            setHasta(e.target.value);
                            setPage(0);
                        }}
                        InputLabelProps={{ shrink: true }}
                        sx={{
                            bgcolor: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                        }}
                    />
                </Grid>

                <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex', alignItems: 'flex-start' }}>
                    <Button
                        variant="outlined"
                        startIcon={<ClearIcon />}
                        onClick={handleLimpiarFiltros}
                        fullWidth
                        sx={{ height: '40px' }}
                    >
                        Limpiar filtros
                    </Button>
                </Grid>
            </Grid>

            {/* Estados */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Loading */}
            {loading && (
                <Box>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton
                            key={i}
                            variant="rectangular"
                            height={100}
                            sx={{ mb: 2, borderRadius: 1 }}
                        />
                    ))}
                </Box>
            )}

            {/* Sin resultados */}
            {!loading && entries.length === 0 && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    Sin interacciones registradas para este deudor.
                </Alert>
            )}

            {/* Entradas */}
            {!loading && entries.length > 0 && (
                <Box>
                    {entries.map((entry) => (
                        <TimelineEntry key={entry.id} entry={entry} />
                    ))}

                    {/* Paginación */}
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            mt: 2,
                        }}
                    >
                        <TablePagination
                            component="div"
                            count={total}
                            page={page}
                            onPageChange={handleChangePage}
                            rowsPerPage={size}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            rowsPerPageOptions={[10, 30, 50, 100]}
                            labelRowsPerPage="Filas por página:"
                            labelDisplayedRows={({ from, to, count }) =>
                                `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
                            }
                            sx={{
                                color: theme.palette.text.primary,
                                '.MuiTablePagination-select': {
                                    color: theme.palette.text.primary,
                                },
                                '.MuiTablePagination-selectIcon': {
                                    color: theme.palette.text.primary,
                                },
                            }}
                        />
                    </Box>
                </Box>
            )}
        </Box>
    );
}
