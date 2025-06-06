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

export default function ConectarCuenta() {
    const theme = useTheme();
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';

    const [qr, setQr] = useState(null);
    const [id, setId] = useState(null);
    const [ani, setAni] = useState(null);
    const [loading, setLoading] = useState(false);
    const [conectado, setConectado] = useState(false);

    const conectar = async () => {
        setLoading(true);
        try {
            const res = await api.get('/conectar');
            setQr(res.data.qr);
            setId(res.data.id);
        } catch (err) {
            console.error('Error al conectar:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!id || conectado) return;

        const interval = setInterval(async () => {
            try {
                const res = await api.get(`/status/${id}`);
                if (res.data.estado === 'conectado') {
                    setAni(res.data.ani);
                    setConectado(true);
                    setQr(null);
                }
            } catch (err) {
                console.error('Error verificando estado:', err);
            }
        }, 2000);

        return () => clearInterval(interval);
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

                {!qr && !conectado && (
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