import React, { useEffect, useRef, useState } from 'react';
import {
    Box, Button, Paper, Typography, Table, TableHead, TableRow,
    TableCell, TableBody, Chip, IconButton, Tooltip, LinearProgress,
    TextField, Tabs, Tab, TablePagination, CircularProgress,
    Dialog, DialogTitle, DialogContent, DialogActions, Alert,
    Snackbar, Stack, useMediaQuery, Skeleton,
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import EventIcon from '@mui/icons-material/Event';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CampaignIcon from '@mui/icons-material/Campaign';
import InboxIcon from '@mui/icons-material/Inbox';
import TerminalIcon from '@mui/icons-material/Terminal';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { es } from 'date-fns/locale';
import { io } from 'socket.io-client';
import api from '../../api/axios';
import SubirCampaniaWapiModal from './SubirCampaniaWapiModal';
import CampañaLogModal from '../CampañaLogModal';

const ESTADO_CHIP = {
    pendiente:   { label: 'Pendiente',   color: 'default' },
    agendada:    { label: 'Agendada',    color: 'info' },
    procesando:  { label: 'Procesando',  color: 'info' },
    pausada:     { label: 'Pausada',     color: 'warning' },
    finalizada:  { label: 'Finalizada',  color: 'success' },
    error:       { label: 'Error',       color: 'error' },
};

const SkeletonRow = () => (
    <TableRow>
        {[200, 80, 120, 120, 100, 140, 120].map((w, i) => (
            <TableCell key={i}><Skeleton variant="text" width={w} /></TableCell>
        ))}
    </TableRow>
);

export default function VerCampaniasWapi() {
    const theme = useTheme();
    const isMobile = useMediaQuery('(max-width:768px)');

    const [campanias, setCampanias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(0);
    const [filtro, setFiltro] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [modalNueva, setModalNueva] = useState(false);
    const [feedback, setFeedback] = useState({ open: false, message: '', type: 'success' });
    const [progresos, setProgresos] = useState({});
    const [modalLog, setModalLog] = useState(null); // { id, nombre }

    // Dialogs
    const [confirmarEliminar, setConfirmarEliminar] = useState(null);
    const [confirmarCierre, setConfirmarCierre] = useState(null);
    const [agendarDialog, setAgendarDialog] = useState(null); // campaña seleccionada
    const [agendarFecha, setAgendarFecha] = useState(null);
    const [accionLoading, setAccionLoading] = useState(false);

    const cargar = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/wapi/campanias');
            setCampanias(res.data.map(c => ({
                ...c,
                contactosCount: c._count?.contactos ?? 0,
            })));
        } catch {
            mostrarFeedback('Error al cargar campañas.', 'error');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    useEffect(() => {
        const socket = io(import.meta.env.VITE_HOST_SOCKET);

        campanias.forEach(c => {
            if (c.estado === 'procesando') {
                socket.emit('join_campaña', c.id);
            }
        });

        socket.on('progreso', ({ enviados, total, campañaId }) => {
            setProgresos(prev => ({ ...prev, [campañaId]: { enviados, total } }));
        });

        socket.on('campania_finalizada', () => cargar(true));
        socket.on('campania_estado', () => cargar(true));
        socket.on('campania_error', () => cargar(true));

        return () => socket.disconnect();
    }, [campanias]);

    const mostrarFeedback = (message, type = 'success') =>
        setFeedback({ open: true, message, type });

    // Tabs
    const porTab = [
        campanias.filter(c => c.estado === 'pendiente'),
        campanias.filter(c => c.estado === 'agendada'),
        campanias.filter(c => ['procesando', 'pausada'].includes(c.estado)),
        campanias.filter(c => c.estado === 'finalizada'),
        campanias.filter(c => c.estado === 'error'),
    ];
    const tabLabels = ['Pendientes', 'Agendadas', 'Procesando', 'Finalizadas', 'Error'];
    const visibles = (porTab[tab] ?? []).filter(c =>
        c.nombre.toLowerCase().includes(filtro.toLowerCase())
    );
    const paginadas = visibles.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    // Acciones
    const handleEnviar = async (c) => {
        setAccionLoading(true);
        try {
            await api.post(`/wapi/campanias/${c.id}/enviar`);
            mostrarFeedback('Envío iniciado correctamente.');
            cargar(true);
        } catch (err) {
            mostrarFeedback(err.response?.data?.message || 'Error al iniciar envío.', 'error');
        } finally {
            setAccionLoading(false);
        }
    };

    const handleAgendar = async () => {
        if (!agendarFecha) return;
        setAccionLoading(true);
        try {
            await api.post(`/wapi/campanias/${agendarDialog.id}/agendar`, {
                agendadoAt: agendarFecha.toISOString(),
            });
            mostrarFeedback('Campaña agendada correctamente.');
            setAgendarDialog(null);
            cargar(true);
        } catch (err) {
            mostrarFeedback(err.response?.data?.message || 'Error al agendar.', 'error');
        } finally {
            setAccionLoading(false);
        }
    };

    const handleEliminar = async () => {
        setAccionLoading(true);
        try {
            await api.delete(`/wapi/campanias/${confirmarEliminar.id}`);
            mostrarFeedback('Campaña eliminada.');
            setConfirmarEliminar(null);
            cargar(true);
        } catch {
            mostrarFeedback('Error al eliminar.', 'error');
        } finally {
            setAccionLoading(false);
        }
    };

    const handlePausar = async (campania) => {
        setAccionLoading(true);
        try {
            await api.post(`/wapi/campanias/${campania.id}/pausar`);
            mostrarFeedback('Campaña pausada.');
            cargar(true);
        } catch {
            mostrarFeedback('Error al pausar la campaña.', 'error');
        } finally {
            setAccionLoading(false);
        }
    };

    const handleReanudar = async (campania) => {
        setAccionLoading(true);
        try {
            await api.post(`/wapi/campanias/${campania.id}/reanudar`);
            mostrarFeedback('Campaña reanudada.');
            cargar(true);
        } catch (err) {
            mostrarFeedback(err.response?.data?.message || 'Error al reanudar la campaña.', 'error');
        } finally {
            setAccionLoading(false);
        }
    };

    const handleForzarCierre = async (estado) => {
        setAccionLoading(true);
        try {
            await api.post(`/wapi/campanias/${confirmarCierre.id}/forzar-cierre`, { estado });
            mostrarFeedback(`Campaña marcada como "${estado}".`);
            setConfirmarCierre(null);
            cargar(true);
        } catch {
            mostrarFeedback('Error al forzar cierre.', 'error');
        } finally {
            setAccionLoading(false);
        }
    };

    return (
        <>
            <Box py={3}>
                <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
                    {/* Header */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <CampaignIcon sx={{ fontSize: 32 }} />
                            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">
                                Campañas WhatsApp API
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                            <Tooltip title="Refrescar">
                                <IconButton onClick={() => cargar()}><RefreshIcon /></IconButton>
                            </Tooltip>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => setModalNueva(true)}
                            >
                                Nueva campaña
                            </Button>
                        </Stack>
                    </Box>

                    {/* Tabs */}
                    <Tabs
                        value={tab}
                        onChange={(_, v) => { setTab(v); setPage(0); }}
                        variant="scrollable"
                        allowScrollButtonsMobile
                        sx={{ '& .MuiTab-root': { textTransform: 'none', fontSize: 13, minHeight: 40 } }}
                    >
                        {tabLabels.map((label, i) => (
                            <Tab key={label} label={`${label} (${porTab[i].length})`} />
                        ))}
                    </Tabs>

                    {loading && <LinearProgress sx={{ mt: 1 }} />}

                    <Box my={2}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Buscar por nombre"
                            value={filtro}
                            onChange={e => setFiltro(e.target.value)}
                        />
                    </Box>

                    <Box sx={{ overflowX: 'auto', border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                        <Table stickyHeader size={isMobile ? 'small' : 'medium'} sx={{ minWidth: 650 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Nombre</TableCell>
                                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Contactos</TableCell>
                                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Template</TableCell>
                                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Creado</TableCell>
                                    <TableCell>Estado</TableCell>
                                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Agendado</TableCell>
                                    <TableCell>Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading
                                    ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                                    : paginadas.map(c => {
                                        const chip = ESTADO_CHIP[c.estado] ?? { label: c.estado, color: 'default' };
                                        return (
                                            <TableRow key={c.id} hover>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                                                        {c.nombre}
                                                    </Typography>
                                                    {c.estado === 'procesando' && (
                                                        <Box sx={{ mt: 0.5, minWidth: 120 }}>
                                                            <LinearProgress
                                                                variant={progresos[c.id] ? 'determinate' : 'indeterminate'}
                                                                value={progresos[c.id] ? (progresos[c.id].enviados / progresos[c.id].total) * 100 : 0}
                                                                sx={{ height: 4, borderRadius: 2 }}
                                                            />
                                                            {progresos[c.id] && (
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {progresos[c.id].enviados}/{progresos[c.id].total}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                                    {c.contactosCount}
                                                </TableCell>
                                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                                    <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                                                        {c.template?.metaNombre ?? '—'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                                    {c.createdAt ? new Date(c.createdAt).toLocaleString('es-AR') : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={chip.label} color={chip.color} size="small" />
                                                </TableCell>
                                                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                                                    {c.agendadoAt ? new Date(c.agendadoAt).toLocaleString('es-AR') : '—'}
                                                </TableCell>
                                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                    {c.estado === 'pendiente' && <>
                                                        <Tooltip title="Enviar ahora">
                                                            <IconButton color="primary" size="small" onClick={() => handleEnviar(c)}>
                                                                <SendIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Agendar">
                                                            <IconButton color="secondary" size="small" onClick={() => { setAgendarFecha(null); setAgendarDialog(c); }}>
                                                                <EventIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </>}
                                                    {c.estado === 'procesando' && (<>
                                                        <Tooltip title="Ver logs en tiempo real">
                                                            <IconButton color="info" size="small" onClick={() => setModalLog({ id: c.id, nombre: c.nombre })}>
                                                                <TerminalIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Pausar campaña">
                                                            <IconButton color="warning" size="small" disabled={accionLoading} onClick={() => handlePausar(c)}>
                                                                <PauseIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Forzar cierre">
                                                            <IconButton color="error" size="small" onClick={() => setConfirmarCierre(c)}>
                                                                <BlockIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </>)}
                                                    {c.estado === 'pausada' && (
                                                        <Tooltip title="Reanudar campaña">
                                                            <IconButton color="success" size="small" disabled={accionLoading} onClick={() => handleReanudar(c)}>
                                                                <PlayArrowIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    {c.estado === 'error' && (
                                                        <Tooltip title="Marcar finalizada">
                                                            <IconButton color="success" size="small" onClick={() => setConfirmarCierre(c)}>
                                                                <CheckCircleOutlineIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    {['pendiente', 'agendada', 'finalizada', 'pausada', 'error'].includes(c.estado) && (
                                                        <Tooltip title="Eliminar">
                                                            <IconButton color="error" size="small" onClick={() => setConfirmarEliminar(c)}>
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                }
                                {!loading && paginadas.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7}>
                                            <Box textAlign="center" py={6} color="text.secondary">
                                                <InboxIcon sx={{ fontSize: 56, mb: 1 }} />
                                                <Typography>No hay campañas en esta sección.</Typography>
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
                        count={visibles.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
                    />
                </Paper>
            </Box>

            {/* Modal nueva campaña */}
            <Dialog open={modalNueva} onClose={() => setModalNueva(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Nueva campaña WhatsApp API</DialogTitle>
                <DialogContent dividers>
                    <SubirCampaniaWapiModal
                        onCreado={(data) => {
                            setModalNueva(false);
                            mostrarFeedback(`Campaña creada: ${data.totalContactos} contactos${data.omitidosPorBaja ? `, ${data.omitidosPorBaja} omitidos por baja` : ''}.`);
                            cargar(true);
                        }}
                    />
                </DialogContent>
            </Dialog>

            {/* Confirmar eliminar */}
            <Dialog open={!!confirmarEliminar} onClose={() => setConfirmarEliminar(null)} maxWidth="xs" fullWidth>
                <DialogTitle>¿Eliminar campaña?</DialogTitle>
                <DialogContent>
                    <Typography>
                        ¿Eliminar <strong>"{confirmarEliminar?.nombre}"</strong>? Los reportes se conservarán.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmarEliminar(null)}>Cancelar</Button>
                    <Button variant="contained" color="error" onClick={handleEliminar} disabled={accionLoading}>
                        {accionLoading ? <CircularProgress size={18} /> : 'Eliminar'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Forzar cierre */}
            <Dialog open={!!confirmarCierre} onClose={() => setConfirmarCierre(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningAmberIcon color="warning" />
                    Forzar cierre
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        Campaña <strong>"{confirmarCierre?.nombre}"</strong>.
                        Elegí el estado final.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmarCierre(null)}>Cancelar</Button>
                    <Button color="success" variant="outlined" onClick={() => handleForzarCierre('finalizada')} disabled={accionLoading}>
                        Finalizada
                    </Button>
                    <Button color="error" variant="contained" onClick={() => handleForzarCierre('error')} disabled={accionLoading}>
                        Error
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Agendar */}
            <Dialog open={!!agendarDialog} onClose={() => setAgendarDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Agendar campaña</DialogTitle>
                <DialogContent>
                    <Box pt={1}>
                        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
                            <DateTimePicker
                                label="Fecha y hora de envío"
                                value={agendarFecha}
                                onChange={setAgendarFecha}
                                slotProps={{ textField: { fullWidth: true } }}
                                disablePast
                            />
                        </LocalizationProvider>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAgendarDialog(null)}>Cancelar</Button>
                    <Button variant="contained" onClick={handleAgendar} disabled={!agendarFecha || accionLoading}>
                        {accionLoading ? <CircularProgress size={18} /> : 'Agendar'}
                    </Button>
                </DialogActions>
            </Dialog>

            <CampañaLogModal
                open={!!modalLog}
                onClose={() => setModalLog(null)}
                campañaId={modalLog?.id}
                campañaNombre={modalLog?.nombre}
                tipo="wapi"
                estadoCampaña={campanias.find(c => c.id === modalLog?.id)?.estado}
                progreso={progresos[modalLog?.id] ?? null}
                onForzarCierre={modalLog ? () => setConfirmarCierre(campanias.find(c => c.id === modalLog.id)) : null}
            />

            <Snackbar
                open={feedback.open}
                autoHideDuration={5000}
                onClose={() => setFeedback(p => ({ ...p, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <MuiAlert
                    onClose={() => setFeedback(p => ({ ...p, open: false }))}
                    severity={feedback.type}
                    variant="filled"
                    elevation={6}
                >
                    {feedback.message}
                </MuiAlert>
            </Snackbar>
        </>
    );
}
