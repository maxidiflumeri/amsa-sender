import { useEffect, useState } from 'react';
import api from '../api/axios';
import {
    Box,
    Button,
    Typography,
    Paper,
    CircularProgress,
    Alert,
    useTheme,
    Fade,
} from '@mui/material';
import QRCode from 'react-qr-code';
import { io } from 'socket.io-client';

export default function ConectarCuenta() {
    const theme = useTheme();
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';

    const [qr, setQr] = useState(null);
    const [id, setId] = useState(null);
    const [ani, setAni] = useState(null);
    const [loading, setLoading] = useState(false);
    const [conectado, setConectado] = useState(false);
    const [autenticado, setAutenticado] = useState(false);

    const conectar = async () => {
        setLoading(true);
        try {
            await api.post('/whatsapp/sesiones/conectar');
        } catch (err) {
            console.error('Error al conectar:', err);
            setLoading(false);
        }
    };

    useEffect(() => {
        const socket = io(import.meta.env.VITE_HOST_SOCKET); // cambiar si tenés otro host            

        socket.on('estado_sesion', ({ estado, qr, ani, sessionId }) => {
            if (estado == 'iniciando_sesion') {
                setAni(ani);
                setAutenticado(true);
                setQr(null);
            }

            if (estado == 'conectado') {
                setAni(ani);
                setConectado(true);
                setAutenticado(false);
                setQr(null);
            }

            if (estado == 'qr') {
                setQr(qr);
                setId(sessionId);
                setLoading(false);
            }
        });

        return () => socket.disconnect();
    }, [id, conectado]);

    return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="70vh" px={2}>
            <Paper
                elevation={6}
                sx={{
                    p: 4,
                    borderRadius: 4,
                    maxWidth: 420,
                    width: '100%',
                    textAlign: 'center',
                    backgroundColor: theme.palette.background.paper,
                }}
            >
                <Typography
                    variant="h5"
                    gutterBottom
                    sx={{ fontWeight: 600, fontFamily: commonFont }}
                >
                    Conectar Cuenta WhatsApp
                </Typography>

                {!qr && !conectado && !autenticado && (
                    <Button
                        variant="contained"
                        onClick={conectar}
                        disabled={loading}
                        sx={{
                            mt: 3,
                            px: 4,
                            py: 1.3,
                            borderRadius: 2,
                            fontFamily: commonFont,
                            textTransform: 'none',
                            fontSize: '1rem',
                            backgroundColor: '#075E54',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                backgroundColor: '#0b7b65',
                                transform: 'scale(1.03)',
                                boxShadow: 4,
                            },
                        }}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Generar QR'}
                    </Button>
                )}

                <Fade in={!!qr}>
                    <Box
                        display="flex"
                        justifyContent="center"
                        my={3}
                        p={2}
                        borderRadius={2}
                        sx={{
                            backgroundColor: '#ffffff',
                            boxShadow: theme.palette.mode === 'dark' ? 4 : 1,
                        }}
                    >
                        {qr && (
                            <QRCode
                                value={qr}
                                size={180}
                                bgColor="#ffffff"
                                fgColor="#000000"
                                style={{ borderRadius: 8 }}
                            />
                        )}
                    </Box>
                </Fade>

                {autenticado && (
                    <Box display="flex" flexDirection="column" alignItems="center" my={3}>
                        <CircularProgress />
                        <Typography mt={2}>Conectando con WhatsApp...</Typography>
                    </Box>
                )}

                {conectado && (
                    <Alert
                        severity="success"
                        variant="filled"
                        sx={{
                            mt: 3,
                            borderRadius: 2,
                            fontFamily: commonFont,
                            color: '#fff',
                            backgroundColor: theme.palette.success.main,
                        }}
                    >
                        ✅ Sesión conectada exitosamente<br />
                        <strong>ID:</strong> {id}<br />
                        <strong>Ani:</strong> {ani}
                    </Alert>
                )}
            </Paper>
        </Box>
    );
}