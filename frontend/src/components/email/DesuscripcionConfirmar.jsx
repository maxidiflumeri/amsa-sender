import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, CircularProgress, Paper, Typography } from '@mui/material';
import axios from 'axios';
import PaginaPublica from '../plantillas/PaginaPublica';
import { mensajePublico } from '../plantillas/mensajePublico';

const resultadoUrl = (status, msg) => {
    const p = new URLSearchParams({ status });
    if (msg) p.set('msg', msg);
    return `/mailing/desuscribirse/resultado?${p.toString()}`;
};

export default function DesuscripcionConfirmar() {
    const { search } = useLocation();
    const navigate = useNavigate();
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [cancelado, setCancelado] = useState(false);

    useEffect(() => {
        const u = new URLSearchParams(search).get('u') || '';
        setToken(u);
        if (!u) navigate(resultadoUrl('error', 'Falta el código del enlace.'), { replace: true });
    }, [search, navigate]);

    const confirmar = async () => {
        setLoading(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/email/desuscripciones/unsubscribes/confirm`, { u: token });
            navigate(resultadoUrl('success'), { replace: true });
        } catch (err) {
            navigate(resultadoUrl('error', mensajePublico(err, 'No pudimos confirmar la baja. Probá de nuevo en unos minutos.')), { replace: true });
        } finally {
            setLoading(false);
        }
    };

    return (
        <PaginaPublica>
            <Paper variant="outlined" sx={{ borderRadius: '14px', p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
                {cancelado ? (
                    <>
                        <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700, mb: 1 }}>No hicimos ningún cambio</Typography>
                        <Typography color="text.secondary" sx={{ mb: 3 }}>
                            Vas a seguir recibiendo los correos. Ya podés cerrar esta pestaña.
                        </Typography>
                        <Button variant="outlined" onClick={() => setCancelado(false)} sx={{ minHeight: 44 }}>Volver</Button>
                    </>
                ) : (
                    <>
                        <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700, mb: 1 }}>Dejar de recibir estos correos</Typography>
                        <Typography color="text.secondary" sx={{ mb: 3 }}>
                            ¿Querés dejar de recibir correos de este remitente? Podés cambiar de opinión pidiéndoselo a quien te escribió.
                        </Typography>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={confirmar}
                            disabled={loading || !token}
                            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
                            sx={{ minHeight: 48, mb: 1.5 }}
                        >
                            Sí, no quiero recibir más
                        </Button>
                        <Button fullWidth onClick={() => setCancelado(true)} disabled={loading} sx={{ minHeight: 48 }}>
                            No, seguir recibiéndolos
                        </Button>
                    </>
                )}
            </Paper>
        </PaginaPublica>
    );
}
