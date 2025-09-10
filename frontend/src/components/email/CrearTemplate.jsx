import { useEffect, useRef, useState } from 'react';
import {
    Box,
    IconButton,
    Grid,
    MenuItem,
    Paper,
    Select,
    TextField,
    Typography,
    Popover,
    Snackbar
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import EditorTemplate from './EditorTemplate';
import api from '../../api/axios';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import { useSearchParams } from 'react-router-dom';
import MuiAlert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const CrearTemplate = () => {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [searchParams] = useSearchParams();
    const theme = useTheme();
    const emailEditorRef = useRef(null);
    const [nombre, setNombre] = useState('');
    const [asunto, setAsunto] = useState('');
    const [anchorEl, setAnchorEl] = useState(null);
    const templateId = searchParams.get('id');
    const [design, setDesign] = useState(null);
    const [html, setHtml] = useState(null);
    const isEdicion = !!templateId;
    const [feedback, setFeedback] = useState({
        open: false,
        message: '',
        type: 'success' // o 'error'
    });
    const [errorNombre, setErrorNombre] = useState(false);
    const [errorAsunto, setErrorAsunto] = useState(false);

    useEffect(() => {
        if (templateId) {
            api.get(`/email/templates/${templateId}`).then((res) => {
                const { nombre, asunto, html, design } = res.data;
                setNombre(nombre);
                setAsunto(asunto);
                setDesign(design);
                setHtml(html);
            });
        }
    }, [templateId]);

    const variablesDisponibles = [
        'mail',
        'nombre',
        'id_contacto',
        'Telefono_1',
        'Telefono_2',
        'direccion',
        'ciudad',
        'Empresa',
        'deuhist',
        'deuact',
        'Filer',
        'Nroemp',
        'remesa',
        'Cuitdoc',
        'Codemp2',
        'codpos',
        'f_recepc',
        'f_cierre',
        'Usercode2',
        'Usercode3',
        'Usercode4',
        'usernum0',
        'usernum1',
        'usernum2',
        'codbar',
        'codbar_2',
        'Usercode1',
        'co1',
        'userfec5'
    ];

    const insertarVariableEnAsunto = (variable) => {
        setAsunto((prev) => prev + ` {{${variable}}}`);
    };

    const handleEmojiClick = (emoji) => {
        setAsunto((prev) => prev + emoji.native);
        setAnchorEl(null);
    };

    const handleOpenEmoji = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseEmoji = () => {
        setAnchorEl(null);
    };

    return (
        <>

            <Box sx={{ mt: 2 }}>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h5" gutterBottom>
                        Crear nuevo template de email
                    </Typography>

                    {/* Fila 1 */}
                    <Box mb={2}>
                        <TextField
                            size="small"
                            fullWidth
                            label="Nombre del template"
                            value={nombre}
                            onChange={(e) => {
                                setNombre(e.target.value)
                                setErrorNombre(false);
                            }}
                            error={errorNombre}
                            helperText={errorNombre ? 'El nombre del template es obligatorio' : ''}
                        />
                    </Box>

                    {/* Fila 2 */}
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 8 }}>
                            <Box>
                                <TextField
                                    size="small"
                                    fullWidth
                                    label="Asunto del email"
                                    value={asunto}
                                    onChange={(e) => {
                                        setAsunto(e.target.value)
                                        setErrorAsunto(false);
                                    }}
                                    error={errorAsunto}
                                    helperText={errorAsunto ? 'El asunto es obligatorio' : ''}
                                />
                            </Box>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 2 }}>
                            <Box >
                                <Select
                                    size="small"
                                    displayEmpty
                                    fullWidth
                                    value=""
                                    onChange={(e) => insertarVariableEnAsunto(e.target.value)}
                                    sx={{ minWidth: 0 }} // clave
                                >
                                    <MenuItem disabled value="">
                                        Insertar variable
                                    </MenuItem>
                                    {variablesDisponibles.map((v) => (
                                        <MenuItem key={v} value={v}>{`{{${v}}}`}</MenuItem>
                                    ))}
                                </Select>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={2}>
                            <IconButton onClick={handleOpenEmoji} color="primary">
                                <EmojiEmotionsIcon />
                            </IconButton>
                            <Popover
                                open={Boolean(anchorEl)}
                                anchorEl={anchorEl}
                                onClose={handleCloseEmoji}
                                anchorOrigin={{
                                    vertical: 'bottom',
                                    horizontal: 'right',
                                }}
                                transformOrigin={{
                                    vertical: 'top',
                                    horizontal: 'right',
                                }}
                                container={document.body}
                                disablePortal={false}
                                sx={{
                                    '& .MuiPaper-root': {
                                        maxHeight: '80vh',
                                        overflowY: 'auto',
                                        width: '360px', // forzamos un ancho razonable
                                    }
                                }}
                            >
                                <Picker
                                    data={data}
                                    onEmojiSelect={handleEmojiClick}
                                    theme={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                                    previewPosition="none"
                                />
                            </Popover>
                        </Grid>
                    </Grid>
                </Paper>

                <Box sx={{ overflow: 'hidden', mt: 2, border: '1px solid #ccc', borderRadius: 2, boxShadow: 2 }}>
                    <EditorTemplate
                        ref={emailEditorRef}
                        initialDesign={design} // 👈 Le pasás el diseño
                        onGuardar={({ html, design }) => {
                            if (!nombre.trim()) {
                                setErrorNombre(true);
                                return;
                            }
                            if (!asunto.trim()) {
                                setErrorAsunto(true);
                                return;
                            }
                            if (!isEdicion) {
                                api.post('/email/templates', {
                                    nombre,
                                    asunto,
                                    html,
                                    design
                                }).then(() => {
                                    setFeedback({
                                        open: true,
                                        type: 'success',
                                        message: 'Template creado correctamente',
                                    });
                                }).catch((error) => {
                                    setFeedback({
                                        open: true,
                                        type: 'error',
                                        message: 'Error al crear el template',
                                    });
                                    console.error('Error al crear template', error);
                                });
                            } else {
                                api.put(`/email/templates/${templateId}`, {
                                    nombre,
                                    asunto,
                                    html,
                                    design
                                }).then(() => {
                                    setFeedback({
                                        open: true,
                                        type: 'success',
                                        message: 'Template editado correctamente',
                                    });
                                }).catch((error) => {
                                    setFeedback({
                                        open: true,
                                        type: 'error',
                                        message: 'Error al editar el template',
                                    });
                                    console.error('Error al editar template', error);
                                });
                            }
                        }}
                    />
                </Box>
            </Box>
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

export default CrearTemplate;