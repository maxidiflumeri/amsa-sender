import React, { useEffect, useState } from 'react';
import {
    Typography,
    Paper,
    Box,
    IconButton,
    Button,
    List,
    ListItem,
    ListItemText,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Snackbar,
    Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import api from '../api/axios';
import TemplateModal from './TemplateModal';
import PreviewTemplateReal from './PreviewTemplateReal';

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

    const cargarTemplates = async () => {
        try {
            const res = await api.get('/templates');
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
            await api.delete(`/templates/${templateAEliminar.id}`);
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

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Templates</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                        setSelectedTemplate(null);
                        setOpenDialog(true);
                    }}
                    sx={{ backgroundColor: '#075E54', fontFamily: commonFont, textTransform: 'none' }}
                >
                    Crear nuevo
                </Button>
            </Box>

            <Paper elevation={3}>
                {loading ? (
                    <Typography sx={{ p: 2 }}>Cargando templates...</Typography>
                ) : templates.length === 0 ? (
                    <Typography sx={{ p: 2 }}>No hay templates aún.</Typography>
                ) : (
                    <List>
                        {templates.map((template) => (
                            <ListItem
                                key={template.id}
                                secondaryAction={
                                    <>
                                        <Tooltip title="Previsualizar con datos reales">
                                            <IconButton
                                                edge="end"
                                                onClick={() => {
                                                    setSelectedTemplateId(template.id);
                                                    setPreviewOpen(true);
                                                }}
                                            >
                                                <VisibilityIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Editar">
                                            <IconButton edge="end" color="info" onClick={() => {
                                                setSelectedTemplate(template);
                                                setOpenDialog(true);
                                            }}>
                                                <EditIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Eliminar">
                                            <IconButton
                                                edge="end"
                                                color="error"
                                                onClick={() => confirmarEliminarTemplate(template)}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </>
                                }
                            >
                                <ListItemText
                                    primary={template.nombre}
                                    secondary={template.contenido}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </Paper>

            <TemplateModal
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                templateToEdit={selectedTemplate}
                onSave={async (data) => {
                    try {
                        if (selectedTemplate) {
                            await api.put(`/templates/${selectedTemplate.id}`, data);
                            setMensaje({ tipo: 'success', texto: 'Template actualizado correctamente' });
                        } else {
                            await api.post('/templates', data);
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