import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    IconButton,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Alert,
    CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import api from '../api/axios';
import { useTheme } from '@mui/material/styles';

export default function TemplateModal({ open, onClose, onSave, templateToEdit }) {
    const theme = useTheme();
    const [nombre, setNombre] = useState('');
    const [contenido, setContenido] = useState('');
    const [vistaPrevia, setVistaPrevia] = useState('');
    const [datosEjemplo, setDatosEjemplo] = useState({});
    const [mensaje, setMensaje] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    const [campañas, setCampañas] = useState([]);
    const [campañaReferenciaId, setCampañaReferenciaId] = useState('');
    const [variablesDisponibles, setVariablesDisponibles] = useState([]);

    useEffect(() => {
        if (open) {
            setMensaje(null);
            setVistaPrevia('');
            setCampañaReferenciaId('');
            setVariablesDisponibles([]);
            setDatosEjemplo({});

            if (templateToEdit) {
                setNombre(templateToEdit.nombre || '');
                setContenido(templateToEdit.contenido || '');
            } else {
                setNombre('');
                setContenido('');
            }

            api.get('/campanias')
                .then(res => setCampañas(res.data))
                .catch(err => console.error('Error al obtener campañas:', err));
        }
    }, [open, templateToEdit]);

    const insertarVariable = (variable) => {
        setContenido((prev) => `${prev}{{${variable}}}`);
    };

    const handleSeleccionCampañaReferencia = async (id) => {
        setCampañaReferenciaId(id);
        try {
            const [varsRes, contactoRes] = await Promise.all([
                api.get(`/campanias/${id}/variables`),
                api.get(`/campanias/${id}/primer-contacto`)
            ]);
            setVariablesDisponibles(varsRes.data);
            setDatosEjemplo(contactoRes.data?.datos || {});
        } catch (err) {
            console.error('Error cargando datos de referencia:', err);
        }
    };

    const generarVistaPrevia = async () => {
        if (!contenido.trim() || !campañaReferenciaId) return;
        setLoadingPreview(true);
        try {
            const res = await api.post('/templates/preview', {
                templateId: templateToEdit?.id,
                ejemplo: datosEjemplo,
                contenido: contenido
            });
            setVistaPrevia(res.data.mensaje);
        } catch (err) {
            setVistaPrevia('[Error generando vista previa]');
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleGuardar = async () => {
        if (!nombre.trim() || !contenido.trim()) {
            setMensaje({ tipo: 'error', texto: 'Completá todos los campos' });
            return;
        }
        try {
            await onSave({ nombre, contenido });
            onClose();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'Error al guardar el template' });
        }
    };

    const camposCompletos = nombre.trim() && contenido.trim() && campañaReferenciaId;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                {templateToEdit ? 'Editar template' : 'Crear nuevo template'}
                <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                {mensaje && (
                    <Alert severity={mensaje.tipo} sx={{ mb: 2 }}>{mensaje.texto}</Alert>
                )}

                <TextField
                    label="Nombre del template"
                    fullWidth
                    sx={{ mb: 2 }}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                />

                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Campaña de referencia</InputLabel>
                    <Select
                        value={campañaReferenciaId}
                        onChange={(e) => handleSeleccionCampañaReferencia(e.target.value)}
                        label="Campaña de referencia"
                    >
                        {campañas.map((c) => (
                            <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
                    {variablesDisponibles.map((variable) => (
                        <Button
                            key={variable}
                            variant="outlined"
                            size="small"
                            onClick={() => insertarVariable(variable)}
                        >
                            {`{{${variable}}}`}
                        </Button>
                    ))}
                </Box>

                <TextField
                    label="Contenido del mensaje"
                    multiline
                    minRows={4}
                    fullWidth
                    sx={{ mb: 2 }}
                    value={contenido}
                    onChange={(e) => setContenido(e.target.value)}
                />

                <Typography variant="subtitle1" gutterBottom>Vista previa:</Typography>
                <Box
                    sx={{
                        border: '1px solid',
                        borderColor: theme.palette.divider,
                        padding: 2,
                        borderRadius: 1,
                        backgroundColor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        maxHeight: 150,
                        overflowY: 'auto'
                    }}
                >
                    {loadingPreview ? <CircularProgress size={20} /> : vistaPrevia || '[Sin vista previa]'}
                </Box>
            </DialogContent>

            <DialogActions>
                <Button
                    sx={{ backgroundColor: '#075E54' }}
                    variant="contained"
                    onClick={generarVistaPrevia}
                    disabled={!camposCompletos || loadingPreview}
                >
                    Generar vista previa
                </Button>
                <Button
                    variant="contained"
                    onClick={handleGuardar}
                    sx={{ backgroundColor: '#075E54' }}
                    disabled={!camposCompletos}
                >
                    Guardar
                </Button>
            </DialogActions>
        </Dialog>
    );
}