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
    useTheme,
    useMediaQuery,
    IconButton
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../api/axios';
import { io } from 'socket.io-client';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useNavigate } from 'react-router-dom';

export default function EstadoSesiones() {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [sesiones, setSesiones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState({ open: false, type: 'success', message: '' });
    const [sesionAEliminar, setSesionAEliminar] = useState(null);
    const [confirmarLimpiar, setConfirmarLimpiar] = useState(false);
    const navigate = useNavigate();

    const cargarSesiones = async () => {
        const res = await api.get('/sesiones/status');
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
                    sx={{

                        borderRadius: 2,
                        fontFamily: commonFont,
                        textTransform: 'none',
                        fontSize: '0.9rem',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            backgroundColor: theme.palette.error.dark, // más integrado al tema
                            transform: 'scale(1.03)',
                            boxShadow: 4,
                        },
                    }}
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
                {sesiones.length === 0 && !loading && (
                    <Box
                        minHeight="25vh"
                        textAlign="center"
                        display="flex"
                        flexDirection="column"
                        alignItems="center"
                        justifyContent="center"
                        sx={{
                            border: '2px dashed',
                            borderColor: theme.palette.mode === 'dark' ? '#555' : '#ccc',
                            borderRadius: 4,
                            py: 5,
                            px: 3,
                            backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f9f9f9',
                            color: theme.palette.text.secondary,
                            mx: 'auto',
                        }}
                    >
                        <img
                            src="https://cdn-icons-png.flaticon.com/512/4076/4076500.png"
                            alt="Sin sesiones"
                            width={100}
                            style={{ marginBottom: 16, opacity: 0.6 }}
                        />
                        <Typography variant="h6" gutterBottom>
                            No hay ninguna sesión conectada
                        </Typography>
                        <Typography variant="body2">
                            Conectá una sesión para comenzar a gestionar tus campañas de WhatsApp.
                        </Typography>
                        <Button
                            variant="contained"
                            onClick={() => navigate('/conectar')}
                            sx={{
                                mt: 3,
                                px: 4,
                                py: 1.3,
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
                            Conectar sesión
                        </Button>
                    </Box>
                )}

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
                <MuiAlert
                    elevation={6}
                    variant="filled"
                    severity={feedback.type}
                    onClose={() => setFeedback({ ...feedback, open: false })}
                    icon={<CheckCircleIcon fontSize="inherit" />}
                >
                    {feedback.message}
                </MuiAlert>                
            </Snackbar>
        </Box>
    );
}