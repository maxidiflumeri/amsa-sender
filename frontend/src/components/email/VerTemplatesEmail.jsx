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
    Tooltip
} from '@mui/material';
import {
    Visibility as VisibilityIcon,
    Send as SendIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Add as AddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const VerTemplatesEmail = () => {
    const [templates, setTemplates] = useState([]);
    const navigate = useNavigate();

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

    const handleEliminar = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este template?')) return;
        try {
            await api.delete(`/templates/${id}`);
            setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
        } catch (error) {
            console.error('Error al eliminar template', error);
        }
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5" fontWeight="bold">
                    Templates de Email
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/email/crearTemplate')}
                >
                    Nuevo Template
                </Button>
            </Box>

            <Paper elevation={3}>
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
                            {templates.map((tpl) => (
                                <TableRow key={tpl.id}>
                                    <TableCell>{tpl.nombre}</TableCell>
                                    <TableCell>{tpl.asunto}</TableCell>
                                    <TableCell>
                                        {new Date(tpl.createdAt).toLocaleString()}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Vista previa">
                                            <IconButton onClick={() => navigate(`/preview-template/${tpl.id}`)}>
                                                <VisibilityIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Enviar">
                                            <IconButton onClick={() => navigate(`/enviar-template/${tpl.id}`)}>
                                                <SendIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Editar">
                                            <IconButton onClick={() => navigate(`/email/crearTemplate?id=${tpl.id}`)}>
                                                <EditIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Eliminar">
                                            <IconButton onClick={() => handleEliminar(tpl.id)}>
                                                <DeleteIcon color="error" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {templates.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} align="center">
                                        No hay templates cargados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default VerTemplatesEmail;
