import { useLocation } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Button } from '@mui/material';

export default function DesuscripcionResultado() {
    const { search } = useLocation();
    const params = new URLSearchParams(search);
    const status = params.get('status');
    const msg = decodeURIComponent(params.get('msg') || '');

    const isSuccess = status === 'success';

    return (
        <Box minHeight="100dvh" display="flex" alignItems="center" justifyContent="center" p={2}>
            <Card sx={{ maxWidth: 520, width: '100%', borderRadius: 3 }}>
                <CardContent>
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                        {isSuccess ? '¡Listo! Te desuscribiste' : 'No se pudo completar la baja'}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                        {isSuccess
                            ? 'Ya no recibirás futuros correos. Si fue un error, podés volver a suscribirte contactando al remitente.'
                            : (msg || 'El enlace de desuscripción es inválido o expiró.')}
                    </Typography>
                    <Button variant="contained" onClick={() => window.close()}>
                        Cerrar
                    </Button>
                </CardContent>
            </Card>
        </Box>
    );
}