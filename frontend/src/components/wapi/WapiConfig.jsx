import React, { useEffect, useState } from 'react';
import {
    Box, Button, Card, CardContent, CardActions, Grid, Typography,
    TextField, CircularProgress, Snackbar, InputAdornment, IconButton,
    Divider, Alert, Chip, Dialog, DialogTitle, DialogContent,
    DialogActions, useTheme,
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import api from '../../api/axios';

const CAMPO_VACIO = {
    nombre: '',
    phoneNumberId: '',
    wabaId: '',
    token: '',
    verifyToken: '',
    appSecret: '',
    msgBienvenida: '',
    msgConfirmacionBaja: '',
};

export default function WapiConfig() {
    const theme = useTheme();
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editando, setEditando] = useState(null); // null = crear, objeto = editar
    const [form, setForm] = useState(CAMPO_VACIO);
    const [showToken, setShowToken] = useState(false);
    const [showAppSecret, setShowAppSecret] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const [feedback, setFeedback] = useState({ open: false, message: '', type: 'success' });

    const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
    const webhookUrl = `${apiBase}/api/wapi/webhook`;

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const res = await api.get('/wapi/config');
            setConfigs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error al cargar configuraciones WA API', err);
            setConfigs([]);
        } finally {
            setLoading(false);
        }
    };

    const abrirCrear = () => {
        setEditando(null);
        setForm(CAMPO_VACIO);
        setShowToken(false);
        setShowAppSecret(false);
        setDialogOpen(true);
    };

    const abrirEditar = (config) => {
        setEditando(config);
        setForm({
            nombre: config.nombre ?? '',
            phoneNumberId: config.phoneNumberId ?? '',
            wabaId: config.wabaId ?? '',
            token: '',
            verifyToken: config.verifyToken ?? '',
            appSecret: '',
            msgBienvenida: config.msgBienvenida ?? '',
            msgConfirmacionBaja: config.msgConfirmacionBaja ?? '',
        });
        setShowToken(false);
        setShowAppSecret(false);
        setDialogOpen(true);
    };

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleGuardar = async () => {
        if (!form.nombre.trim()) {
            setFeedback({ open: true, message: 'El nombre de la línea es obligatorio.', type: 'error' });
            return;
        }
        if (!editando && (!form.phoneNumberId || !form.wabaId || !form.token || !form.verifyToken)) {
            setFeedback({ open: true, message: 'Phone Number ID, WABA ID, Token y Verify Token son obligatorios al crear.', type: 'error' });
            return;
        }

        setSaving(true);
        try {
            const payload = { ...form };
            if (!payload.token) delete payload.token;
            if (!payload.appSecret) delete payload.appSecret;

            if (editando) {
                await api.put(`/wapi/config/${editando.id}`, payload);
                setFeedback({ open: true, message: 'Configuración actualizada correctamente.', type: 'success' });
            } else {
                await api.post('/wapi/config', payload);
                setFeedback({ open: true, message: 'Nueva línea creada correctamente.', type: 'success' });
            }
            setDialogOpen(false);
            await fetchConfigs();
        } catch {
            setFeedback({ open: true, message: 'Error al guardar la configuración.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleEliminar = async (id) => {
        if (!window.confirm('¿Estás seguro de que querés eliminar esta línea? Esta acción no se puede deshacer.')) return;
        try {
            await api.delete(`/wapi/config/${id}`);
            setFeedback({ open: true, message: 'Línea eliminada.', type: 'success' });
            await fetchConfigs();
        } catch {
            setFeedback({ open: true, message: 'Error al eliminar la línea.', type: 'error' });
        }
    };

    const handleToggle = async (id) => {
        try {
            await api.post(`/wapi/config/${id}/toggle`);
            await fetchConfigs();
        } catch {
            setFeedback({ open: true, message: 'Error al cambiar el estado.', type: 'error' });
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
        <Box maxWidth={900} mx="auto" py={4}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
                <Box>
                    <Typography variant="h5" fontWeight="bold" mb={0.5}>
                        WhatsApp API — Líneas configuradas
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Administrá las cuentas de WhatsApp Business API (Meta) conectadas.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={abrirCrear}
                >
                    Nueva línea
                </Button>
            </Box>

            {configs.length === 0 && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    No hay líneas configuradas. Creá una nueva para empezar a usar WhatsApp API.
                </Alert>
            )}

            <Grid container spacing={2} sx={{ mb: 3 }}>
                {configs.map((config) => (
                    <Grid item xs={12} sm={6} key={config.id}>
                        <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                    <Typography fontWeight="bold" fontSize={15}>
                                        {config.nombre ?? 'Sin nombre'}
                                    </Typography>
                                    <Chip
                                        label={config.activo ? 'Activa' : 'Inactiva'}
                                        color={config.activo ? 'success' : 'default'}
                                        size="small"
                                    />
                                </Box>
                                <Typography variant="body2" color="text.secondary" fontSize={12}>
                                    <strong>Phone Number ID:</strong> {config.phoneNumberId}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" fontSize={12}>
                                    <strong>WABA ID:</strong> {config.wabaId}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" fontSize={12}>
                                    <strong>Token:</strong> {config.token}
                                </Typography>
                            </CardContent>
                            <CardActions sx={{ justifyContent: 'flex-end', borderTop: '1px solid', borderColor: 'divider', px: 1 }}>
                                <IconButton
                                    size="small"
                                    title={config.activo ? 'Desactivar' : 'Activar'}
                                    onClick={() => handleToggle(config.id)}
                                    color={config.activo ? 'success' : 'default'}
                                >
                                    <PowerSettingsNewIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    title="Editar"
                                    onClick={() => abrirEditar(config)}
                                    color="primary"
                                >
                                    <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    title="Eliminar"
                                    onClick={() => handleEliminar(config.id)}
                                    color="error"
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </CardActions>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Card URL del webhook */}
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" mb={1}>
                        URL del Webhook para Meta
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        Registrá esta URL en Meta for Developers → Tu app → WhatsApp → Configuración → Webhook.
                        Suscribite a los eventos:{' '}
                        <Chip label="messages" size="small" sx={{ mx: 0.5 }} />
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
                        El Verify Token es el valor que configuraste en cada línea. Meta lo usa para confirmar que el endpoint es tuyo.
                    </Typography>
                </CardContent>
            </Card>

            {/* Dialog crear / editar */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editando ? 'Editar línea' : 'Nueva línea de WhatsApp API'}</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2.5} mt={1}>
                        {editando && (
                            <Alert severity="info" icon={<CheckCircleOutlineIcon />}>
                                Dejá vacíos Token y App Secret para no modificarlos.
                            </Alert>
                        )}

                        <TextField
                            label="Nombre de la línea"
                            name="nombre"
                            value={form.nombre}
                            onChange={handleChange}
                            fullWidth
                            required
                            helperText="Ej: Línea Principal, Soporte, Marketing"
                        />

                        <TextField
                            label="Phone Number ID"
                            name="phoneNumberId"
                            value={form.phoneNumberId}
                            onChange={handleChange}
                            fullWidth
                            required={!editando}
                            helperText="Meta for Developers → Tu app → WhatsApp → Configuración de API"
                        />

                        <TextField
                            label="WABA ID (WhatsApp Business Account ID)"
                            name="wabaId"
                            value={form.wabaId}
                            onChange={handleChange}
                            fullWidth
                            required={!editando}
                        />

                        <TextField
                            label={editando ? 'Token de acceso (dejá vacío para no cambiar)' : 'Token de acceso permanente'}
                            name="token"
                            value={form.token}
                            onChange={handleChange}
                            fullWidth
                            required={!editando}
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
                            required={!editando}
                            helperText="String que vos elegís. Debe coincidir con el registrado en Meta."
                        />

                        <TextField
                            label={editando ? 'App Secret (dejá vacío para no cambiar)' : 'App Secret (opcional pero recomendado)'}
                            name="appSecret"
                            value={form.appSecret}
                            onChange={handleChange}
                            fullWidth
                            type={showAppSecret ? 'text' : 'password'}
                            helperText="Se usa para verificar la firma HMAC-SHA256 de los webhooks entrantes."
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

                        <Divider />

                        <Typography variant="subtitle2" fontWeight="bold">
                            Mensajes automáticos
                        </Typography>

                        <TextField
                            label="Mensaje de bienvenida (al iniciar conversación)"
                            name="msgBienvenida"
                            value={form.msgBienvenida}
                            onChange={handleChange}
                            fullWidth
                            multiline
                            minRows={3}
                            placeholder="¡Hola! 👋 Gracias por comunicarte con nosotros..."
                            helperText="Se envía cuando un contacto inicia una conversación nueva o reabre una resuelta."
                        />

                        <TextField
                            label="Mensaje de confirmación de baja"
                            name="msgConfirmacionBaja"
                            value={form.msgConfirmacionBaja}
                            onChange={handleChange}
                            fullWidth
                            multiline
                            minRows={3}
                            placeholder="Hemos procesado tu solicitud de baja..."
                            helperText="Se envía cuando un contacto presiona el botón de baja en un template."
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={handleGuardar}
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear línea'}
                    </Button>
                </DialogActions>
            </Dialog>

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
