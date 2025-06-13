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
    Divider,
    IconButton,
    Button,
    Chip,
    TablePagination,
    Tabs,
    Tab,
    TableSortLabel,
    Tooltip,
    DialogActions,
    Snackbar,
    useMediaQuery,
    Box,
    TextField
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
import { io } from 'socket.io-client';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import EventIcon from '@mui/icons-material/Event';
import { useTheme } from '@mui/material/styles';
import InboxIcon from '@mui/icons-material/Inbox';

export default function VerCampañas() {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const isMobile = useMediaQuery('(max-width:768px)');
    const [campañas, setCampañas] = useState([]);
    const [campañaSeleccionada, setCampañaSeleccionada] = useState(null);
    const [modalNueva, setModalNueva] = useState(false);
    const [modalEnvio, setModalEnvio] = useState(false);
    const [campañaAEnviar, setCampañaAEnviar] = useState(null);
    const [campañaAEliminar, setCampañaAEliminar] = useState(null);
    const [confirmarEliminacion, setConfirmarEliminacion] = useState(false);
    const [tab, setTab] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [order, setOrder] = useState('asc');
    const [orderBy, setOrderBy] = useState('nombre');
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
    const [progresos, setProgresos] = useState({});
    const [pausando, setPausando] = useState([]);
    const [mostrarCalendario, setMostrarCalendario] = useState(false);
    const [filtroTexto, setFiltroTexto] = useState('');

    const theme = useTheme();
    const codeStyle = {
        backgroundColor: theme.palette.mode === 'dark' ? '#2e2e2e' : '#f4f4f4',
        color: theme.palette.mode === 'dark' ? '#fff' : '#000',
        padding: '2px 6px',
        borderRadius: 4,
        fontFamily: 'monospace',
    };

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

    useEffect(() => {
        const socket = io(import.meta.env.VITE_HOST_SOCKET); // cambiar si tenés otro host

        campañas.forEach((campaña) => {
            if (campaña.estado === 'procesando') {
                socket.emit('join_campaña', campaña.id);
            }
        });

        socket.on('campania_estado', ({ campaña, estado }) => {
            console.log('llega evento de campaña programada')
            cargarCampañas();
        });

        socket.on('progreso', ({ enviados, total, campañaId }) => {
            setProgresos((prev) => ({
                ...prev,
                [campañaId]: { enviados, total }
            }));
        });

        socket.on('campania_finalizada', ({ campañaId }) => {
            cargarCampañas(); // recarga la lista de campañas desde backend
        });

        socket.on('campania_pausada', ({ campañaId }) => {
            setPausando((prev) => prev.filter(id => id !== campañaId));
            setMensaje({ tipo: 'success', texto: `Campaña ${campañaId} pausada exitosamente` });
            setSnackbarOpen(true);
            cargarCampañas();
        });

        return () => socket.disconnect();
    }, [campañas]);


    const agendadas = campañas.filter(c => c.estado === 'programada');
    const pendientes = campañas.filter(c => c.estado === 'pendiente');
    const procesando = campañas.filter(c => ['procesando', 'pausada', 'pausa_pendiente'].includes(c.estado));
    const enviadas = campañas.filter(c => c.estado === 'finalizada');
    const campañasPorTab =
        tab === 0 ? pendientes :
            tab === 1 ? agendadas :
                tab === 2 ? procesando :
                    enviadas;

    const campañasMostradas = campañasPorTab.filter((c) =>
        c.nombre.toLowerCase().includes(filtroTexto.toLowerCase())
    );

    const mensajesPorTab = {
        0: 'No hay campañas pendientes.',
        1: 'No hay campañas agendadas.',
        2: 'No hay campañas procesando.',
        3: 'No hay campañas enviadas.'
    };

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
        array.map((el, index) => [el, index])
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

    const abrirModalEnvio = (campaña) => {
        setMostrarCalendario(false);
        setCampañaAEnviar(campaña);
        setModalEnvio(true);
    };

    const abrirModalAgendar = (campaña) => {
        setMostrarCalendario(true);
        setCampañaAEnviar(campaña);
        setModalEnvio(true);
    };

    const pausarCampaña = async (campaña) => {
        setPausando((prev) => [...prev, campaña.id]);
        try {
            await api.post(`/campanias/${campaña.id}/pausar`);
            // setMensaje({ tipo: 'success', texto: 'Campaña pausada' });
            // setSnackbarOpen(true);
            // cargarCampañas();
        } catch (err) {
            console.error('Error al pausar campaña', err);
            setMensaje({ tipo: 'error', texto: 'No se pudo pausar la campaña' });
            setSnackbarOpen(true);
        }
    };

    const reanudarCampaña = async (campaña) => {
        try {
            await api.post(`/campanias/${campaña.id}/reanudar`);
            setMensaje({ tipo: 'success', texto: 'Campaña reanudada' });
            setSnackbarOpen(true);
            cargarCampañas();
        } catch (err) {
            console.error('Error al reanudar campaña', err);
            setMensaje({ tipo: 'error', texto: 'No se pudo reanudar la campaña' });
            setSnackbarOpen(true);
        }
    };

    return (
        <Box
            sx={{
                py: 3,
                transition: 'all 0.1s ease'
            }}
        >
            <Paper
                elevation={1}
                sx={{
                    width: '100%',
                    overflowX: 'auto',
                    maxWidth: 'none',
                    p: isMobile ? 1 : 3,
                    boxShadow: 'none',
                }}
            >
                <Box display="flex" flexDirection={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'flex-start' : 'center'} gap={2}>
                    <Typography variant="h6">Campañas</Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setModalNueva(true)}
                        sx={{
                            borderRadius: 2,
                            fontFamily: commonFont,
                            textTransform: 'none',
                            fontSize: '0.9rem',
                            backgroundColor: '#075E54',
                            transition: 'all 0.3s ease',
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

                <Tabs
                    value={tab}
                    onChange={handleChangeTab}
                    variant={isMobile ? 'scrollable' : 'standard'}
                    scrollButtons={isMobile ? 'auto' : false}
                    sx={{ my: 2 }}
                >
                    <Tab label={`Pendientes (${pendientes.length})`} />
                    <Tab label={`Agendadas (${agendadas.length})`} />
                    <Tab label={`Procesando (${procesando.length})`} />
                    <Tab label={`Enviadas (${enviadas.length})`} />
                </Tabs>

                <Box mb={2}>
                    <TextField
                        fullWidth
                        label="Buscar campañas"
                        variant="outlined"
                        value={filtroTexto}
                        onChange={(e) => setFiltroTexto(e.target.value)}
                        placeholder="Buscar por nombre..."
                    />
                </Box>

                <Box overflow="auto">
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
                            {campañasPaginadas.map((c) => (
                                <React.Fragment key={c.id}>
                                    <TableRow hover onClick={() => setCampañaSeleccionada(c)} sx={{ cursor: 'pointer' }}>
                                        <TableCell
                                            sx={{
                                                maxWidth: 200,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}
                                        >
                                            <Tooltip title={c.nombre}>
                                                <span>{c.nombre}</span>
                                            </Tooltip>
                                        </TableCell>
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
                                </React.Fragment>
                            ))}

                            {campañasPaginadas.length === 0 && (
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
                </Box>

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
                            <React.Fragment key={idx}>
                                <ListItem alignItems="flex-start" sx={{ flexDirection: 'column', alignItems: 'stretch', px: 1.5 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                        📞 Número: <code tyle={codeStyle}>{contacto.numero}</code>
                                    </Typography>

                                    {contacto.mensaje && (
                                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                                            📨 Mensaje: <code tyle={codeStyle}>{contacto.mensaje}</code>
                                        </Typography>
                                    )}

                                    {contacto.datos && Object.keys(contacto.datos).length > 0 && (
                                        <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>🧾 Datos:</Typography>
                                            <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                                {Object.entries(contacto.datos).map(([key, value]) => (
                                                    <li key={key}>
                                                        <Typography variant="body2">
                                                            <strong>{key}:</strong>{' '}
                                                            <code tyle={codeStyle}>{String(value)}</code>
                                                        </Typography>
                                                    </li>
                                                ))}
                                            </Box>
                                        </Box>
                                    )}
                                </ListItem>
                                <Divider sx={{ my: 1 }} />
                            </React.Fragment>
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
                    mostrarCalendario={mostrarCalendario}
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
        </Box>
    );
}