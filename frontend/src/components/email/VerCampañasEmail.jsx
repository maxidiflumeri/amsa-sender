import React, { useEffect, useState } from 'react';
import {
    Divider,
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
    IconButton,
    CircularProgress,
    Backdrop
} from '@mui/material';
import api from '../../api/axios';
import { useTheme } from '@mui/material/styles';
import SubirCampañaModal from './SubirCampañaModal';
import InboxIcon from '@mui/icons-material/Inbox';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import EventIcon from '@mui/icons-material/Event';
import MuiAlert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import { FixedSizeList } from 'react-window';
import EnviarMailsModal from './EnviarMails';
import CampaignIcon from '@mui/icons-material/Campaign';
import { io } from 'socket.io-client';
import Skeleton from '@mui/material/Skeleton'

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
    const [modalEnvio, setModalEnvio] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
    const [campañaAEnviar, setCampañaAEnviar] = useState(null);
    const [campañaAEliminar, setCampañaAEliminar] = useState(null);
    const [confirmarEliminacion, setConfirmarEliminacion] = useState(false);
    const [campañaSeleccionada, setCampañaSeleccionada] = useState(null);
    const [loadingContactos, setLoadingContactos] = useState(false);
    const [busquedaContacto, setBusquedaContacto] = useState('');
    const [mostrarCalendario, setMostrarCalendario] = useState(false);
    const [loading, setLoading] = useState(true);

    const cargarCampanias = async (opts = { silent: false }) => {
        if (!opts.silent) setLoading(true);
        try {
            const res = await api.get('/email/campanias');
            setCampanias(res.data);
        } catch (err) {
            console.error('Error al obtener campañas:', err);
        } finally {
            if (!opts.silent) setLoading(false);
        }
    };

    useEffect(() => {
        cargarCampanias();
    }, []);

    useEffect(() => {
        const socket = io(import.meta.env.VITE_HOST_SOCKET);

        campanias.forEach((campaña) => {
            if (campaña.estado === 'procesando') {
                socket.emit('join_campaña', campaña.id);
            }
        });

        socket.on('progreso_mail', ({ campañaId, enviados, total }) => {
            setProgresos((prev) => ({
                ...prev,
                [campañaId]: { enviados, total }
            }));
        });

        socket.on('campania_estado', ({ campañaId, estado }) => {
            setCampanias(prev =>
                prev.map(c =>
                    c.id === campañaId ? { ...c, estado, progreso: estado === 'finalizada' ? 100 : c.progreso } : c
                )
            );
        });

        socket.on('campania_finalizada', ({ campañaId }) => {
            cargarCampanias(); // recarga la lista de campañas desde backend
        });

        return () => {
            socket.disconnect();
        };
    }, [campanias]);

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

    const handleCloseDialogContacts = () => {
        setCampañaSeleccionada(null);
        setBusquedaContacto('');
        setLoadingContactos(false);
    }

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

    const handleAbrirDialogoContactos = async (campania) => {
        setLoadingContactos(true);
        // Simular pequeño delay, o cargar contactos si no están en el objeto
        setTimeout(() => {
            setCampañaSeleccionada(campania);
            setLoadingContactos(false);
        }, 400); // o el tiempo real de carga
    };

    const contactosFiltrados = Array.isArray(campañaSeleccionada?.contactos)
        ? campañaSeleccionada.contactos.filter((contacto) => {
            const query = busquedaContacto.toLowerCase();
            return (
                contacto.email?.toLowerCase().includes(query) ||
                contacto.datos?.nombre?.toLowerCase().includes(query)
            );
        })
        : [];

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

    const SkeletonRow = () => (
        <TableRow>
            <TableCell><Skeleton variant="text" width="80%" /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={40} /></TableCell>
            <TableCell><Skeleton variant="text" width="60%" /></TableCell>
            <TableCell><Skeleton variant="text" width="60%" /></TableCell>
            <TableCell><Skeleton variant="rounded" width={100} height={28} /></TableCell>
            <TableCell><Skeleton variant="text" width="70%" /></TableCell>
            <TableCell>
                <Skeleton variant="rounded" height={8} />
                <Skeleton variant="text" width="50%" />
            </TableCell>
            <TableCell>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Skeleton variant="circular" width={36} height={36} />
                    <Skeleton variant="circular" width={36} height={36} />
                    <Skeleton variant="circular" width={36} height={36} />
                </Box>
            </TableCell>
        </TableRow>
    );

    return (
        <>
            <Box sx={{ py: 3 }}>
                <Paper elevation={3} sx={{ p: isMobile ? 2 : 4 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Box display="flex" alignItems="center">
                            <CampaignIcon sx={{ fontSize: 32 }} />
                            <Typography ml={1} variant="h5" fontWeight="bold">Campañas Email</Typography>
                        </Box>
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

                    {loading && <LinearProgress sx={{ mt: 1, borderRadius: 1 }} />}

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
                            {loading
                                ? Array.from({ length: rowsPerPage }).map((_, i) => (
                                    <SkeletonRow key={`sk-${i}`} />
                                ))
                                : campaniasPaginadas.map((c) => (
                                    <React.Fragment key={c.id}>
                                        <TableRow
                                            hover
                                            onClick={() => handleAbrirDialogoContactos(c)}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            <TableCell>{c.nombre}</TableCell>
                                            <TableCell align="right" sx={{ maxWidth: 5 }}>
                                                {c.contactos.length}
                                            </TableCell>
                                            <TableCell>
                                                {c.createdAt ? new Date(c.createdAt).toLocaleString() : '–'}
                                            </TableCell>
                                            <TableCell>
                                                {c.enviadoAt ? new Date(c.enviadoAt).toLocaleString() : '–'}
                                            </TableCell>
                                            <TableCell>
                                                {c.estado === 'procesando' && <Chip label="Procesando" color="info" />}
                                                {c.estado === 'pausada' && <Chip label="Pausada" color="warning" />}
                                                {c.estado === 'pendiente' && <Chip label="Pendiente" />}
                                                {c.estado === 'finalizada' && <Chip label="Finalizada" color="success" />}
                                                {c.estado === 'programada' && <Chip label="Programada" color="info" />}
                                                {c.estado === 'pausa_pendiente' && <Chip label="Pausa en cola" color="warning" />}
                                            </TableCell>
                                            <TableCell>
                                                {c.agendadoAt ? new Date(c.agendadoAt).toLocaleString() : '—'}
                                            </TableCell>
                                            <TableCell>
                                                {c.estado === 'procesando' && (
                                                    <Box width={100}>
                                                        <LinearProgress
                                                            variant={progresos[c.id] ? 'determinate' : 'indeterminate'}
                                                            value={
                                                                progresos[c.id]
                                                                    ? (progresos[c.id].enviados / progresos[c.id].total) * 100
                                                                    : 0
                                                            }
                                                            sx={{ height: 8, borderRadius: 4 }}
                                                        />
                                                        <Typography variant="caption">
                                                            {progresos[c.id]
                                                                ? `${progresos[c.id].enviados}/${progresos[c.id].total}`
                                                                : '...'}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </TableCell>
                                            <TableCell
                                                onClick={(e) => e.stopPropagation()}
                                                sx={{ whiteSpace: 'nowrap', minWidth: 120 }}
                                            >
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
                                                {(c.estado === 'pendiente' ||
                                                    c.estado === 'pausada' ||
                                                    c.estado === 'finalizada' ||
                                                    c.estado === 'programada') && (
                                                        <Tooltip title="Eliminar campaña">
                                                            <IconButton color="error" onClick={() => confirmarEliminar(c)}>
                                                                <DeleteIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))
                            }

                            {!loading && campaniasPaginadas.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8}>
                                        <Box
                                            sx={{
                                                textAlign: 'center',
                                                py: 6,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                color: 'text.secondary',
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

            <Dialog open={!!campañaSeleccionada} onClose={handleCloseDialogContacts} maxWidth="md" fullWidth>
                {campañaSeleccionada && (
                    <>
                        <DialogTitle>
                            Contactos de "{campañaSeleccionada?.nombre}"
                            <IconButton
                                aria-label="cerrar"
                                onClick={handleCloseDialogContacts}
                                sx={{ position: 'absolute', right: 8, top: 8 }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent dividers>
                            <Box mb={2}>
                                <TextField
                                    fullWidth
                                    label="Buscar por email o nombre"
                                    value={busquedaContacto}
                                    onChange={(e) => setBusquedaContacto(e.target.value)}
                                    placeholder="Ej: juan@mail.com o Juan Pérez"
                                />
                            </Box>
                            <FixedSizeList
                                width="100%"
                                itemSize={800} // ajustá según el alto de cada ítem (puede ser 120-180)
                                itemCount={contactosFiltrados.length}
                                itemData={contactosFiltrados}
                                height={window.innerHeight - 300}
                            >
                                {({ index, style, data }) => {
                                    const contacto = data[index];
                                    return (
                                        <div style={style} key={index}>
                                            <Box sx={{ px: 2, py: 1 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                                    📧 Email: <code>{contacto.email}</code>
                                                </Typography>
                                                {contacto.datos?.nombre && (
                                                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                                        🧑🏽 Nombre: <code>{contacto.datos.nombre}</code>
                                                    </Typography>
                                                )}
                                                {contacto.datos && Object.keys(contacto.datos).length > 0 && (
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>🧾 Datos:</Typography>
                                                        <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                                            {Object.entries(contacto.datos).map(([key, value]) => (
                                                                <li key={key}>
                                                                    <Typography variant="body2">
                                                                        <strong>{key}:</strong> <code>{String(value)}</code>
                                                                    </Typography>
                                                                </li>
                                                            ))}
                                                        </Box>
                                                    </Box>
                                                )}
                                            </Box>
                                            <Divider sx={{ my: 1 }} />
                                        </div>
                                    );
                                }}
                            </FixedSizeList>
                        </DialogContent>
                    </>
                )}
            </Dialog>

            <Backdrop
                open={loadingContactos}
                sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.modal + 1 }}
            >
                <CircularProgress color="inherit" />
            </Backdrop>

            {campañaAEnviar && (
                <EnviarMailsModal
                    open={modalEnvio}
                    onSendSuccess={() => {
                        setModalEnvio(false);
                        cargarCampanias();
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
        </>
    );
}