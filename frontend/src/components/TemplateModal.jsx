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
    Alert,
    Autocomplete
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import api from '../api/axios';
import { useTheme } from '@mui/material/styles';

export default function TemplateModal({ open, onClose, onSave, templateToEdit }) {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
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

            api.get('/whatsapp/campanias')
                .then(res => {
                    const ordenadas = res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    setCampañas(ordenadas);
                })
                .catch(err => console.error('Error al obtener campañas:', err));
        }
    }, [open, templateToEdit]);

    const insertarVariable = (variable) => {
        const textarea = document.querySelector('textarea');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const textoAntes = contenido.substring(0, start);
        const textoDespues = contenido.substring(end);
        const insertar = `{{${variable}}}`;

        const nuevoContenido = textoAntes + insertar + textoDespues;
        setContenido(nuevoContenido);

        // Volver a enfocar el textarea y ubicar el cursor después del texto insertado
        setTimeout(() => {
            textarea.focus();
            const nuevaPos = start + insertar.length;
            textarea.setSelectionRange(nuevaPos, nuevaPos);
        }, 0);
    };

    const handleSeleccionCampañaReferencia = async (id) => {
        setCampañaReferenciaId(id);
        try {
            const [varsRes, contactoRes] = await Promise.all([
                api.get(`/whatsapp/campanias/${id}/variables`),
                api.get(`/whatsapp/campanias/${id}/primer-contacto`)
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
            const res = await api.post('/whatsapp/templates/preview', {
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

    const insertarFormato = (tipo) => {
        const textarea = document.querySelector('textarea');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const seleccionado = contenido.substring(start, end);

        let formatoInicio = '';
        let formatoFin = '';

        switch (tipo) {
            case 'negrita':
                formatoInicio = '*';
                formatoFin = '*';
                break;
            case 'cursiva':
                formatoInicio = '_';
                formatoFin = '_';
                break;
            case 'tachado':
                formatoInicio = '~';
                formatoFin = '~';
                break;
            case 'monoespaciado':
                formatoInicio = '`';
                formatoFin = '`';
                break;
            case 'salto':
                const nuevoContenidoSalto = contenido.substring(0, start) + '\n' + contenido.substring(end);
                setContenido(nuevoContenidoSalto);
                setTimeout(() => {
                    textarea.focus();
                    textarea.setSelectionRange(start + 1, start + 1);
                }, 0);
                return;
        }

        const nuevoContenido =
            contenido.substring(0, start) +
            formatoInicio +
            (seleccionado || '') +
            formatoFin +
            contenido.substring(end);

        setContenido(nuevoContenido);

        // Reposicionar el cursor
        setTimeout(() => {
            textarea.focus();
            const nuevaPos = start + formatoInicio.length + (seleccionado ? seleccionado.length : 0) + formatoFin.length;
            textarea.setSelectionRange(nuevaPos, nuevaPos);
        }, 0);
    };

    const parsearFormatoWhatsApp = (texto) => {
        if (!texto) return '';

        return texto
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/~(.*?)~/g, '<s>$1</s>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br />');
    };

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

                <Autocomplete
                    fullWidth
                    sx={{ mb: 2 }}
                    options={campañas.slice(0, 15)}// últimas 10 campañas
                    getOptionLabel={(option) => option.nombre}
                    value={campañas.find((c) => c.id === campañaReferenciaId) || null}
                    onChange={(event, newValue) => {
                        if (newValue) {
                            handleSeleccionCampañaReferencia(newValue.id);
                        } else {
                            setCampañaReferenciaId('');
                            setVariablesDisponibles([]);
                            setDatosEjemplo({});
                        }
                    }}
                    renderInput={(params) => (
                        <TextField {...params} label="Campaña de referencia" />
                    )}
                />

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

                <Typography variant="subtitle1" sx={{ mb: 1 }}>Contenido del mensaje</Typography>

                <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
                    <Button size="small" variant="outlined" onClick={() => insertarFormato('negrita')}>Negrita</Button>
                    <Button size="small" variant="outlined" onClick={() => insertarFormato('cursiva')}>Cursiva</Button>
                    <Button size="small" variant="outlined" onClick={() => insertarFormato('tachado')}>Tachado</Button>
                    <Button size="small" variant="outlined" onClick={() => insertarFormato('monoespaciado')}>Monoespaciado</Button>
                    <Button size="small" variant="outlined" onClick={() => insertarFormato('salto')}>↵ Salto de línea</Button>
                </Box>

                <textarea
                    value={contenido}
                    onChange={(e) => setContenido(e.target.value)}
                    rows={6}
                    style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '4px',
                        border: `1px solid ${theme.palette.divider}`,
                        backgroundColor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        resize: 'vertical'
                    }}
                />

                <Typography variant="subtitle1" gutterBottom>Vista previa visual:</Typography>
                <Box
                    sx={{
                        border: '1px solid',
                        borderColor: theme.palette.divider,
                        padding: 2,
                        borderRadius: 1,
                        backgroundColor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        maxHeight: 200,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                    }}
                    dangerouslySetInnerHTML={{ __html: parsearFormatoWhatsApp(contenido) }}
                />
            </DialogContent>

            <DialogActions>
                <Button
                    variant="contained"
                    onClick={handleGuardar}
                    sx={{
                        borderRadius: 2,
                        fontFamily: commonFont,
                        textTransform: 'none',
                        fontSize: '0.9rem',
                        backgroundColor: '#075E54',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            backgroundColor: '#0b7b65',
                            transform: 'scale(1.03)',
                            boxShadow: 4,
                        },
                    }}
                    disabled={!camposCompletos}
                >
                    Guardar
                </Button>
            </DialogActions>
        </Dialog>
    );
}