import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { Copy } from 'lucide-react';
import api from '../api/axios';
import { mensajeDeError, useFeedback } from '../context/FeedbackContext';
import { ResponsiveDialog, WaBurbuja, formatoWhatsApp } from './ui';

/**
 * La plantilla con los datos reales del primer contacto de una campaña. Antes mostraba además un mensaje entrante
 * inventado ("Hola, quería saber más sobre sus servicios") que parecía parte de la conversación real.
 */
export default function PreviewTemplateReal({ open, onClose, templateId }) {
    const feedback = useFeedback();
    const [campañas, setCampañas] = useState([]);
    const [campañaId, setCampañaId] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setMensaje('');
        setCampañaId('');
        setError('');
        api.get('/whatsapp/campanias')
            .then((res) => setCampañas([...res.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))))
            .catch((err) => setError(mensajeDeError(err, 'No se pudieron cargar las campañas.')));
    }, [open]);

    // Al elegir la campaña se genera sola: un botón "Generar" de más era un paso sin sentido.
    useEffect(() => {
        if (!campañaId || !templateId) return undefined;
        let vigente = true;
        setCargando(true);
        setMensaje('');
        setError('');
        api.post('/whatsapp/templates/preview-real', { templateId, campañaId })
            .then((res) => vigente && setMensaje(res.data.mensaje))
            .catch((err) => vigente && setError(mensajeDeError(err, 'No se pudo generar la vista previa con datos reales.')))
            .finally(() => vigente && setCargando(false));
        return () => {
            vigente = false;
        };
    }, [campañaId, templateId]);

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(mensaje);
            feedback.exito('Mensaje copiado.');
        } catch {
            feedback.error('No se pudo copiar. Seleccioná el texto y copialo a mano.');
        }
    };

    return (
        <ResponsiveDialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            cerrarConFondo
            title="Vista previa con datos reales"
            actions={
                <>
                    {mensaje && (
                        <Button onClick={copiar} startIcon={<Copy size={18} strokeWidth={1.75} aria-hidden />}>Copiar mensaje</Button>
                    )}
                    <Button variant="contained" onClick={onClose}>Cerrar</Button>
                </>
            }
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Autocomplete
                    fullWidth
                    options={campañas.slice(0, 15)}
                    getOptionLabel={(o) => o.nombre}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    value={campañas.find((c) => c.id === campañaId) || null}
                    onChange={(_, nueva) => setCampañaId(nueva ? nueva.id : '')}
                    noOptionsText="No hay campañas"
                    renderInput={(params) => (
                        <TextField {...params} label="Campaña" helperText="Se usan los datos de su primer contacto." />
                    )}
                />

                {error && <Alert severity="error">{error}</Alert>}

                {cargando && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
                )}

                {!cargando && !mensaje && !error && (
                    <Typography variant="body2" color="text.secondary">Elegí una campaña para ver cómo le llega el mensaje a su primer contacto.</Typography>
                )}

                {mensaje && (
                    <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2, display: 'flex', flexDirection: 'column' }}>
                        <WaBurbuja direccion="saliente">{formatoWhatsApp(mensaje)}</WaBurbuja>
                    </Box>
                )}
            </Box>
        </ResponsiveDialog>
    );
}
