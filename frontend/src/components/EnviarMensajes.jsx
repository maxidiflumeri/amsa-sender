import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    LinearProgress,
    Typography,
    Box,
    Alert,
    IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import api from '../api/axios';

export default function EnviarMensajesModal({ open, onClose, campaña, onReset }) {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [sesiones, setSesiones] = useState([]);
    const [selectedSesion, setSelectedSesion] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
    const [progreso, setProgreso] = useState(0);

    useEffect(() => {
        if (open) {
            setMensaje({ tipo: '', texto: '' });
            setSelectedSesion([]);
            api.get('/status')
                .then(res => setSesiones(res.data))
                .catch(err => console.error('Error al obtener sesiones:', err));
        }
    }, [open]);

    const enviarMensajes = async () => {
        if (selectedSesion.length === 0) {
            setMensaje({ tipo: 'error', texto: 'Seleccioná al menos una sesión' });
            return;
        }

        setLoading(true);
        setMensaje({ tipo: '', texto: '' });
        setProgreso(10);

        try {
            await api.post('/send-messages', {
                sessionIds: selectedSesion,
                campaña: campaña.id
            });

            // Simulación de progreso con setTimeout
            let progresoSimulado = 10;
            const intervalo = setInterval(() => {
                progresoSimulado += 10;
                setProgreso(progresoSimulado);
                if (progresoSimulado >= 100) {
                    clearInterval(intervalo);
                    setMensaje({ tipo: 'success', texto: 'Envío completado correctamente' });
                    setLoading(false);
                }
            }, 300);

        } catch (error) {
            console.error('Error al enviar mensajes', error);
            setMensaje({ tipo: 'error', texto: 'Ocurrió un error al enviar mensajes' });
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                Enviar campaña: "{campaña?.nombre}"
                <IconButton
                    aria-label="cerrar"
                    onClick={onClose}
                    sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Sesiones</InputLabel>
                    <Select
                        multiple
                        value={selectedSesion}
                        onChange={(e) => setSelectedSesion(e.target.value)}
                        label="Sesiones"
                        renderValue={(selected) => selected.join(', ')}
                    >
                        {sesiones.map((s) => (
                            <MenuItem
                                key={s.id}
                                value={s.id}
                                disabled={s.estado !== 'conectado'}
                            >
                                <Box display="flex" justifyContent="space-between" width="100%">
                                    <span>{s.ani}</span>
                                    <span style={{ color: s.estado === 'conectado' ? 'green' : 'gray' }}>
                                        {s.estado}
                                    </span>
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {mensaje.texto && (
                    <Alert severity={mensaje.tipo} sx={{ mb: 2 }}>
                        {mensaje.texto}
                    </Alert>
                )}

                {loading && (
                    <Box sx={{ my: 2 }}>
                        <Typography variant="body2" gutterBottom>Enviando mensajes...</Typography>
                        <LinearProgress variant="determinate" value={progreso} />
                    </Box>
                )}

                <Box textAlign="center" sx={{ mt: 2 }}>
                    <Button
                        sx={{ mb: 2, backgroundColor: '#075E54', fontFamily: commonFont, textTransform: 'none' }}
                        variant="contained"
                        onClick={enviarMensajes}
                        disabled={loading}
                    >
                        {loading ? 'Enviando...' : 'Iniciar envío'}
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
}