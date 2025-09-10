import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, CardActions, Button, Typography, CircularProgress } from '@mui/material';
import axios from 'axios';

export default function DesuscripcionConfirmar() {
    const { search } = useLocation();
    const navigate = useNavigate();
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(search);
        const u = params.get('u') || '';
        setToken(u);
        if (!u) {
            navigate('/mailing/desuscribirse/resultado?status=error&msg=Token%20faltante');
        }
    }, [search, navigate]);

    const confirmar = async () => {
        try {
            setLoading(true);
            await axios.post(`${import.meta.env.VITE_API_URL}/email/desuscripciones/unsubscribes/confirm`, { u: token });
            navigate('/mailing/desuscribirse/resultado?status=success');
        } catch (e) {
            const msg = encodeURIComponent(e?.response?.data ?? 'Error al confirmar la baja');
            navigate(`/mailing/desuscribirse/resultado?status=error&msg=${msg}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box minHeight="100dvh" display="flex" alignItems="center" justifyContent="center" p={2}>
            <Card sx={{ maxWidth: 520, width: '100%', borderRadius: 3 }}>
                <CardContent>
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                        Confirmar desuscripción
                    </Typography>
                    <Typography color="text.secondary">
                        ¿Querés dejar de recibir correos de AMSA Sender?
                    </Typography>
                </CardContent>
                <CardActions sx={{ p: 2, gap: 1 }}>
                    <Button variant="outlined" onClick={() => window.close()}>
                        Cancelar
                    </Button>
                    <Button variant="contained" onClick={confirmar} disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : 'Confirmar desuscripción'}
                    </Button>
                </CardActions>
            </Card>
        </Box>
    );
}