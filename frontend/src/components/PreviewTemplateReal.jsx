import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Paper,
    MenuItem,
    Select,
    InputLabel,
    FormControl,
    Box,
    CircularProgress
} from '@mui/material';
import api from '../api/axios';

const PreviewTemplateReal = ({ open, onClose, templateId }) => {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [campañas, setCampañas] = useState([]);
    const [campañaId, setCampañaId] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const obtenerCampañas = async () => {
        try {
            const res = await api.get('/campanias'); // Asegurate de tener este endpoint
            setCampañas(res.data);
        } catch (err) {
            console.error('Error cargando campañas:', err);
        }
    };

    const generarPreview = async () => {
        if (!campañaId || !templateId) return;

        setCargando(true);
        setMensaje('');
        setError('');
        try {
            const res = await api.post('/templates/preview-real', {
                templateId,
                campañaId
            });
            setMensaje(res.data.mensaje);
        } catch (err) {
            console.error('Error generando preview real:', err);
            setError('Error al generar la vista previa con datos reales.');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        if (open) {
            obtenerCampañas();
            setMensaje('');
            setCampañaId('');
        }
    }, [open]);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>Vista previa con datos reales</DialogTitle>
            <DialogContent dividers>
                <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Seleccioná una campaña</InputLabel>
                    <Select
                        value={campañaId}
                        label="Seleccioná una campaña"
                        onChange={(e) => setCampañaId(e.target.value)}
                    >
                        {campañas.map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                                {c.nombre}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Button
                    variant="contained"
                    fullWidth
                    onClick={generarPreview}
                    disabled={!campañaId}
                    sx={{ mb: 3, backgroundColor: '#075E54', fontFamily: commonFont, textTransform: 'none' }}
                >
                    Generar vista previa
                </Button>

                {cargando ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress />
                    </Box>
                ) : mensaje ? (
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 3,
                            minHeight: 120,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: '1rem'
                        }}
                    >
                        {mensaje}
                    </Paper>
                ) : error ? (
                    <Typography color="error">{error}</Typography>
                ) : null}
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={onClose}
                    sx={{
                        backgroundColor: '#075E54',
                        color: '#fff',
                        fontFamily: commonFont,
                        textTransform: 'none',
                        '&:hover': {
                            backgroundColor: '#064e45',
                        }
                    }}
                >
                    Cerrar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PreviewTemplateReal;