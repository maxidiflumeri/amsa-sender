import React, { useEffect, useState } from 'react';
import {
    Box, Button, Card, CardContent, Typography, TextField,
    CircularProgress, Snackbar, InputAdornment, IconButton,
    Divider, Alert, Chip, useTheme,
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import SaveIcon from '@mui/icons-material/Save';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import api from '../../api/axios';

const CAMPO_VACIO = { phoneNumberId: '', wabaId: '', token: '', verifyToken: '', appSecret: '' };

export default function WapiConfig() {
    const theme = useTheme();
    const [form, setForm] = useState(CAMPO_VACIO);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [configExiste, setConfigExiste] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [showAppSecret, setShowAppSecret] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const [feedback, setFeedback] = useState({ open: false, message: '', type: 'success' });

    const webhookUrl = `${window.location.origin.replace(':5173', ':3001')}/api/wapi/webhook`;

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await api.get('/wapi/config');
            if (res.data) {
                setConfigExiste(true);
                setForm({
                    phoneNumberId: res.data.phoneNumberId ?? '',
                    wabaId: res.data.wabaId ?? '',
                    token: '',           // no se muestra el token real, se re-ingresa si se quiere cambiar
                    verifyToken: res.data.verifyToken ?? '',
                    appSecret: '',       // ídem
                });
            }
        } catch (err) {
            if (err.response?.status !== 404) {
                console.error('Error al cargar config WA API', err);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleGuardar = async () => {
        if (!form.phoneNumberId || !form.wabaId || !form.verifyToken) {
            setFeedback({ open: true, message: 'Phone Number ID, WABA ID y Verify Token son obligatorios.', type: 'error' });
            return;
        }
        if (!configExiste && !form.token) {
            setFeedback({ open: true, message: 'El token de acceso es obligatorio para la configuración inicial.', type: 'error' });
            return;
        }

        setSaving(true);
        try {
            const payload = { ...form };
            // Si el token está vacío (no se quiso cambiar), no lo mandamos
            if (!payload.token) delete payload.token;
            if (!payload.appSecret) delete payload.appSecret;

            await api.post('/wapi/config', payload);
            setConfigExiste(true);
            setFeedback({ open: true, message: 'Configuración guardada correctamente.', type: 'success' });
            setForm((prev) => ({ ...prev, token: '', appSecret: '' }));
        } catch (err) {
            setFeedback({ open: true, message: 'Error al guardar la configuración.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const copiarWebhookUrl = () => {
        navigator.clipboard.writeText(webhookUrl);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="40vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box maxWidth={680} mx="auto" py={4}>
            <Typography variant="h5" fontWeight="bold" mb={1}>
                WhatsApp API — Configuración
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
                Credenciales de la cuenta verificada de Meta Business para el ANI oficial.
            </Typography>

            {/* Card principal */}
            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {configExiste && (
                        <Alert severity="info" icon={<CheckCircleOutlineIcon />} sx={{ mb: 1 }}>
                            Ya hay una configuración guardada. Completá solo los campos que querés actualizar.
                        </Alert>
                    )}

                    <TextField
                        label="Phone Number ID"
                        name="phoneNumberId"
                        value={form.phoneNumberId}
                        onChange={handleChange}
                        fullWidth
                        required
                        helperText="Lo encontrás en Meta for Developers → Tu app → WhatsApp → Configuración de API"
                    />

                    <TextField
                        label="WABA ID (WhatsApp Business Account ID)"
                        name="wabaId"
                        value={form.wabaId}
                        onChange={handleChange}
                        fullWidth
                        required
                        helperText="Meta for Developers → Tu app → WhatsApp → Configuración de API → WhatsApp Business Account ID"
                    />

                    <TextField
                        label={configExiste ? 'Token de acceso (dejá vacío para no cambiar)' : 'Token de acceso permanente'}
                        name="token"
                        value={form.token}
                        onChange={handleChange}
                        fullWidth
                        required={!configExiste}
                        type={showToken ? 'text' : 'password'}
                        helperText="Token de acceso permanente generado en Meta for Developers"
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setShowToken((p) => !p)} edge="end">
                                        {showToken ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />

                    <TextField
                        label="Verify Token (para el webhook)"
                        name="verifyToken"
                        value={form.verifyToken}
                        onChange={handleChange}
                        fullWidth
                        required
                        helperText="Cualquier string que vos elijas. Tenés que poner el mismo valor al registrar el webhook en Meta."
                    />

                    <TextField
                        label={configExiste ? 'App Secret (dejá vacío para no cambiar)' : 'App Secret (opcional pero recomendado)'}
                        name="appSecret"
                        value={form.appSecret}
                        onChange={handleChange}
                        fullWidth
                        type={showAppSecret ? 'text' : 'password'}
                        helperText="Se usa para verificar la firma HMAC-SHA256 de los webhooks entrantes. Meta for Developers → Tu app → Configuración → App Secret"
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setShowAppSecret((p) => !p)} edge="end">
                                        {showAppSecret ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />

                    <Button
                        variant="contained"
                        startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                        onClick={handleGuardar}
                        disabled={saving}
                        sx={{ alignSelf: 'flex-start', mt: 1 }}
                    >
                        {saving ? 'Guardando...' : 'Guardar configuración'}
                    </Button>
                </CardContent>
            </Card>

            {/* Card URL del webhook */}
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" mb={1}>
                        URL del Webhook para Meta
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        Registrá esta URL en Meta for Developers → Tu app → WhatsApp → Configuración → Webhook.
                        Suscribite a los eventos: <Chip label="messages" size="small" sx={{ mx: 0.5 }} />
                        <Chip label="message_deliveries" size="small" sx={{ mx: 0.5 }} />
                        <Chip label="message_reads" size="small" sx={{ mx: 0.5 }} />
                    </Typography>

                    <Divider sx={{ mb: 2 }} />

                    <Box
                        display="flex"
                        alignItems="center"
                        gap={1}
                        sx={{
                            backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f5f5f5',
                            borderRadius: 1,
                            px: 2,
                            py: 1.5,
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            wordBreak: 'break-all',
                        }}
                    >
                        <Box flexGrow={1}>{webhookUrl}</Box>
                        <IconButton size="small" onClick={copiarWebhookUrl}>
                            {copiado ? (
                                <CheckCircleOutlineIcon fontSize="small" color="success" />
                            ) : (
                                <ContentCopyIcon fontSize="small" />
                            )}
                        </IconButton>
                    </Box>

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                        El Verify Token es el valor que configuraste en el campo de arriba. Meta lo usa para confirmar que el endpoint es tuyo.
                    </Typography>
                </CardContent>
            </Card>

            <Snackbar
                open={feedback.open}
                autoHideDuration={4000}
                onClose={() => setFeedback((p) => ({ ...p, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <MuiAlert
                    onClose={() => setFeedback((p) => ({ ...p, open: false }))}
                    severity={feedback.type}
                    variant="filled"
                    elevation={6}
                >
                    {feedback.message}
                </MuiAlert>
            </Snackbar>
        </Box>
    );
}
