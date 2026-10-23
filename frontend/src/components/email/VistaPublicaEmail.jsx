import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { VistaPreviaEmail } from '../ui';
import PaginaPublica from '../plantillas/PaginaPublica';
import { mensajePublico } from '../plantillas/mensajePublico';

/**
 * El mail tal como se mandó, para quien toca «Ver en el navegador». Va en el iframe aislado de `VistaPreviaEmail`: el
 * HTML del mail no puede tocar la página ni ejecutar nada.
 */
export default function VistaPublicaEmail() {
    const { id } = useParams(); // ID del ReporteEmail
    const [html, setHtml] = useState('');
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const cargar = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/mailing/vista/${id}`);
            // Los links del mail se abren en otra pestaña: dentro del iframe quedarían atrapados.
            setHtml(`<base target="_blank">${res.data.html ?? ''}`);
        } catch (err) {
            setError(mensajePublico(err, 'No pudimos cargar este mensaje. Probá de nuevo en unos minutos.'));
        } finally {
            // Recién cuando terminó el pedido (antes el `finally` corría antes y apagaba la carga de entrada).
            setCargando(false);
        }
    }, [id]);

    useEffect(() => { cargar(); }, [cargar]);

    return (
        <PaginaPublica ancho={680} centrado={false}>
            {cargando && (
                <Box role="status" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 8, color: 'text.secondary' }}>
                    <CircularProgress size={22} />
                    <Typography variant="body2">Cargando el mensaje…</Typography>
                </Box>
            )}
            {error && (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={cargar} sx={{ minHeight: 44 }}>Reintentar</Button>}>
                    {error}
                </Alert>
            )}
            {!cargando && !error && <VistaPreviaEmail html={html} titulo="Mensaje de email" />}
        </PaginaPublica>
    );
}
