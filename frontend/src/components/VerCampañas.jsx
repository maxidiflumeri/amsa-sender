import React, { useEffect, useRef, useState } from 'react';
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
    TextField,
    Stack,
    TableContainer
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import PauseIcon from '@mui/icons-material/Pause';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MuiAlert from '@mui/material/Alert';
import api from '../api/axios';
import SubirCampaña from './SubirCampaña';
import EnviarMensajesModal from './EnviarMensajes';
import { io } from 'socket.io-client';
import CampañaLogModal from './CampañaLogModal';
import TerminalIcon from '@mui/icons-material/Terminal';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import EventIcon from '@mui/icons-material/Event';
import { useTheme } from '@mui/material/styles';
import InboxIcon from '@mui/icons-material/Inbox';
import CampaignIcon from '@mui/icons-material/Campaign';
import Skeleton from '@mui/material/Skeleton'
import RefreshIcon from '@mui/icons-material/Refresh';
import WifiOffIcon from '@mui/icons-material/WifiOff';

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
    const [campañaACerrar, setCampañaACerrar] = useState(null);
    const [forzandoCierre, setForzandoCierre] = useState(false);
    const [filtroTexto, setFiltroTexto] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalLog, setModalLog] = useState(null); // { id, nombre }
    const [campaniasBloqueadas, setCampaniasBloqueadas] = useState(new Set());
    const ultimoProgresoRef = useRef({}); // { [campañaId]: timestamp del último evento de progreso }
    const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos sin progreso = campaña bloqueada

    const theme = useTheme();
    const codeStyle = {
        backgroundColor: theme.palette.mode === 'dark' ? '#2e2e2e' : '#f4f4f4',
        color: theme.palette.mode === 'dark' ? '#fff' : '#000',
        padding: '2px 6px',
        borderRadius: 4,
        fontFamily: 'monospace',
    };

    const cargarCampañas = async (opts = { silent: false }) => {
        if (!opts.silent) setLoading(true);
        try {
            const res = await api.get('/whatsapp/campanias');
            setCampañas(res.data);
        } catch (err) {
            console.error('Error al obtener campañas:', err);
        } finally {
            if (!opts.silent) setLoading(false);
        }
    };

    useEffect(() => {
        cargarCampañas();
    }, []);

    useEffect(() => {
        const socket = io(import.meta.env.VITE_HOST_SOCKET);

        campañas.forEach((campaña) => {
            if (campaña.estado === 'procesando') {
                socket.emit('join_campaña', campaña.id);
                // Inicializar timestamp si aún no se rastreó esta campaña
                if (!ultimoProgresoRef.current[campaña.id]) {
                    ultimoProgresoRef.current[campaña.id] = Date.now();
                }
            }
        });

        socket.on('campania_estado', ({ campaña, estado }) => {
            cargarCampañas();
        });

        socket.on('progreso', ({ enviados, total, campañaId }) => {
            ultimoProgresoRef.current[campañaId] = Date.now();
            // Si recibimos progreso, la campaña ya no está bloqueada
            setCampaniasBloqueadas(prev => {
                if (!prev.has(campañaId)) return prev;
                const next = new Set(prev);
                next.delete(campañaId);
                return next;
            });
            setProgresos((prev) => ({
                ...prev,
                [campañaId]: { enviados, total }
            }));
        });

        socket.on('campania_finalizada', ({ campañaId }) => {
            delete ultimoProgresoRef.current[campañaId];
            setCampaniasBloqueadas(prev => {
                const next = new Set(prev);
                next.delete(campañaId);
                return next;
            });
            cargarCampañas();
        });

        socket.on('campania_pausada', ({ campañaId }) => {
            delete ultimoProgresoRef.current[campañaId];
            setCampaniasBloqueadas(prev => {
                const next = new Set(prev);
                next.delete(campañaId);
                return next;
            });
            setPausando((prev) => prev.filter(id => id !== campañaId));
            setMensaje({ tipo: 'success', texto: `Campaña ${campañaId} pausada exitosamente` });
            setSnackbarOpen(true);
            cargarCampañas();
        });

        socket.on('campania_error', ({ campañaId }) => {
            // El backend detectó un error: mostrar el botón de forzar cierre inmediatamente
            setCampaniasBloqueadas(prev => new Set([...prev, campañaId]));
            cargarCampañas();
        });

        socket.on('campania_envio_reanudado', ({ campañaId, segundosPausado }) => {
            const nombre = campañas.find(c => c.id === campañaId)?.nombre || `#${campañaId}`;
            const duracion = segundosPausado >= 60
                ? `${Math.floor(segundosPausado / 60)}m ${segundosPausado % 60}s`
                : `${segundosPausado}s`;
            setMensaje({
                tipo: 'warning',
                texto: `El envío de "${nombre}" se pausó ${duracion} por un problema de conexión y se reanudó automáticamente.`,
            });
            setSnackbarOpen(true);
        });

        return () => socket.disconnect();
    }, [campañas]);

    // Timer: cada 30s verifica si alguna campaña en "procesando" lleva más de 5 min sin progreso
    useEffect(() => {
        const interval = setInterval(() => {
            const procesandoIds = campañas
                .filter(c => c.estado === 'procesando')
                .map(c => c.id);
            if (!procesandoIds.length) return;
            const now = Date.now();
            setCampaniasBloqueadas(prev => {
                let changed = false;
                const next = new Set(prev);
                for (const id of procesandoIds) {
                    const last = ultimoProgresoRef.current[id];
                    if (!last || now - last > STUCK_THRESHOLD_MS) {
                        if (!next.has(id)) { next.add(id); changed = true; }
                    }
                }
                return changed ? next : prev;
            });
        }, 30_000);
        return () => clearInterval(interval);
    }, [campañas]);


    const agendadas = campañas.filter(c => c.estado === 'programada');
    const pendientes = campañas.filter(c => c.estado === 'pendiente');
    const procesando = campañas.filter(c => ['procesando', 'pausada', 'pausa_pendiente', 'error'].includes(c.estado));
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

    const handleForzarCierre = async (campaña, nuevoEstado) => {
        setForzandoCierre(true);
        try {
            await api.post(`/whatsapp/campanias/${campaña.id}/forzar-cierre`, { estado: nuevoEstado });
            setMensaje({ tipo: 'success', texto: `Campaña marcada como "${nuevoEstado}"` });
            setSnackbarOpen(true);
            setCampañaACerrar(null);
            cargarCampañas();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: err.response?.data?.message || 'No se pudo forzar el cierre' });
            setSnackbarOpen(true);
        } finally {
            setForzandoCierre(false);
        }
    };

    const eliminarCampaña = async () => {
        if (!campañaAEliminar) return;
        try {
            await api.delete(`/whatsapp/campanias/${campañaAEliminar.id}`);
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
            await api.post(`/whatsapp/campanias/${campaña.id}/pausar`);
        } catch (err) {
            console.error('Error al pausar campaña', err);
            setMensaje({ tipo: 'error', texto: 'No se pudo pausar la campaña' });
            setSnackbarOpen(true);
        }
    };

    const reanudarCampaña = async (campaña) => {
        try {
            await api.post(`/whatsapp/campanias/${campaña.id}/reanudar`);
            setMensaje({ tipo: 'success', texto: 'Campaña reanudada' });
            setSnackbarOpen(true);
            cargarCampañas();
        } catch (err) {
            console.error('Error al reanudar campaña', err);
            setMensaje({ tipo: 'error', texto: 'No se pudo reanudar la campaña' });
            setSnackbarOpen(true);
        }
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
        <Box sx={{ py: 3, transition: 'all 0.1s ease' }}>
            <Paper
                elevation={1}
                sx={{
                    width: '100%',
                    overflowX: 'auto',
                    maxWidth: 'none',
                    p: isMobile ? 2 : 4,
                    boxShadow: 'none',
                }}
            >
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                    spacing={1.5}
                >
                    <Box display="flex" alignItems="center" sx={{ minWidth: 0 }}>
                        <CampaignIcon sx={{ fontSize: 32 }} />
                        <Typography ml={1} variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Campañas WhatsApp
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }} justifyContent={{ xs: 'flex-end', sm: 'flex-end' }} flexWrap="wrap" useFlexGap>
                        <Tooltip title="Refrescar"><IconButton onClick={cargarCampañas}><RefreshIcon /></IconButton></Tooltip>
                        <Button
                            fullWidth={isMobile}
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
                                    transform: { md: 'scale(1.03)' },
                                    boxShadow: 4,
                                },
                            }}
                        >
                            Nueva campaña
                        </Button>
                    </Stack>
                </Stack>

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

                {loading && <LinearProgress sx={{ mt: 1, borderRadius: 1 }} />}

                <Box mb={2}>
                    <TextField
                        fullWidth
                        label="Buscar campañas"
                        variant="outlined"
                        value={filtroTexto}
                        onChange={(e) => setFiltroTexto(e.target.value)}
                        placeholder="Buscar por nombre..."
                        size={isMobile ? 'small' : 'medium'}
                    />
                </Box>

                <TableContainer sx={{ overflowX: 'auto', borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
                    <Table size={isMobile ? 'small' : 'medium'} stickyHeader sx={{ minWidth: 960 }}>
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
                                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                    <TableSortLabel
                                        active={orderBy === 'createdAt'}
                                        direction={orderBy === 'createdAt' ? order : 'asc'}
                                        onClick={() => handleRequestSort('createdAt')}
                                    >
                                        Creado
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                    <TableSortLabel
                                        active={orderBy === 'enviadoAt'}
                                        direction={orderBy === 'enviadoAt' ? order : 'asc'}
                                        onClick={() => handleRequestSort('enviadoAt')}
                                    >
                                        Enviado
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>Estado</TableCell>
                                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                    <TableSortLabel
                                        active={orderBy === 'agendadoAt'}
                                        direction={orderBy === 'agendadoAt' ? order : 'asc'}
                                        onClick={() => handleRequestSort('agendadoAt')}
                                    >
                                        Agendada para
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Progreso</TableCell>
                                <TableCell>Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading
                                ? Array.from({ length: rowsPerPage }).map((_, i) => <SkeletonRow key={`sk-${i}`} />)
                                : campañasPaginadas.map((c) => (
                                    <React.Fragment key={c.id}>
                                        <TableRow hover onClick={() => setCampañaSeleccionada(c)} sx={{ cursor: 'pointer' }}>
                                            <TableCell sx={{ maxWidth: 240 }}>
                                                <Stack spacing={0.3}>
                                                    <Tooltip title={c.nombre}>
                                                        <Typography sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {c.nombre}
                                                        </Typography>
                                                    </Tooltip>

                                                    {/* Sub-info para XS cuando se ocultan columnas */}
                                                    <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                                                            {c.estado === 'procesando' && <Chip size="small" label="Procesando" color="info" />}
                                                            {c.estado === 'pausada' && <Chip size="small" label="Pausada" color="warning" />}
                                                            {c.estado === 'pendiente' && <Chip size="small" label="Pendiente" />}
                                                            {c.estado === 'finalizada' && <Chip size="small" label="Finalizada" color="success" />}
                                                            {c.estado === 'programada' && <Chip size="small" label="Programada" color="info" />}
                                                            {c.estado === 'pausa_pendiente' && <Chip size="small" label="Pausa en cola" color="warning" />}
                                                            {c.estado === 'error' && <Chip size="small" label="Error" color="error" icon={<WarningAmberIcon />} />}
                                                        </Stack>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            {c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}
                                                            {c.agendadoAt ? ` · Agendada: ${new Date(c.agendadoAt).toLocaleString()}` : ''}
                                                        </Typography>
                                                        {c.estado === 'procesando' && (
                                                            <Box sx={{ mt: 0.5 }}>
                                                                <LinearProgress
                                                                    variant={progresos[c.id] ? 'determinate' : 'indeterminate'}
                                                                    value={progresos[c.id] ? (progresos[c.id].enviados / progresos[c.id].total) * 100 : 0}
                                                                    sx={{ height: 6, borderRadius: 3, maxWidth: 160 }}
                                                                />
                                                            </Box>
                                                        )}
                                                    </Box>
                                                </Stack>
                                            </TableCell>

                                            <TableCell align="right" sx={{ maxWidth: 5 }}>{c.contactos.length}</TableCell>
                                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                                {c.createdAt ? new Date(c.createdAt).toLocaleString() : '–'}
                                            </TableCell>
                                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
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
                                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                                {c.agendadoAt ? new Date(c.agendadoAt).toLocaleString() : '—'}
                                            </TableCell>
                                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                                {c.estado === 'procesando' && (
                                                    <Box width={120}>
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
                                                            <IconButton size={isMobile ? 'small' : 'medium'} color="primary" onClick={() => abrirModalEnvio(c)}>
                                                                <SendIcon />
                                                            </IconButton>
                                                        </Tooltip>

                                                        <Tooltip title="Agendar campaña">
                                                            <IconButton size={isMobile ? 'small' : 'medium'} color="secondary" onClick={() => abrirModalAgendar(c)}>
                                                                <EventIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </>
                                                )}

                                                {c.estado === 'procesando' && (
                                                    <Tooltip title="Ver logs en tiempo real">
                                                        <IconButton size={isMobile ? 'small' : 'medium'} color="info" onClick={() => setModalLog({ id: c.id, nombre: c.nombre })}>
                                                            <TerminalIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {c.estado === 'procesando' || c.estado === 'pausa_pendiente' ? (
                                                    pausando.includes(c.id) || c.estado === 'pausa_pendiente' ? (
                                                        <Tooltip title={c.estado === 'pausa_pendiente' ? "Pausa ya solicitada" : "Pausando..."}>
                                                            <IconButton size={isMobile ? 'small' : 'medium'} disabled>
                                                                {c.estado === 'pausa_pendiente' ? <PauseIcon /> : <CircularProgress size={20} />}
                                                            </IconButton>
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip title="Pausar campaña">
                                                            <IconButton size={isMobile ? 'small' : 'medium'} color="warning" onClick={() => pausarCampaña(c)}>
                                                                <PauseIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )
                                                ) : null}
                                                {c.estado === 'procesando' && campaniasBloqueadas.has(c.id) && (
                                                    <Tooltip title="Campaña bloqueada — forzar cierre">
                                                        <IconButton size={isMobile ? 'small' : 'medium'} color="error" onClick={() => setCampañaACerrar(c)}>
                                                            <BlockIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {c.estado === 'pausada' && (
                                                    <Tooltip title="Reanudar campaña">
                                                        <IconButton size={isMobile ? 'small' : 'medium'} color="info" onClick={() => reanudarCampaña(c)}>
                                                            <PlayArrowIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {c.estado === 'error' && (
                                                    <>
                                                        <Tooltip title="Marcar como finalizada">
                                                            <IconButton size={isMobile ? 'small' : 'medium'} color="success" onClick={() => handleForzarCierre(c, 'finalizada')}>
                                                                <CheckCircleOutlineIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Eliminar campaña">
                                                            <IconButton size={isMobile ? 'small' : 'medium'} color="error" onClick={() => confirmarEliminar(c)}>
                                                                <DeleteIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </>
                                                )}
                                                {(c.estado === 'pendiente' || c.estado === 'pausada' || c.estado === 'finalizada' || c.estado === 'programada') && (
                                                    <Tooltip title="Eliminar campaña">
                                                        <IconButton size={isMobile ? 'small' : 'medium'} color="error" onClick={() => confirmarEliminar(c)}>
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))
                            }

                            {loading && campañasPaginadas.length === 0 && (
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
                </TableContainer>

                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={campañasMostradas.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    sx={{
                        '.MuiTablePagination-toolbar': { px: { xs: 0.5, sm: 2 } },
                        '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                            fontSize: { xs: 12, sm: 14 }
                        }
                    }}
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
                                        📞 Número:{' '}
                                        <Box component="code" sx={codeStyle}>{contacto.numero}</Box>
                                    </Typography>

                                    {contacto.mensaje && (
                                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                                            📨 Mensaje:{' '}
                                            <Box component="code" sx={codeStyle}>{contacto.mensaje}</Box>
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
                                                            <Box component="code" sx={codeStyle}>{String(value)}</Box>
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

            {/* Dialog: forzar cierre de campaña bloqueada */}
            <Dialog open={!!campañaACerrar} onClose={() => setCampañaACerrar(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningAmberIcon color="warning" />
                    Forzar cierre de campaña
                </DialogTitle>
                <DialogContent dividers>
                    <Typography mb={2}>
                        La campaña <strong>"{campañaACerrar?.nombre}"</strong> parece estar bloqueada en "Procesando".
                        Podés forzar su cierre eligiendo el estado final.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Si el proceso de envío sigue corriendo en el servidor, finalizará por su cuenta y actualizará el estado.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCampañaACerrar(null)} color="inherit" disabled={forzandoCierre}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => handleForzarCierre(campañaACerrar, 'finalizada')}
                        color="success"
                        variant="outlined"
                        disabled={forzandoCierre}
                        startIcon={forzandoCierre ? <CircularProgress size={14} /> : <CheckCircleOutlineIcon />}
                    >
                        Marcar finalizada
                    </Button>
                    <Button
                        onClick={() => handleForzarCierre(campañaACerrar, 'error')}
                        color="error"
                        variant="contained"
                        disabled={forzandoCierre}
                        startIcon={forzandoCierre ? <CircularProgress size={14} /> : <BlockIcon />}
                    >
                        Marcar error
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

            <CampañaLogModal
                open={!!modalLog}
                onClose={() => setModalLog(null)}
                campañaId={modalLog?.id}
                campañaNombre={modalLog?.nombre}
                tipo="whatsapp"
                estadoCampaña={campañas.find(c => c.id === modalLog?.id)?.estado}
                progreso={progresos[modalLog?.id] ?? null}
                onPausar={() => {
                    const c = campañas.find(x => x.id === modalLog?.id);
                    if (c) pausarCampaña(c);
                }}
                onForzarCierre={() => {
                    const c = campañas.find(x => x.id === modalLog?.id);
                    if (c) setCampañaACerrar(c);
                }}
            />

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={mensaje.tipo === 'warning' ? 10000 : 6000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <MuiAlert
                    elevation={6}
                    variant="filled"
                    severity={mensaje.tipo || 'info'}
                    onClose={() => setSnackbarOpen(false)}
                    icon={mensaje.tipo === 'warning' ? <WifiOffIcon fontSize="inherit" /> : <CheckCircleIcon fontSize="inherit" />}
                    sx={{
                        ...(mensaje.tipo === 'warning' && {
                            background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                            boxShadow: '0 4px 20px rgba(255, 152, 0, 0.4)',
                            borderRadius: 2,
                            fontWeight: 500,
                            '& .MuiAlert-icon': {
                                animation: 'pulse 2s ease-in-out infinite',
                            },
                            '@keyframes pulse': {
                                '0%, 100%': { opacity: 1 },
                                '50%': { opacity: 0.5 },
                            },
                        }),
                    }}
                >
                    {mensaje.texto}
                </MuiAlert>
            </Snackbar>
        </Box>
    );
}