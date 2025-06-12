import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,    
    Box,
    CircularProgress,
    IconButton,
    Tooltip,
    useTheme,
    Fade,
    Autocomplete,
    TextField
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import api from '../api/axios';

const PreviewTemplateReal = ({ open, onClose, templateId }) => {
    const theme = useTheme();
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [campañas, setCampañas] = useState([]);
    const [campañaId, setCampañaId] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [copiado, setCopiado] = useState(false);

    const obtenerCampañas = async () => {
        try {
            const res = await api.get('/campanias');
            const ordenadas = res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setCampañas(ordenadas);
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

    const copiarAlPortapapeles = async () => {
        try {
            await navigator.clipboard.writeText(mensaje);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch (err) {
            console.error('Error al copiar:', err);
        }
    };

    const obtenerHoraActual = () => {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    useEffect(() => {
        if (open) {
            obtenerCampañas();
            setMensaje('');
            setCampañaId('');
        }
    }, [open]);

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
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>Vista previa tipo WhatsApp</DialogTitle>
            <DialogContent dividers>
                <Autocomplete
                    fullWidth
                    options={campañas.slice(0, 15)}// últimas 10 campañas
                    getOptionLabel={(option) => option.nombre}
                    value={campañas.find((c) => c.id === campañaId) || null}
                    onChange={(event, newValue) => {
                        setCampañaId(newValue ? newValue.id : '');
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Seleccioná una campaña"
                            variant="outlined"
                            sx={{ mb: 3 }}
                        />
                    )}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                />
                <Button
                    variant="contained"
                    fullWidth
                    onClick={generarPreview}
                    disabled={!campañaId}
                    sx={{
                        mb: 3,
                        backgroundColor: '#075E54',
                        fontFamily: commonFont,
                        textTransform: 'none'
                    }}
                >
                    Generar vista previa
                </Button>

                {cargando ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress />
                    </Box>
                ) : mensaje ? (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#e5ddd5',
                            borderRadius: 2,
                            p: 2,
                            minHeight: 200
                        }}
                    >
                        {/* Mensaje entrante simulado */}
                        <Fade in={true} timeout={500}>
                            <Box
                                sx={{
                                    backgroundColor: theme.palette.mode === 'dark' ? '#2a2f32' : '#fff',
                                    color: theme.palette.mode === 'dark' ? '#e9edef' : '#000',
                                    borderRadius: '16px',
                                    px: 2,
                                    py: 1.5,
                                    maxWidth: '75%',
                                    display: 'inline-block',
                                    boxShadow: 2,
                                    fontSize: '1rem',
                                    fontFamily: commonFont,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}
                            >
                                Hola, quería saber más sobre sus servicios.
                                <Box sx={{ fontSize: '0.75rem', color: '#aaa', textAlign: 'right', mt: 1 }}>
                                    {obtenerHoraActual()}
                                </Box>
                            </Box>
                        </Fade>

                        {/* Mensaje saliente generado */}
                        <Fade in={true} timeout={700}>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
                                <Box
                                    sx={{
                                        backgroundColor: theme.palette.mode === 'dark' ? '#005c4b' : '#dcf8c6',
                                        color: theme.palette.mode === 'dark' ? '#fff' : '#000',
                                        borderRadius: '16px',
                                        px: 2,
                                        py: 1.5,
                                        maxWidth: '75%',
                                        boxShadow: 3,
                                        fontSize: '1rem',
                                        fontFamily: commonFont,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        position: 'relative'
                                    }}
                                >
                                    <span
                                        dangerouslySetInnerHTML={{
                                            __html: parsearFormatoWhatsApp(mensaje),
                                        }}
                                    />
                                    <Box sx={{
                                        fontSize: '0.75rem', color: theme.palette.mode === 'dark' ? '#ccd' : '#555'
                                        , textAlign: 'right', mt: 1
                                    }}>
                                        {obtenerHoraActual()}
                                    </Box>
                                </Box>
                                <Tooltip title={copiado ? "¡Copiado!" : "Copiar"}>
                                    <IconButton
                                        onClick={copiarAlPortapapeles}
                                        sx={{
                                            ml: 1,
                                            mt: 'auto',
                                            color: theme.palette.mode === 'dark' ? '#fff' : '#555'
                                        }}
                                    >
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Fade>
                    </Box>
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