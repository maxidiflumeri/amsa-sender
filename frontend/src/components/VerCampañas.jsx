import React, { useEffect, useState } from 'react';
import {
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Button,
    Alert,
    Chip,
    TablePagination,
    Tabs,
    Tab,
    TableSortLabel,
    Tooltip,
    DialogActions,
    Snackbar
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MuiAlert from '@mui/material/Alert';
import api from '../api/axios';
import SubirCampaña from './SubirCampaña';
import EnviarMensajesModal from './EnviarMensajes';
import CircularProgress from '@mui/material/CircularProgress';

export default function VerCampañas() {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [campañas, setCampañas] = useState([]);
    const [campañaSeleccionada, setCampañaSeleccionada] = useState(null);
    const [modalNueva, setModalNueva] = useState(false);
    const [modalEnvio, setModalEnvio] = useState(false);
    const [campañaAEnviar, setCampañaAEnviar] = useState(null);
    const [campañaAEliminar, setCampañaAEliminar] = useState(null);
    const [confirmarEliminacion, setConfirmarEliminacion] = useState(false);
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
    const [tab, setTab] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [order, setOrder] = useState('asc');
    const [orderBy, setOrderBy] = useState('nombre');
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [procesandoCampañaId, setProcesandoCampañaId] = useState(null);

    const cargarCampañas = async () => {
        try {
            const res = await api.get('/campanias');
            setCampañas(res.data);
        } catch (err) {
            console.error('Error al obtener campañas:', err);
        }
    };

    useEffect(() => {
        cargarCampañas();
    }, []);

    const pendientes = campañas.filter(c => c.estado === 'pendiente');
    const procesando = campañas.filter(c => ['procesando', 'pausada'].includes(c.estado));
    const enviadas = campañas.filter(c => c.estado === 'finalizada');
    const campañasMostradas = tab === 0 ? pendientes : tab === 1 ? procesando : enviadas;

    const descendingComparator = (a, b, orderBy) => {
        let aVal = a[orderBy], bVal = b[orderBy];
        if (['createdAt', 'enviadoAt'].includes(orderBy)) {
            aVal = aVal ? new Date(aVal).getTime() : 0;
            bVal = bVal ? new Date(bVal).getTime() : 0;
        }
        if (orderBy === 'contactos') {
            aVal = a.contactos?.length || 0;
            bVal = b.contactos?.length || 0;
        }
        return bVal < aVal ? -1 : bVal > aVal ? 1 : 0;
    };

    const getComparator = (order, orderBy) =>
        order === 'desc'
            ? (a, b) => descendingComparator(a, b, orderBy)
            : (a, b) => -descendingComparator(a, b, orderBy);

    const stableSort = (array, comparator) =>
        array
            .map((el, index) => [el, index])
            .sort((a, b) => {
                const cmp = comparator(a[0], b[0]);
                return cmp !== 0 ? cmp : a[1] - b[1];
            })
            .map(el => el[0]);

    const campañasOrdenadas = stableSort(campañasMostradas, getComparator(order, orderBy));
    const campañasPaginadas = campañasOrdenadas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleChangeTab = (_, newValue) => {
        setTab(newValue);
        setPage(0);
    };

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const handleChangePage = (_, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const confirmarEliminar = (campaña) => {
        setCampañaAEliminar(campaña);
        setConfirmarEliminacion(true);
    };

    const eliminarCampaña = async () => {
        if (!campañaAEliminar) return;
        try {
            await api.delete(`/campanias/${campañaAEliminar.id}`);
            setMensaje({ tipo: 'success', texto: 'Campaña eliminada correctamente' });
            setSnackbarOpen(true);
            cargarCampañas();
        } catch (err) {
            console.error('Error al eliminar campaña', err);
            setMensaje({ tipo: 'error', texto: 'No se pudo eliminar la campaña' });
            setSnackbarOpen(true);
        } finally {
            setConfirmarEliminacion(false);
            setCampañaAEliminar(null);
        }
    };

    const pausarCampaña = async (id) => {
        setProcesandoCampañaId(id);
        try {
            await api.post(`/campanias/${id}/pausar`);
            const ok = await esperarCambioEstado(id, 'pausada');
            if (ok) {
                setMensaje({ tipo: 'success', texto: 'Campaña pausada exitosamente' });
            } else {
                setMensaje({ tipo: 'warning', texto: 'Se solicitó pausar, pero no se confirmó a tiempo' });
            }
        } catch (err) {
            console.error('Error al pausar campaña', err);
            setMensaje({ tipo: 'error', texto: 'No se pudo pausar la campaña' });
        } finally {
            setSnackbarOpen(true);
            await cargarCampañas();
            setProcesandoCampañaId(null);
        }
    };
    
    const reanudarCampaña = async (id) => {
        setProcesandoCampañaId(id);
        try {
            await api.post(`/campanias/${id}/reanudar`);
            const ok = await esperarCambioEstado(id, 'procesando');
            if (ok) {
                setMensaje({ tipo: 'success', texto: 'Campaña reanudada exitosamente' });
            } else {
                setMensaje({ tipo: 'warning', texto: 'Se solicitó reanudar, pero no se confirmó a tiempo' });
            }
        } catch (err) {
            console.error('Error al reanudar campaña', err);
            setMensaje({ tipo: 'error', texto: 'No se pudo reanudar la campaña' });
        } finally {
            setSnackbarOpen(true);
            await cargarCampañas();
            setProcesandoCampañaId(null);
        }
    };    

    const esperarCambioEstado = async (id, estadoEsperado, maxIntentos = 25, intervalo = 2000) => {
        let intentos = 0;
        while (intentos < maxIntentos) {
            const res = await api.get(`/campanias/${id}`);
            if (res.data.estado === estadoEsperado) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, intervalo));
            intentos++;
        }
        return false; // Timeout
    };
    


    return (
        <>
            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Campañas</Typography>

                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setModalNueva(true)}
                    sx={{ mb: 2, backgroundColor: '#075E54', fontFamily: commonFont, textTransform: 'none' }}
                >
                    Nueva campaña
                </Button>

                <Tabs value={tab} onChange={handleChangeTab} sx={{ mb: 2 }}>
                    <Tab label={`Pendientes (${pendientes.length})`} />
                    <Tab label={`Procesando (${procesando.length})`} />
                    <Tab label={`Enviadas (${enviadas.length})`} />
                </Tabs>

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>
                                <TableSortLabel
                                    active={orderBy === 'nombre'}
                                    direction={order}
                                    onClick={() => handleRequestSort('nombre')}
                                >
                                    Nombre
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="right">Contactos</TableCell>
                            <TableCell>Creado</TableCell>
                            <TableCell>Enviado</TableCell>
                            <TableCell>Estado</TableCell>
                            <TableCell>Acciones</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {campañasPaginadas.map(c => (
                            <TableRow key={c.id}>
                                <TableCell sx={{ cursor: 'pointer' }} onClick={() => setCampañaSeleccionada(c)}>
                                    {c.nombre}
                                </TableCell>
                                <TableCell align="right">{c.contactos.length}</TableCell>
                                <TableCell>{c.createdAt ? new Date(c.createdAt).toLocaleString() : '–'}</TableCell>
                                <TableCell>{c.enviadoAt ? new Date(c.enviadoAt).toLocaleString() : '–'}</TableCell>
                                <TableCell>
                                    {c.estado === 'procesando' && <Chip label="Procesando" color="info" />}
                                    {c.estado === 'pausada' && <Chip label="Pausada" color="warning" />}
                                    {c.estado === 'pendiente' && <Chip label="Pendiente" />}
                                    {c.estado === 'finalizada' && <Chip label="Finalizada" color="success" />}
                                </TableCell>
                                <TableCell>
                                    {tab === 0 && (
                                        <Button
                                            variant="outlined"
                                            startIcon={<SendIcon />}
                                            onClick={() => {
                                                setCampañaAEnviar(c);
                                                setModalEnvio(true);
                                            }}
                                            sx={{
                                                color: '#075E54',
                                                borderColor: '#075E54',
                                                '&:hover': {
                                                    borderColor: '#06493e',
                                                    backgroundColor: 'rgba(7, 94, 84, 0.08)',
                                                }
                                            }}
                                        >
                                            Enviar campaña
                                        </Button>
                                    )}

                                    {tab === 1 && (
                                        <>
                                            {c.estado === 'procesando' && (
                                                <Tooltip title="Pausar campaña">
                                                    <span>
                                                        <IconButton
                                                            color="warning"
                                                            onClick={() => pausarCampaña(c.id)}
                                                            disabled={procesandoCampañaId === c.id}
                                                        >
                                                            {procesandoCampañaId === c.id ? <CircularProgress size={24} /> : <PauseIcon />}
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            )}
                                            {c.estado === 'pausada' && (
                                                <Tooltip title="Reanudar campaña">
                                                    <span>
                                                        <IconButton
                                                            color="success"
                                                            onClick={() => reanudarCampaña(c.id)}
                                                            disabled={procesandoCampañaId === c.id}
                                                        >
                                                            {procesandoCampañaId === c.id ? <CircularProgress size={24} /> : <PlayArrowIcon />}
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            )}
                                        </>
                                    )}

                                    {(tab === 0 || tab === 2) && (
                                        <Tooltip title="Eliminar campaña">
                                            <IconButton color="error" onClick={() => confirmarEliminar(c)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {campañasPaginadas.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} align="center">No hay campañas para mostrar.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={campañasMostradas.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </Paper>

            <Dialog open={modalNueva} onClose={() => setModalNueva(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Nueva campaña</DialogTitle>
                <DialogContent dividers>
                    <SubirCampaña
                        onUploadSuccess={() => {
                            setModalNueva(false);
                            cargarCampañas();
                            setMensaje({ tipo: 'success', texto: 'Campaña subida correctamente' });
                            setSnackbarOpen(true);
                        }}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={!!campañaSeleccionada} onClose={() => setCampañaSeleccionada(null)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    Contactos de "{campañaSeleccionada?.nombre}"
                    <IconButton
                        aria-label="cerrar"
                        onClick={() => setCampañaSeleccionada(null)}
                        sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <List>
                        {campañaSeleccionada?.contactos.map((contacto, idx) => (
                            <ListItem key={idx}>
                                <ListItemText
                                    primary={`Número: ${contacto.numero}`}
                                    secondary={`Mensaje: ${contacto.mensaje}`}
                                />
                            </ListItem>
                        ))}
                        {campañaSeleccionada?.contactos.length === 0 && (
                            <Typography variant="body2">No hay contactos en esta campaña.</Typography>
                        )}
                    </List>
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

            {campañaAEnviar && (
                <EnviarMensajesModal
                    open={modalEnvio}
                    onSendSuccess={() => {
                        setModalEnvio(false);
                        cargarCampañas();
                        setSnackbarOpen(true);
                        setMensaje({ tipo: 'success', texto: 'Envío iniciado en segundo plano exitosamente' });
                    }}
                    onClose={() => setModalEnvio(false)}
                    campaña={campañaAEnviar}
                />
            )}

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