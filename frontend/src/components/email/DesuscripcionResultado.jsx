import { useLocation } from 'react-router-dom';
import { Paper, Typography } from '@mui/material';
import PaginaPublica from '../plantillas/PaginaPublica';

export default function DesuscripcionResultado() {
    const { search } = useLocation();
    const params = new URLSearchParams(search);
    const exito = params.get('status') === 'success';
    // `get` ya decodifica el valor: decodificarlo otra vez rompía los textos con un «%».
    const msg = params.get('msg') || '';

    return (
        <PaginaPublica>
            <Paper variant="outlined" sx={{ borderRadius: '14px', p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
                <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700, mb: 1 }}>
                    {exito ? 'Listo, ya no vas a recibir más correos' : 'No pudimos completar la baja'}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                    {exito
                        ? 'Si fue un error, pedile al remitente que te vuelva a incluir.'
                        : (msg || 'El enlace es inválido o venció.')}
                </Typography>
                <Typography variant="body2" color="text.secondary">Ya podés cerrar esta pestaña.</Typography>
            </Paper>
        </PaginaPublica>
    );
}
