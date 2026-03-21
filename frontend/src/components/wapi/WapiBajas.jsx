import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, TextField, IconButton, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, TablePagination, Button, Dialog,
    DialogTitle, DialogContent, DialogActions, InputAdornment, Chip,
    CircularProgress, Alert, Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import api from '../../api/axios';

const formatFecha = (ts) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function WapiBajas() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [busqueda, setBusqueda] = useState('');
    const [busquedaActiva, setBusquedaActiva] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Dialog agregar manual
    const [dialogOpen, setDialogOpen] = useState(false);
    const [nuevoNumero, setNuevoNumero] = useState('');
    const [agregando, setAgregando] = useState(false);

    // Dialog confirmar eliminación
    const [dialogEliminar, setDialogEliminar] = useState(null); // número a eliminar
    const [eliminando, setEliminando] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/wapi/bajas', {
                params: { page: page + 1, size: rowsPerPage, q: busquedaActiva || undefined },
            });
            setRows(data.items ?? data);
            setTotal(data.total ?? (data.items?.length ?? data.length));
        } catch {
            setError('Error cargando la lista de bajas');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, busquedaActiva]);

    useEffect(() => { cargar(); }, [cargar]);

    const buscar = () => {
        setPage(0);
        setBusquedaActiva(busqueda);
    };

    const agregarManual = async () => {
        if (!nuevoNumero.trim()) return;
        setAgregando(true);
        try {
            await api.post('/wapi/bajas', { numero: nuevoNumero.trim() });
            setSuccess(`${nuevoNumero.trim()} agregado a bajas`);
            setNuevoNumero('');
            setDialogOpen(false);
            cargar();
        } catch (e) {
            setError(e?.response?.data?.message || 'Error al agregar baja');
        } finally {
            setAgregando(false);
        }
    };

    const eliminar = async () => {
        if (!dialogEliminar) return;
        setEliminando(true);
        try {
            await api.delete(`/wapi/bajas/${encodeURIComponent(dialogEliminar)}`);
            setSuccess(`${dialogEliminar} eliminado de bajas`);
            setDialogEliminar(null);
            cargar();
        } catch {
            setError('Error al eliminar baja');
        } finally {
            setEliminando(false);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <BlockIcon color="error" />
                <Typography variant="h5" fontWeight={700}>Lista de Bajas — WhatsApp API</Typography>
            </Box>

            {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

            {/* Barra de búsqueda + agregar */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                    size="small"
                    placeholder="Buscar por número..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscar()}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                    }}
                    sx={{ width: 280 }}
                />
                <Button variant="outlined" onClick={buscar}>Buscar</Button>
                <Box sx={{ flex: 1 }} />
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
                    Agregar manual
                </Button>
            </Box>

            {/* Tabla */}
            <TableContainer component={Paper} elevation={2}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Número</TableCell>
                            <TableCell>Campaña</TableCell>
                            <TableCell>Template</TableCell>
                            <TableCell>Payload botón</TableCell>
                            <TableCell>Confirmación</TableCell>
                            <TableCell>Fecha</TableCell>
                            <TableCell align="center">Acciones</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                    <CircularProgress size={28} />
                                </TableCell>
                            </TableRow>
                        ) : rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    Sin resultados
                                </TableCell>
                            </TableRow>
                        ) : rows.map((row) => (
                            <TableRow key={row.id} hover>
                                <TableCell sx={{ fontWeight: 600 }}>{row.numero}</TableCell>
                                <TableCell>{row.campañaNombre ?? '-'}</TableCell>
                                <TableCell>{row.templateNombre ?? '-'}</TableCell>
                                <TableCell>
                                    {row.buttonPayload
                                        ? <Chip label={row.buttonPayload} size="small" variant="outlined" />
                                        : <Typography variant="caption" color="text.secondary">Manual</Typography>
                                    }
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={row.confirmacionEnviada ? 'Enviada' : 'No'}
                                        color={row.confirmacionEnviada ? 'success' : 'default'}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell sx={{ fontSize: 12 }}>{formatFecha(row.creadoAt)}</TableCell>
                                <TableCell align="center">
                                    <Tooltip title="Quitar de bajas">
                                        <IconButton size="small" color="error" onClick={() => setDialogEliminar(row.numero)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <TablePagination
                component="div"
                count={total}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
                rowsPerPageOptions={[25, 50, 100]}
                labelRowsPerPage="Filas:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />

            {/* Dialog agregar manual */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Agregar número a bajas</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Número (ej: 5491112345678)"
                        value={nuevoNumero}
                        onChange={(e) => setNuevoNumero(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && agregarManual()}
                        sx={{ mt: 1 }}
                        helperText="Formato internacional sin + (ej: 5491112345678)"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={agregarManual} disabled={!nuevoNumero.trim() || agregando}>
                        {agregando ? <CircularProgress size={20} /> : 'Agregar'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog confirmar eliminación */}
            <Dialog open={!!dialogEliminar} onClose={() => setDialogEliminar(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Quitar de bajas</DialogTitle>
                <DialogContent>
                    <Typography>¿Eliminar <strong>{dialogEliminar}</strong> de la lista de bajas?</Typography>
                    <Typography variant="caption" color="text.secondary">El número podrá recibir mensajes nuevamente.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogEliminar(null)}>Cancelar</Button>
                    <Button variant="contained" color="error" onClick={eliminar} disabled={eliminando}>
                        {eliminando ? <CircularProgress size={20} /> : 'Eliminar'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
