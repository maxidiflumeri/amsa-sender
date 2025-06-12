import { useEffect, useState } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Grid,
    Box,
    Button,
    CircularProgress,
    Snackbar,
    Alert,
    useTheme,
    useMediaQuery,
    IconButton
} from '@mui/material';
import api from '../api/axios';
import { io } from 'socket.io-client';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

export default function EstadoSesiones() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [sesiones, setSesiones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState({ open: false, type: 'success', message: '' });
    const [sesionAEliminar, setSesionAEliminar] = useState(null);
    const [confirmarLimpiar, setConfirmarLimpiar] = useState(false);

    const cargarSesiones = async () => {
        const res = await api.get('/status');
        setSesiones(res.data);
    };

    useEffect(() => {
        cargarSesiones();
    }, []);

    useEffect(() => {
        const socket = io(import.meta.env.VITE_HOST_SOCKET); // cambiar si tenés otro host            

        socket.on('estado_sesion', ({ estado, qr, ani, sessionId }) => {
            if (estado == 'desconectado') {
                cargarSesiones();
            }
            if (estado == 'conectado') {
                cargarSesiones();
            }
        });

        return () => socket.disconnect();
    }, []);

    const getColor = (estado) => {
        return estado === 'conectado' ? 'green' : estado === 'desconectado' ? 'gray' : 'orange';
    };

    const limpiarSesiones = async () => {
        setLoading(true);
        try {
            await api.delete('/sesiones/clear');
            await cargarSesiones();
            setFeedback({ open: true, type: 'success', message: 'Sesiones limpiadas correctamente' });
        } catch (err) {
            setFeedback({ open: true, type: 'error', message: 'Error al limpiar sesiones' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                maxWidth: '1400px',
                mx: 'auto',
                px: { xs: 2, md: 3, lg: 4 },
                py: 3
            }}
        >
            {/* Header y botón */}
            <Box
                display="flex"
                flexDirection={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                gap={2}
                mb={3}
            >
                <Typography variant="h5" fontWeight="bold">
                    Sesiones activas
                </Typography>
                <Button
                    sx={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', textTransform: 'none' }}
                    variant="contained"
                    color="error"
                    onClick={() => setConfirmarLimpiar(true)}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={20} /> : 'Limpiar Sesiones'}
                </Button>
            </Box>

            {/* Tarjetas */}
            <Grid container spacing={2}>
                {sesiones.map((s) => (
                    <Grid item xs={12} sm={6} md={4} key={s.id}>
                        <Card
                            variant="outlined"
                            sx={{
                                position: 'relative',
                                p: 2,
                                borderRadius: 2,
                                boxShadow: 1,
                                transition: 'box-shadow 0.3s ease',
                                background: theme.palette.mode === 'light'
                                    ? 'linear-gradient(to right, #f0f4f8, #e8f0fe)'
                                    : '#2c2c2c',
                                color: theme.palette.text.primary,
                                '&:hover': { boxShadow: 6 },
                            }}
                        >
                            {/* Botón eliminar */}
                            <IconButton
                                size="small"
                                onClick={() => setSesionAEliminar(s)}
                                sx={{
                                    position: 'absolute',
                                    top: 6,
                                    right: 6,
                                    color: theme.palette.error.main,
                                    zIndex: 1,
                                }}
                            >
                                <DeleteOutlineIcon fontSize="small" />
                            </IconButton>

                            {/* Estado */}
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Box
                                    sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        bgcolor: getColor(s.estado),
                                        mr: 2,
                                    }}
                                />
                                <CardContent sx={{ pl: 0, pt: 0, pr: 3 }}>
                                    <Typography variant="subtitle1" noWrap>{`Id: ${s.id}`}</Typography>
                                    <Typography variant="subtitle2" noWrap>{`Ani: ${s.ani}`}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Estado: {s.estado}
                                    </Typography>
                                </CardContent>
                            </Box>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Modal de confirmación */}
            <Dialog open={!!sesionAEliminar} onClose={() => setSesionAEliminar(null)}>
                <DialogTitle>¿Eliminar esta sesión?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        ¿Estás seguro de que querés eliminar la sesión{' '}
                        <strong>{sesionAEliminar?.id}</strong>? Esta acción no se puede deshacer.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSesionAEliminar(null)}>Cancelar</Button>
                    <Button
                        onClick={async () => {
                            try {
                                await api.delete(`/sesiones/${sesionAEliminar.id}`);
                                setFeedback({ open: true, type: 'success', message: 'Sesión eliminada exitosamente' });
                                cargarSesiones();
                            } catch (error) {
                                setFeedback({ open: true, type: 'error', message: 'Error al eliminar sesión' });
                            } finally {
                                setSesionAEliminar(null);
                            }
                        }}
                        color="error"
                        variant="contained"
                    >
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={confirmarLimpiar} onClose={() => setConfirmarLimpiar(false)}>
                <DialogTitle>¿Limpiar todas las sesiones?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        Esta acción eliminará todas las sesiones activas y en memoria. ¿Deseás continuar?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmarLimpiar(false)}>Cancelar</Button>
                    <Button
                        onClick={async () => {
                            setConfirmarLimpiar(false);
                            await limpiarSesiones();
                        }}
                        color="error"
                        variant="contained"
                    >
                        Confirmar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Feedback */}
            <Snackbar
                open={feedback.open}
                autoHideDuration={3000}
                onClose={() => setFeedback({ ...feedback, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={feedback.type}
                    sx={{ width: '100%' }}
                    onClose={() => setFeedback({ ...feedback, open: false })}
                >
                    {feedback.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}