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
} from '@mui/material';
import api from '../api/axios';

export default function EstadoSesiones() {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
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
        <Box sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5">Sesiones activas</Typography>
                <Button
                    sx={{ mb: 2, fontFamily: commonFont, textTransform: 'none' }}
                    variant="contained"
                    color="error"
                    onClick={limpiarSesiones}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={20} /> : 'Limpiar Sesiones'}
                </Button>
            </Box>

            <Grid container spacing={2}>
                {sesiones.map((s) => (
                    <Grid item xs={12} sm={6} md={4} key={s.id}>
                        <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
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
                                <Typography variant="subtitle1">Id: {s.id}</Typography>
                                <Typography variant="subtitle2">Ani: {s.ani}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Estado: {s.estado}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

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