import React, { useEffect, useState } from 'react';
import {
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Paper,
    Tabs,
    Tab,
    TableSortLabel,
    TablePagination,
    Box,
    TextField,
    Chip,
    LinearProgress,
    Tooltip,
    useMediaQuery,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Snackbar,
    IconButton
} from '@mui/material';
import api from '../../api/axios';
import { useTheme } from '@mui/material/styles';
import SubirCampañaModal from './SubirCampañaModal';
import InboxIcon from '@mui/icons-material/Inbox';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EventIcon from '@mui/icons-material/Event';
import MuiAlert from '@mui/material/Alert';

export default function VerCampañasEmail() {
    const isMobile = useMediaQuery('(max-width:768px)');
    const theme = useTheme();
    const [campanias, setCampanias] = useState([]);
    const [tab, setTab] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [order, setOrder] = useState('asc');
    const [orderBy, setOrderBy] = useState('nombre');
    const [filtroTexto, setFiltroTexto] = useState('');
    const [progresos, setProgresos] = useState({});
    const [modalNueva, setModalNueva] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
    const [campañaAEnviar, setCampañaAEnviar] = useState(null);
    const [campañaAEliminar, setCampañaAEliminar] = useState(null);
    const [confirmarEliminacion, setConfirmarEliminacion] = useState(false);

    const cargarCampanias = async () => {
        try {
            const res = await api.get('/email/campanias');
            setCampanias(res.data);
        } catch (err) {
            console.error('Error al obtener campañas:', err);
        }
    };

    useEffect(() => {
        cargarCampanias();
    }, []);

    const agendadas = campanias.filter(c => c.estado === 'programada');
    const pendientes = campanias.filter(c => c.estado === 'pendiente');
    const procesando = campanias.filter(c => ['procesando', 'pausada', 'pausa_pendiente'].includes(c.estado));
    const enviadas = campanias.filter(c => c.estado === 'finalizada');
    const campaniasPorTab = tab === 0 ? pendientes : tab === 1 ? agendadas : tab === 2 ? procesando : enviadas;

    const campaniasMostradas = campaniasPorTab.filter((c) =>
        c.nombre.toLowerCase().includes(filtroTexto.toLowerCase())
    );

    const descendingComparator = (a, b, orderBy) => {
        let aVal = a[orderBy], bVal = b[orderBy];
        if (["createdAt", "enviadoAt"].includes(orderBy)) {
            aVal = aVal ? new Date(aVal).getTime() : 0;
            bVal = bVal ? new Date(bVal).getTime() : 0;
        }
        return bVal < aVal ? -1 : bVal > aVal ? 1 : 0;
    };

    const getComparator = (order, orderBy) =>
        order === 'desc'
            ? (a, b) => descendingComparator(a, b, orderBy)
            : (a, b) => -descendingComparator(a, b, orderBy);

    const stableSort = (array, comparator) =>
        array.map((el, index) => [el, index])
            .sort((a, b) => {
                const cmp = comparator(a[0], b[0]);
                return cmp !== 0 ? cmp : a[1] - b[1];
            })
            .map(el => el[0]);

    const campaniasOrdenadas = stableSort(campaniasMostradas, getComparator(order, orderBy));
    const campaniasPaginadas = campaniasOrdenadas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const mensajesPorTab = {
        0: 'No hay campañas pendientes.',
        1: 'No hay campañas agendadas.',
        2: 'No hay campañas procesando.',
        3: 'No hay campañas enviadas.'
    };

    const confirmarEliminar = (campaña) => {
        setCampañaAEliminar(campaña);
        setConfirmarEliminacion(true);
    };

    const eliminarCampaña = async () => {
        if (!campañaAEliminar) return;
        try {
            await api.delete(`/email/campanias/${campañaAEliminar.id}`);
            setMensaje({ tipo: 'success', texto: 'Campaña eliminada correctamente' });
            setSnackbarOpen(true);
            cargarCampanias();
        } catch (err) {
            console.error('Error al eliminar campaña', err);
            setMensaje({ tipo: 'error', texto: 'No se pudo eliminar la campaña' });
            setSnackbarOpen(true);
        } finally {
            setConfirmarEliminacion(false);
            setCampañaAEliminar(null);
        }
    };

    return (
        <>
            <Box sx={{ py: 3 }}>
                <Paper sx={{ p: isMobile ? 2 : 4 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">Campañas Email</Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setModalNueva(true)}
                            sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                backgroundColor: '#075E54',
                                '&:hover': {
                                    backgroundColor: '#0b7b65',
                                    transform: 'scale(1.03)',
                                    boxShadow: 4,
                                },
                            }}
                        >
                            Nueva campaña
                        </Button>
                    </Box>

                    <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)}>
                        <Tab label={`Pendientes (${pendientes.length})`} />
                        <Tab label={`Agendadas (${agendadas.length})`} />
                        <Tab label={`Procesando (${procesando.length})`} />
                        <Tab label={`Enviadas (${enviadas.length})`} />
                    </Tabs>

                    <Box my={2}>
                        <TextField
                            fullWidth
                            label="Buscar campañas"
                            value={filtroTexto}
                            onChange={(e) => setFiltroTexto(e.target.value)}
                            placeholder="Buscar por nombre..."
                        />
                    </Box>

                    <Table size={isMobile ? 'small' : 'medium'}>
                        <TableHead>
                            <TableRow>
                                <TableCell>
                                    <TableSortLabel
                                        active={orderBy === 'nombre'}
                                        direction={orderBy === 'nombre' ? order : 'asc'}
                                        onClick={() => handleRequestSort('nombre')}
                                    >
                                        Nombre
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell align="right">
                                    <TableSortLabel
                                        active={orderBy === 'contactos'}
                                        direction={orderBy === 'contactos' ? order : 'asc'}
                                        onClick={() => handleRequestSort('contactos')}
                                    >
                                        Contactos
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel
                                        active={orderBy === 'createdAt'}
                                        direction={orderBy === 'createdAt' ? order : 'asc'}
                                        onClick={() => handleRequestSort('createdAt')}
                                    >
                                        Creado
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel
                                        active={orderBy === 'enviadoAt'}
                                        direction={orderBy === 'enviadoAt' ? order : 'asc'}
                                        onClick={() => handleRequestSort('enviadoAt')}
                                    >
                                        Enviado
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel
                                        active={orderBy === 'estado'}
                                        direction={orderBy === 'estado' ? order : 'asc'}
                                        onClick={() => handleRequestSort('estado')}
                                    >
                                        Estado
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel
                                        active={orderBy === 'agendadoAt'}
                                        direction={orderBy === 'agendadoAt' ? order : 'asc'}
                                        onClick={() => handleRequestSort('agendadoAt')}
                                    >
                                        Agendada para
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>Progreso</TableCell>
                                <TableCell>Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {campaniasPaginadas.map((c) => (
                                <TableRow key={c.id} hover>
                                    <TableCell>{c.nombre}</TableCell>
                                    <TableCell align="right" sx={{ maxWidth: 5 }}>{c.contactos.length}</TableCell>
                                    <TableCell>{c.createdAt ? new Date(c.createdAt).toLocaleString() : '–'}</TableCell>
                                    <TableCell>{c.enviadoAt ? new Date(c.enviadoAt).toLocaleString() : '–'}</TableCell>
                                    <TableCell>
                                        {c.estado === 'procesando' && <Chip label="Procesando" color="info" />}
                                        {c.estado === 'pausada' && <Chip label="Pausada" color="warning" />}
                                        {c.estado === 'pendiente' && <Chip label="Pendiente" />}
                                        {c.estado === 'finalizada' && <Chip label="Finalizada" color="success" />}
                                        {c.estado === 'programada' && <Chip label="Programada" color="info" />}
                                        {c.estado === 'pausa_pendiente' && <Chip label="Pausa en cola" color="warning" />}
                                    </TableCell>
                                    <TableCell>
                                        {c.agendadoAt
                                            ? new Date(c.agendadoAt).toLocaleString()
                                            : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {c.estado === 'procesando' && (
                                            <Box width={100}>
                                                <LinearProgress
                                                    variant={progresos[c.id] ? 'determinate' : 'indeterminate'}
                                                    value={progresos[c.id] ? (progresos[c.id].enviados / progresos[c.id].total) * 100 : 0}
                                                    sx={{ height: 8, borderRadius: 4 }}
                                                />
                                                <Typography variant="caption">
                                                    {progresos[c.id] ? `${progresos[c.id].enviados}/${progresos[c.id].total}` : '...'}
                                                </Typography>
                                            </Box>
                                        )}
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()} sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>
                                        {c.estado === 'pendiente' && (
                                            <>
                                                <Tooltip title="Enviar campaña">
                                                    <IconButton color="primary" onClick={() => abrirModalEnvio(c)}>
                                                        <SendIcon />
                                                    </IconButton>
                                                </Tooltip>

                                                <Tooltip title="Agendar campaña">
                                                    <IconButton color="secondary" onClick={() => abrirModalAgendar(c)}>
                                                        <EventIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}

                                        {c.estado === 'procesando' || c.estado === 'pausa_pendiente' ? (
                                            pausando.includes(c.id) || c.estado === 'pausa_pendiente' ? (
                                                <Tooltip title={c.estado === 'pausa_pendiente' ? "Pausa ya solicitada" : "Pausando..."}>
                                                    <IconButton disabled>
                                                        {c.estado === 'pausa_pendiente' ? <PauseIcon /> : <CircularProgress size={20} />}
                                                    </IconButton>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip title="Pausar campaña">
                                                    <IconButton color="warning" onClick={() => pausarCampaña(c)}>
                                                        <PauseIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )
                                        ) : null}
                                        {c.estado === 'pausada' && (
                                            <Tooltip title="Reanudar campaña">
                                                <IconButton color="info" onClick={() => reanudarCampaña(c)}>
                                                    <PlayArrowIcon />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {(c.estado === 'pendiente' || c.estado === 'pausada' || c.estado === 'finalizada' || c.estado === 'programada') && (
                                            <Tooltip title="Eliminar campaña">
                                                <IconButton color="error" onClick={() => confirmarEliminar(c)}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {campaniasPaginadas.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8}>
                                        <Box
                                            sx={{
                                                textAlign: 'center',
                                                py: 6,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                color: 'text.secondary'
                                            }}
                                        >
                                            <InboxIcon sx={{ fontSize: 60, mb: 2 }} />
                                            <Typography variant="h6" gutterBottom>
                                                {filtroTexto
                                                    ? 'No se encontraron campañas con ese nombre.'
                                                    : mensajesPorTab[tab]}
                                            </Typography>
                                            {filtroTexto && (
                                                <Typography variant="body2">
                                                    Probá con otro término de búsqueda.
                                                </Typography>
                                            )}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25]}
                        component="div"
                        count={campaniasMostradas.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(_, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                    />
                </Paper>
            </Box>

            <Dialog open={modalNueva} onClose={() => setModalNueva(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Nueva campaña</DialogTitle>
                <DialogContent dividers>
                    <SubirCampañaModal
                        onUploadSuccess={() => {
                            setModalNueva(false);
                            cargarCampanias();
                            setMensaje({ tipo: 'success', texto: 'Campaña subida correctamente' });
                            setSnackbarOpen(true);
                        }}
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={confirmarEliminacion}
                onClose={() => setConfirmarEliminacion(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>¿Eliminar campaña?</DialogTitle>
                <DialogContent dividers>
                    <Typography>
                        ¿Estás seguro de que querés eliminar la campaña "{campañaAEliminar?.nombre}"?
                        Esta acción eliminará sus contactos, pero los reportes se conservarán.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmarEliminacion(false)} color="inherit">
                        Cancelar
                    </Button>
                    <Button onClick={eliminarCampaña} color="error" variant="contained">
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <MuiAlert
                    elevation={6}
                    variant="filled"
                    severity={mensaje.tipo}
                    onClose={() => setSnackbarOpen(false)}
                    icon={<CheckCircleIcon fontSize="inherit" />}
                >
                    {mensaje.texto}
                </MuiAlert>
            </Snackbar>
        </>
    );
}