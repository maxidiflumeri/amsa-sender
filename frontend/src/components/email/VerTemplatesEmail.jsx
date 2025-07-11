import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Tooltip,
    TextField,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import {
    Visibility as VisibilityIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Add as AddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import dayjs from 'dayjs';
import MuiAlert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const VerTemplatesEmail = () => {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [templates, setTemplates] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const navigate = useNavigate();
    const [feedback, setFeedback] = useState({
        open: false,
        message: '',
        type: 'success' // o 'error'
    });
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const { data } = await api.get('/email/templates');
                setTemplates(data);
            } catch (error) {
                console.error('Error al obtener los templates', error);
            }
        };

        fetchTemplates();
    }, []);

    const handleEliminar = async () => {
        try {
            await api.delete(`email/templates/${selectedTemplate.id}`);
            setTemplates((prev) => prev.filter((tpl) => tpl.id !== selectedTemplate.id));
            setFeedback({
                open: true,
                type: 'success',
                message: 'Template eliminado correctamente'
            });

        } catch (error) {
            console.error('Error al eliminar template', error);
            setFeedback({
                open: true,
                type: 'error',
                message: 'Error al eliminar el template'
            });
        }
        setDialogOpen(false);
        setSelectedTemplate(null);
    };

    // 🔍 Filtro por nombre
    const templatesFiltrados = templates.filter((tpl) =>
        tpl.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <>
            <Box sx={{ mt: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
                    <Typography variant="h5" fontWeight="bold">
                        Templates de Email
                    </Typography>

                    <Button
                        sx={{
                            px: 2,
                            py: 1,
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
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/email/crearTemplate')}
                    >
                        Nuevo Template
                    </Button>
                </Box>

                <Paper elevation={3}>
                    <Box sx={{ p: 2, m: 2 }}>
                        <TextField
                            label="Buscar por nombre"
                            variant="outlined"
                            size="small"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            sx={{ width: '100%' }}
                        />
                    </Box>

                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Nombre</TableCell>
                                    <TableCell>Asunto</TableCell>
                                    <TableCell>Fecha de creación</TableCell>
                                    <TableCell align="right">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {templatesFiltrados.map((tpl) => (
                                    <TableRow key={tpl.id}>
                                        <TableCell>{tpl.nombre}</TableCell>
                                        <TableCell>{tpl.asunto}</TableCell>
                                        <TableCell>
                                            {tpl.creadoAt ? dayjs(tpl.creadoAt).format('DD/MM/YYYY HH:mm') : 'Sin fecha'}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="Vista previa">
                                                <IconButton onClick={() => navigate(`/preview-template/${tpl.id}`)}>
                                                    <VisibilityIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Editar">
                                                <IconButton onClick={() => navigate(`/email/crearTemplate?id=${tpl.id}`)}>
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Eliminar">
                                                <IconButton onClick={() => {
                                                    setSelectedTemplate(tpl);
                                                    setDialogOpen(true);
                                                }}>
                                                    <DeleteIcon color="error" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {templatesFiltrados.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center">
                                            No se encontraron templates.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Box>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle>¿Eliminar template?</DialogTitle>
                <DialogContent>
                    <Typography>
                        ¿Esta seguro que desea eliminar el template "{selectedTemplate?.nombre}"? Esta acción no se puede deshacer.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)} color="secondary">
                        Cancelar
                    </Button>
                    <Button sx={{
                        px: 2,
                        py: 1,
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
                    }} onClick={handleEliminar} color="primary" variant="contained">
                        Confirmar
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={feedback.open}
                autoHideDuration={3000}
                onClose={() => setFeedback({ ...feedback, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <MuiAlert
                    elevation={6}
                    variant="filled"
                    severity={feedback.type}
                    onClose={() => setFeedback({ ...feedback, open: false })}
                    icon={<CheckCircleIcon fontSize="inherit" />}
                >
                    {feedback.message}
                </MuiAlert>
            </Snackbar>
        </>
    );
};

export default VerTemplatesEmail;