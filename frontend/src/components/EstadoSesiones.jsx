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
} from '@mui/material';
import api from '../api/axios';
import { io } from 'socket.io-client';

export default function EstadoSesiones() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [sesiones, setSesiones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState({ open: false, type: 'success', message: '' });

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
            await api.delete('/sessions/clear');
            await cargarSesiones();
            setFeedback({ open: true, type: 'success', message: 'Sesiones limpiadas correctamente' });
        } catch (err) {
            setFeedback({ open: true, type: 'error', message: 'Error al limpiar sesiones' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
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
                    onClick={limpiarSesiones}
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
                                display: 'flex',
                                alignItems: 'center',
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
                            <Box
                                sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    bgcolor: getColor(s.estado),
                                    mr: 2,
                                }}
                            />
                            <CardContent sx={{ p: 0 }}>
                                <Typography variant="subtitle1" noWrap>{`Id: ${s.id}`}</Typography>
                                <Typography variant="subtitle2" noWrap>{`Ani: ${s.ani}`}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Estado: {s.estado}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

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