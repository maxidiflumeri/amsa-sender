import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import {
    Box,
    CircularProgress,
    Paper,
    Typography,
    TextField,
    MenuItem,
    Button,
    Snackbar
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const PreviewTemplate = () => {
    const { id } = useParams();
    const [html, setHtml] = useState('');
    const [asunto, setAsunto] = useState('');
    const [template, setTemplate] = useState(null);
    const [cuentas, setCuentas] = useState([]);
    const [smtpId, setSmtpId] = useState('');
    const [destino, setDestino] = useState('');
    const [loading, setLoading] = useState(true);
    const [enviando, setEnviando] = useState(false);
    const [feedback, setFeedback] = useState({
        open: false,
        message: '',
        type: 'success' // o 'error'
    });

    useEffect(() => {
        const cargarVistaPrevia = async () => {
            try {
                const { data: tpl } = await api.get(`/email/templates/${id}`);
                setTemplate(tpl);

                const datosMock = {
                    nombre: 'Juan Pérez',
                    mail: 'juan@example.com',
                    direccion: 'Calle Falsa 123',
                    ciudad: 'Buenos Aires',
                    deuact: '15300',
                    deuhist: '10000',
                    usernum1: '1122334455',
                    Codemp2: '1234567890'
                };

                const { data: preview } = await api.post('/email/templates/preview', {
                    html: tpl.html,
                    datos: datosMock,
                    asunto: tpl.asunto
                });

                setHtml(preview.html);
                setAsunto(preview.asunto);

                const { data: cuentasSmtp } = await api.get('/email/cuentas');
                setCuentas(cuentasSmtp);
            } catch (error) {
                console.error('Error generando vista previa', error);
                setHtml('<p>Error generando la vista previa.</p>');
            } finally {
                setLoading(false);
            }
        };

        cargarVistaPrevia();
    }, [id]);

    const handleEnviar = async () => {
        if (!smtpId || !destino) {
            alert('Por favor seleccioná una cuenta SMTP y escribí un destino');
            return;
        }

        setEnviando(true);
        try {
            await api.post('/email/envio/enviar-preview', {
                html,
                subject: asunto,
                to: destino,
                smtpId: Number(smtpId)
            });

            setFeedback({
                open: true,
                type: 'success',
                message: 'Correo enviado exitosamente',
            });
        } catch (error) {
            console.error('Error al enviar correo', error);
            setFeedback({
                open: true,
                type: 'error',
                message: 'Error al enviar el correo',
            });
        } finally {
            setEnviando(false);
        }
    };

    if (loading) return <CircularProgress />;

    return (
        <>

            <Box p={2}>
                <Typography variant="h5" gutterBottom>
                    Vista previa del template: {template.nombre}
                </Typography>

                <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
                    <Box mt={3} display="flex" flexDirection="column" gap={2}>
                        <TextField
                            label="Cuenta SMTP"
                            select
                            fullWidth
                            value={smtpId}
                            onChange={(e) => setSmtpId(e.target.value)}
                        >
                            {cuentas.map((cuenta) => (
                                <MenuItem key={cuenta.id} value={cuenta.id}>
                                    {cuenta.nombre} ({cuenta.usuario})
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            label="Email de destino"
                            fullWidth
                            value={destino}
                            onChange={(e) => setDestino(e.target.value)}
                        />

                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleEnviar}
                            disabled={enviando}
                            startIcon={
                                enviando ? (
                                    <CircularProgress size={18} color="inherit" />
                                ) : null
                            }
                        >
                            {enviando ? 'Enviando...' : 'Enviar Email'}
                        </Button>
                    </Box>
                    {/* Asunto renderizado */}
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, mt: 5 }}>
                        <strong>Asunto:</strong> {asunto || 'Sin asunto'}
                    </Typography>

                    {/* Contenido del email */}
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                </Paper>
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

export default PreviewTemplate;