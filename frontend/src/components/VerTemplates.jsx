import React, { useEffect, useState } from 'react';
import {
    Typography,
    Paper,
    Box,
    IconButton,
    Button,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Snackbar,
    Alert,
    TextField,
    InputAdornment,
    Card,
    CardContent,
    CardActions,    
    Pagination,
    MenuItem,
    Select,
    FormControl,
    InputLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import api from '../api/axios';
import TemplateModal from './TemplateModal';
import PreviewTemplateReal from './PreviewTemplateReal';
import ArticleIcon from '@mui/icons-material/Article';

export default function VerTemplates() {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [templateAEliminar, setTemplateAEliminar] = useState(null);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
    const [busqueda, setBusqueda] = useState('');
    const [expandedTemplateId, setExpandedTemplateId] = useState(null);
    const [paginaActual, setPaginaActual] = useState(1);
    const [templatesPorPagina, setTemplatesPorPagina] = useState(3);

    const cargarTemplates = async () => {
        try {
            const res = await api.get('/whatsapp/templates');
            setTemplates(res.data);
        } catch (err) {
            console.error('Error al cargar templates', err);
        } finally {
            setLoading(false);
        }
    };

    const confirmarEliminarTemplate = (template) => {
        setTemplateAEliminar(template);
        setConfirmDialogOpen(true);
    };

    const eliminarTemplate = async () => {
        try {
            await api.delete(`/whatsapp/templates/${templateAEliminar.id}`);
            setTemplateAEliminar(null);
            setConfirmDialogOpen(false);
            setMensaje({ tipo: 'success', texto: 'Template eliminado correctamente' });
            setSnackbarOpen(true);
            await cargarTemplates();
        } catch (err) {
            console.error('Error al eliminar template', err);
        }
    };

    useEffect(() => {
        cargarTemplates();
    }, []);

    const templatesFiltrados = templates.filter(t =>
        t.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    const totalPaginas = Math.ceil(templatesFiltrados.length / templatesPorPagina);
    const templatesPaginados = templatesFiltrados.slice(
        (paginaActual - 1) * templatesPorPagina,
        paginaActual * templatesPorPagina
    );

    const handleExpandClick = (id) => {
        setExpandedTemplateId(prev => (prev === id ? null : id));
    };

    const shouldShowExpand = (text) => {
        const lineCount = text?.split('\n').length || 0;
        return lineCount > 3;
    };

    return (
        <Box
            sx={{
                py: 3
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box display="flex" alignItems="center">
                    <ArticleIcon sx={{ fontSize: 32 }} />
                    <Typography ml={1} variant="h5" fontWeight="bold">
                        Templates de WhatsApp
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                        setSelectedTemplate(null);
                        setOpenDialog(true);
                    }}
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
                >
                    Crear nuevo
                </Button>
            </Box>

            <Box sx={{ mb: 2 }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Buscar template por nombre..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" />
                            </InputAdornment>
                        ),
                    }}
                />
            </Box>

            {loading ? (
                <Typography sx={{ p: 2 }}>Cargando templates...</Typography>
            ) : templatesFiltrados.length === 0 ? (
                <Typography sx={{ p: 2 }}>No hay templates que coincidan.</Typography>
            ) : (
                <>
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        {templatesPaginados.map((template) => {
                            const isExpanded = expandedTemplateId === template.id;
                            const showExpand = shouldShowExpand(template.contenido);
                            const contenidoVisible = showExpand && !isExpanded
                                ? template.contenido.split('\n').slice(0, 3).join('\n') + '...'
                                : template.contenido;

                            return (
                                <Card key={template.id} variant="outlined" sx={{ borderRadius: 3, boxShadow: 3 }}>
                                    <CardContent>
                                        <Typography variant="h6">{template.nombre}</Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{ whiteSpace: 'pre-line', mt: 1, fontSize: '0.95rem' }}
                                        >
                                            {contenidoVisible}
                                        </Typography>
                                    </CardContent>
                                    <CardActions sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', px: 2, pb: 2 }}>
                                        <Box sx={{ display: 'flex', gap: 1, order: 2 }}>
                                            <Tooltip title="Previsualizar con datos reales">
                                                <IconButton onClick={() => {
                                                    setSelectedTemplateId(template.id);
                                                    setPreviewOpen(true);
                                                }}>
                                                    <VisibilityIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Editar">
                                                <IconButton color="info" onClick={() => {
                                                    setSelectedTemplate(template);
                                                    setOpenDialog(true);
                                                }}>
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Eliminar">
                                                <IconButton color="error" onClick={() => confirmarEliminarTemplate(template)}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                        <Box sx={{ order: 1 }}>
                                            {showExpand && (
                                                <Button
                                                    onClick={() => handleExpandClick(template.id)}
                                                    endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                    size="small"
                                                    sx={{ textTransform: 'none' }}
                                                >
                                                    {isExpanded ? 'Ver menos' : 'Ver más'}
                                                </Button>
                                            )}
                                        </Box>
                                    </CardActions>
                                </Card>
                            );
                        })}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, flexWrap: 'wrap', gap: 2 }}>
                        <Typography variant="body2" sx={{ ml: 1 }}>
                            Mostrando {(paginaActual - 1) * templatesPorPagina + 1}-{Math.min(paginaActual * templatesPorPagina, templatesFiltrados.length)} de {templatesFiltrados.length} templates
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                            <FormControl variant="outlined" size="small">
                                <InputLabel>Por página</InputLabel>
                                <Select
                                    label="Por página"
                                    value={templatesPorPagina}
                                    onChange={(e) => {
                                        setTemplatesPorPagina(Number(e.target.value));
                                        setPaginaActual(1);
                                    }}
                                >
                                    {[3, 5, 10, 20].map(num => (
                                        <MenuItem key={num} value={num}>{num}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Pagination
                                count={totalPaginas}
                                page={paginaActual}
                                onChange={(e, page) => setPaginaActual(page)}
                                color="primary"
                            />
                        </Box>
                    </Box>
                </>
            )}

            <TemplateModal
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                templateToEdit={selectedTemplate}
                onSave={async (data) => {
                    try {
                        if (selectedTemplate) {
                            await api.put(`/whatsapp/templates/${selectedTemplate.id}`, data);
                            setMensaje({ tipo: 'success', texto: 'Template actualizado correctamente' });
                        } else {
                            await api.post('/whatsapp/templates', data);
                            setMensaje({ tipo: 'success', texto: 'Template creado correctamente' });
                        }
                        await cargarTemplates();
                        setSnackbarOpen(true);
                    } catch (err) {
                        console.error('Error al guardar template', err);
                    }
                }}
            />

            <PreviewTemplateReal
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                templateId={selectedTemplateId}
            />

            <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
                <DialogTitle>¿Eliminar template?</DialogTitle>
                <DialogContent>
                    <Typography>
                        ¿Estás seguro de que querés eliminar el template{' '}
                        <strong>{templateAEliminar?.nombre}</strong>?<br />
                        Esta acción no se puede deshacer.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialogOpen(false)}>Cancelar</Button>
                    <Button
                        onClick={eliminarTemplate}
                        color="error"
                        variant="contained"
                        sx={{ textTransform: 'none' }}
                    >
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    elevation={6}
                    variant="filled"
                    severity={mensaje.tipo}
                    onClose={() => setSnackbarOpen(false)}
                >
                    {mensaje.texto}
                </Alert>
            </Snackbar>
        </Box>
    );
}