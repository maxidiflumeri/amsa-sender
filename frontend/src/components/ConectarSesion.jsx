import { useEffect, useState } from 'react';
import api from '../api/axios';
import {
    Box,
    Button,
    Typography,
    Paper,
    CircularProgress,
    Alert,
} from '@mui/material';
import QRCode from 'react-qr-code';

export default function ConectarCuenta() {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [qr, setQr] = useState(null);
    const [id, setId] = useState(null);
    const [ani, setAni] = useState(null);
    const [loading, setLoading] = useState(false);
    const [conectado, setConectado] = useState(false);

    const conectar = async () => {
        setLoading(true);
        try {
            const res = await api.get('/conectar'); // debe retornar { qr: string, id: string }
            setQr(res.data.qr);
            setId(res.data.id);
        } catch (err) {
            console.error('Error al conectar:', err);
        } finally {
            setLoading(false);
        }
    };

    // Polling para verificar si se conectó
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
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="70vh">
            <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
                <Typography variant="h6" gutterBottom>Conectar Cuenta WhatsApp</Typography>

                {!qr && !conectado && (
                    <Button variant="contained" onClick={conectar} disabled={loading} sx={{ backgroundColor: '#075E54', fontFamily: commonFont, textTransform: 'none' }}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Generar QR'}
                    </Button>
                )}

                {qr && (
                    <Box display="flex" justifyContent="center" my={2}>
                        <QRCode value={qr} size={180} />
                    </Box>
                )}

                {conectado && (
                    <Alert severity="success" sx={{ mt: 2 }}>
                        ✅ Sesión conectada exitosamente<br />
                        <strong>ID:</strong> {id}<br />
                        <strong>Ani:</strong> {ani}
                    </Alert>
                )}
            </Paper>
        </Box>
    );
}