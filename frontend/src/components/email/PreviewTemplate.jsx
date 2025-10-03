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
    Snackbar,
    Grid,
    useMediaQuery
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const PreviewTemplate = () => {
    const isMobile = useMediaQuery('(max-width:768px)');
    const isTablet = useMediaQuery('(max-width:1024px)');

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
        type: 'success' // 'success' | 'error' | 'warning' | 'info'
    });

    // ⚡ Campañas lite (sin contactos) y últimas 20
    const [campanias, setCampanias] = useState([]);
    const [campaniaId, setCampaniaId] = useState('');

    // 🧠 Cache para contactos por campaña
    const [contactosCache, setContactosCache] = useState({}); // { [id]: Array<Contactos> }
    const [cargandoContactos, setCargandoContactos] = useState(false);

    useEffect(() => {
        const cargarVistaPrevia = async () => {
            try {
                // Template
                const { data: tpl } = await api.get(`/email/templates/${id}`);
                setTemplate(tpl);

                // ⚡ Campañas lite
                const { data: todasLite } = await api.get('/email/campanias?lite=1');
                // Ordenar por createdAt desc y tomar las últimas 20
                const ultimas20 = (todasLite || [])
                    .slice()
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 20);

                setCampanias(ultimas20);

                // Cuentas SMTP
                const { data: cuentasSmtp } = await api.get('/email/cuentas');
                setCuentas(cuentasSmtp);
            } catch (error) {
                console.error('Error inicializando vista previa', error);
                setHtml('<p>Error generando la vista previa.</p>');
            } finally {
                setLoading(false);
            }
        };

        cargarVistaPrevia();
    }, [id]);

    // Reemplazá la función por esta versión
    const generarPreviewConDatos = async (datosContacto) => {
        // ⚠️ siempre mandar el html/asunto del template, no del state
        const htmlTpl = template?.html ?? '';
        const asuntoTpl = template?.asunto ?? '';

        try {
            const { data: previewReal } = await api.post('/email/templates/preview', {
                html: htmlTpl,
                asunto: asuntoTpl,
                datos: datosContacto ?? {}           // 👈 acá van los datos del contacto
            });
            setHtml(previewReal.html);
            setAsunto(previewReal.asunto);
        } catch (err) {
            console.error('Error generando preview con datos reales', err);
            setHtml('<p>Error generando la vista previa con datos reales.</p>');
            setAsunto(asuntoTpl);
            setFeedback({
                open: true,
                type: 'error',
                message: 'No se pudo generar la vista previa con datos reales.'
            });
        }
    };

    // Reemplazá onSelectCampania por esta versión
    const onSelectCampania = async (value) => {
        const campaniaIdNum = Number(value);
        setCampaniaId(campaniaIdNum || '');

        if (!campaniaIdNum) return;

        // Si ya hay cache, usarlo
        if (contactosCache[campaniaIdNum]?.length) {
            const lista = contactosCache[campaniaIdNum];
            const contacto = lista[Math.floor(Math.random() * lista.length)];
            await generarPreviewConDatos(contacto?.datos);  // 👈 pasar datos reales
            return;
        }

        const extraerItems = (resp) => Array.isArray(resp?.items) ? resp.items : [];
        setCargandoContactos(true);
        try {
            const { data: resp } = await api.get(`/email/campanias/${campaniaIdNum}/contactos`);
            const items = extraerItems(resp); // 👈 acá usamos .items

            setContactosCache((prev) => ({ ...prev, [campaniaIdNum]: items }));

            if (!items.length) {
                // sin contactos -> mostrar template "crudo"
                setHtml(template?.html ?? '<p>Sin contactos.</p>');
                setAsunto(template?.asunto ?? '');
                setFeedback({
                    open: true,
                    type: 'warning',
                    message: 'La campaña seleccionada no tiene contactos.'
                });
                return;
            }

            // ✅ usar un contacto real
            const contacto = items[Math.floor(Math.random() * items.length)]; // o aleatorio
            await generarPreviewConDatos(contacto?.datos);
        } catch (error) {
            console.error('Error trayendo contactos de la campaña', error);
            setFeedback({
                open: true,
                type: 'error',
                message: 'No se pudieron obtener los contactos de la campaña.'
            });
            // fallback: template crudo
            setHtml(template?.html ?? '');
            setAsunto(template?.asunto ?? '');
        } finally {
            setCargandoContactos(false);
        }
    };


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
                message: 'Correo enviado exitosamente'
            });
        } catch (error) {
            console.error('Error al enviar correo', error);
            setFeedback({
                open: true,
                type: 'error',
                message: 'Error al enviar el correo'
            });
        } finally {
            setEnviando(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
                <Typography
                    variant={isMobile ? 'h6' : 'h5'}
                    gutterBottom
                    sx={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                    Vista previa del template: {template?.nombre ?? '—'}
                </Typography>

                <Paper
                    variant="outlined"
                    sx={{
                        mt: 2,
                        p: { xs: 2, md: 3 },
                        borderRadius: 3
                    }}
                >
                    <Grid container spacing={2} justifyContent="center">
                        {/* Panel de envío */}
                        <Grid item xs={12} sm={10} md={7} lg={6}>
                            <Box mt={1} display="flex" flexDirection="column" gap={2}>
                                <TextField
                                    label="Cuenta SMTP"
                                    select
                                    fullWidth
                                    size={isMobile ? 'small' : 'medium'}
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
                                    label="Campaña (usar datos reales)"
                                    select
                                    fullWidth
                                    size={isMobile ? 'small' : 'medium'}
                                    value={campaniaId}
                                    onChange={(e) => onSelectCampania(Number(e.target.value))}
                                    helperText={cargandoContactos ? 'Cargando contactos de la campaña...' : 'Se usan los datos de un contacto de la campaña.'}
                                >
                                    {campanias.map((c) => (
                                        <MenuItem key={c.id} value={Number(c.id)}>
                                            {c.nombre} • {new Date(c.createdAt).toLocaleString()}
                                        </MenuItem>
                                    ))}
                                </TextField>

                                <TextField
                                    label="Email de destino"
                                    fullWidth
                                    size={isMobile ? 'small' : 'medium'}
                                    value={destino}
                                    onChange={(e) => setDestino(e.target.value)}
                                    placeholder="usuario@dominio.com"
                                />

                                <Button
                                    fullWidth={isMobile}
                                    variant="contained"
                                    color="primary"
                                    onClick={handleEnviar}
                                    disabled={enviando || !smtpId || !destino}
                                    startIcon={enviando ? <CircularProgress size={18} color="inherit" /> : null}
                                    sx={{
                                        borderRadius: 2,
                                        textTransform: 'none'
                                    }}
                                >
                                    {enviando ? 'Enviando...' : 'Enviar Email'}
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>

                    {/* Asunto renderizado */}
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, mt: 4 }}>
                        <strong>Asunto:</strong> {asunto || template?.asunto || 'Sin asunto'}
                    </Typography>

                    {/* Contenido del email (responsive/seguro) */}
                    <Box
                        sx={{
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                            borderRadius: 2,
                            p: { xs: 1.5, md: 2 },
                            bgcolor: 'background.paper',
                            overflowX: 'auto',

                            display: 'flex',              // 👈 usar flexbox
                            justifyContent: 'center',     // 👈 centra horizontal
                        }}
                    >
                        <Box
                            sx={{
                                width: '100%',
                                maxWidth: 700,               // 👈 ancho máximo centrado
                                '& img': { maxWidth: '100%', height: 'auto' },
                                '& table': {
                                    width: '100%',
                                    display: 'block',
                                    overflowX: 'auto',
                                    borderCollapse: 'collapse',
                                },
                                '& td, & th': { wordBreak: 'break-word' },
                                '& a': { wordBreak: 'break-all' },
                            }}
                        >
                            {cargandoContactos ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                    <CircularProgress size={28} />
                                </Box>
                            ) : (
                                <div dangerouslySetInnerHTML={{ __html: html }} />
                            )}
                        </Box>
                    </Box>
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