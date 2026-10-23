import { useCallback, useEffect, useState } from 'react';
import {
    Alert, Box, Button, CircularProgress, Chip, IconButton, InputAdornment, Paper, Skeleton, TextField, Tooltip, Typography,
} from '@mui/material';
import { Check, Copy, Eye, EyeOff, Pencil, Plus, Power, PowerOff, Smartphone, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import {
    BloqueEstado, ConfirmDialog, EmptyState, PageContainer, PageHeader, ResponsiveDialog, SectionCard, StatusChip,
} from '../ui';
import MenuMas from '../admin/MenuMas';

const CAMPO_VACIO = {
    nombre: '',
    phoneNumberId: '',
    wabaId: '',
    token: '',
    verifyToken: '',
    appSecret: '',
    msgBienvenida: '',
    msgConfirmacionBaja: '',
    dailyLimit: 200,
};

// La URL del webhook sale del mismo origen que usa la app para hablar con el backend.
const API_URL = (import.meta.env.VITE_API_URL || `${window.location.origin}/api`).replace(/\/+$/, '');
const WEBHOOK_URL = `${API_URL.replace(/\/api$/, '')}/api/wapi/webhook`;

function validar(form, editando) {
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'Poné un nombre para reconocer la línea.';
    if (!editando) {
        if (!form.phoneNumberId.trim()) e.phoneNumberId = 'Falta el Phone Number ID.';
        if (!form.wabaId.trim()) e.wabaId = 'Falta el WABA ID.';
        if (!form.token.trim()) e.token = 'Falta el token de acceso.';
        if (!form.verifyToken.trim()) e.verifyToken = 'Falta el Verify Token.';
    }
    const limite = Number(form.dailyLimit);
    if (!Number.isInteger(limite) || limite < 1) e.dailyLimit = 'Tiene que ser un número entero de 1 en adelante.';
    return e;
}

/** Un campo de contraseña con el ojo para ver lo que se tipeó. */
function CampoSecreto({ visible, onToggle, ...props }) {
    return (
        <TextField
            {...props}
            fullWidth
            type={visible ? 'text' : 'password'}
            autoComplete="off"
            slotProps={{
                input: {
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton
                                onClick={onToggle}
                                edge="end"
                                aria-label={visible ? 'Ocultar' : 'Mostrar'}
                                sx={{ width: 44, height: 44 }}
                            >
                                {visible ? <EyeOff size={18} strokeWidth={1.75} aria-hidden /> : <Eye size={18} strokeWidth={1.75} aria-hidden />}
                            </IconButton>
                        </InputAdornment>
                    ),
                },
            }}
        />
    );
}

export default function WapiConfig() {
    const feedback = useFeedback();
    const [configs, setConfigs] = useState([]);
    const [estado, setEstado] = useState('cargando'); // cargando | listo | error
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editando, setEditando] = useState(null); // null = crear, objeto = editar
    const [form, setForm] = useState(CAMPO_VACIO);
    const [inicial, setInicial] = useState(CAMPO_VACIO);
    const [errores, setErrores] = useState({});
    const [errorGuardar, setErrorGuardar] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [showAppSecret, setShowAppSecret] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const [porEliminar, setPorEliminar] = useState(null);
    const [porDesactivar, setPorDesactivar] = useState(null);
    const [trabajando, setTrabajando] = useState(false);

    const fetchConfigs = useCallback(async () => {
        setEstado((e) => (e === 'listo' ? e : 'cargando'));
        try {
            const res = await api.get('/wapi/config');
            setConfigs(Array.isArray(res.data) ? res.data : []);
            setEstado('listo');
        } catch {
            setEstado('error');
        }
    }, []);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    const abrir = (config) => {
        const base = config
            ? {
                nombre: config.nombre ?? '',
                phoneNumberId: config.phoneNumberId ?? '',
                wabaId: config.wabaId ?? '',
                token: '',
                verifyToken: config.verifyToken ?? '',
                appSecret: '',
                msgBienvenida: config.msgBienvenida ?? '',
                msgConfirmacionBaja: config.msgConfirmacionBaja ?? '',
                dailyLimit: config.dailyLimit ?? 200,
            }
            : CAMPO_VACIO;
        setEditando(config);
        setForm(base);
        setInicial(base);
        setErrores({});
        setErrorGuardar('');
        setShowToken(false);
        setShowAppSecret(false);
        setDialogOpen(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        setErrores((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
    };

    const sucio = JSON.stringify(form) !== JSON.stringify(inicial);

    const handleGuardar = async () => {
        const e = validar(form, editando);
        setErrores(e);
        if (Object.keys(e).length > 0) return;

        setSaving(true);
        setErrorGuardar('');
        try {
            const payload = { ...form };
            if (!payload.token) delete payload.token;
            if (!payload.appSecret) delete payload.appSecret;

            if (editando) {
                await api.put(`/wapi/config/${editando.id}`, payload);
                feedback.exito('Línea actualizada.');
            } else {
                await api.post('/wapi/config', payload);
                feedback.exito('Línea creada.');
            }
            setDialogOpen(false);
            await fetchConfigs();
        } catch (err) {
            // Adentro del diálogo, que es donde está mirando la persona.
            setErrorGuardar(mensajeDeError(err, 'No se pudo guardar la línea.'));
        } finally {
            setSaving(false);
        }
    };

    const eliminar = async () => {
        setTrabajando(true);
        try {
            await api.delete(`/wapi/config/${porEliminar.id}`);
            feedback.exito('Línea eliminada.');
            setPorEliminar(null);
            await fetchConfigs();
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo eliminar la línea.'));
            setPorEliminar(null);
        } finally {
            setTrabajando(false);
        }
    };

    const alternar = async (config) => {
        setTrabajando(true);
        try {
            await api.post(`/wapi/config/${config.id}/toggle`);
            feedback.exito(config.activo ? 'Línea desactivada.' : 'Línea activada.');
            setPorDesactivar(null);
            await fetchConfigs();
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo cambiar el estado de la línea.'));
            setPorDesactivar(null);
        } finally {
            setTrabajando(false);
        }
    };

    const pedirToggle = (config) => (config.activo ? setPorDesactivar(config) : alternar(config));

    const copiarWebhookUrl = async () => {
        try {
            await navigator.clipboard.writeText(WEBHOOK_URL);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            feedback.aviso('No se pudo copiar. Seleccioná la URL y copiala a mano.');
        }
    };

    return (
        <PageContainer angosto>
            <PageHeader
                title="Líneas de WhatsApp"
                subtitle="Las cuentas de WhatsApp Business API (Meta) conectadas."
                breadcrumbs={migasDe('/wapi/config')}
                actions={
                    <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={() => abrir(null)}>
                        Nueva línea
                    </Button>
                }
            />

            {estado === 'cargando' && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2, mb: 3 }}>
                    {[0, 1].map((i) => (
                        <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: '14px' }}>
                            <Skeleton width="50%" height={28} />
                            <Skeleton width="70%" />
                            <Skeleton width="40%" />
                        </Paper>
                    ))}
                </Box>
            )}
            {estado === 'error' && <BloqueEstado estado="error" mensaje="No se pudieron cargar las líneas." onReintentar={fetchConfigs} />}
            {estado === 'listo' && configs.length === 0 && (
                <SectionCard sx={{ mb: 3 }}>
                    <EmptyState
                        compact
                        icon={Smartphone}
                        title="Todavía no hay líneas"
                        description="Creá una línea para poder enviar campañas y atender conversaciones por WhatsApp API."
                        action={{ label: 'Nueva línea', onClick: () => abrir(null) }}
                    />
                </SectionCard>
            )}
            {estado === 'listo' && configs.length > 0 && (
                <Box
                    component="ul"
                    sx={{ listStyle: 'none', m: 0, mb: 3, p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}
                >
                    {configs.map((config) => (
                        <Paper
                            component="li"
                            key={config.id}
                            variant="outlined"
                            sx={{ borderRadius: '14px', p: 2, display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                                <Typography component="h2" sx={{ fontWeight: 650, fontSize: 16, overflowWrap: 'anywhere' }}>
                                    {config.nombre ?? 'Sin nombre'}
                                </Typography>
                                <StatusChip label={config.activo ? 'Activa' : 'Inactiva'} tono={config.activo ? 'ok' : 'neutro'} vivo={!!config.activo} />
                            </Box>
                            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.75, fontSize: 13.5 }}>
                                <Box>
                                    <Box component="dt" sx={{ fontSize: 12, color: 'text.secondary' }}>Phone Number ID</Box>
                                    <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>{config.phoneNumberId}</Box>
                                </Box>
                                <Box>
                                    <Box component="dt" sx={{ fontSize: 12, color: 'text.secondary' }}>WABA ID</Box>
                                    <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>{config.wabaId}</Box>
                                </Box>
                                <Box>
                                    <Box component="dt" sx={{ fontSize: 12, color: 'text.secondary' }}>Límite diario</Box>
                                    <Box component="dd" sx={{ m: 0 }}>{Number(config.dailyLimit ?? 0).toLocaleString('es-AR')} mensajes</Box>
                                </Box>
                                <Box>
                                    <Box component="dt" sx={{ fontSize: 12, color: 'text.secondary' }}>Token</Box>
                                    <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>{config.token}</Box>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, mt: 'auto', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<Pencil size={16} strokeWidth={1.75} aria-hidden />}
                                    onClick={() => abrir(config)}
                                    sx={{ minHeight: { xs: 44, md: 36 } }}
                                >
                                    Editar
                                </Button>
                                <MenuMas
                                    items={[
                                        {
                                            label: config.activo ? 'Desactivar' : 'Activar',
                                            icon: config.activo ? PowerOff : Power,
                                            onClick: () => pedirToggle(config),
                                            deshabilitado: trabajando,
                                        },
                                        { label: 'Eliminar', icon: Trash2, peligro: true, onClick: () => setPorEliminar(config) },
                                    ]}
                                />
                            </Box>
                        </Paper>
                    ))}
                </Box>
            )}

            <SectionCard
                title="URL del webhook para Meta"
                subtitle="Registrala en Meta for Developers → Tu app → WhatsApp → Configuración → Webhook."
            >
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Suscribite a los eventos:</Typography>
                    {['messages', 'message_deliveries', 'message_reads'].map((ev) => (
                        <Chip key={ev} label={ev} size="small" variant="outlined" />
                    ))}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', borderRadius: 1.5, pl: 2, pr: 0.5, py: 0.5 }}>
                    <Box sx={{ flexGrow: 1, minWidth: 0, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>{WEBHOOK_URL}</Box>
                    <Tooltip title={copiado ? 'Copiada' : 'Copiar URL'}>
                        <IconButton onClick={copiarWebhookUrl} aria-label="Copiar la URL del webhook" sx={{ width: 44, height: 44 }}>
                            {copiado ? <Check size={18} strokeWidth={1.75} aria-hidden /> : <Copy size={18} strokeWidth={1.75} aria-hidden />}
                        </IconButton>
                    </Tooltip>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, fontSize: 12.5 }}>
                    El Verify Token es el valor que configuraste en cada línea. Meta lo usa para confirmar que el endpoint es tuyo.
                </Typography>
            </SectionCard>

            <ResponsiveDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                sucio={sucio && !saving}
                title={editando ? 'Editar línea' : 'Nueva línea de WhatsApp API'}
                actions={
                    <>
                        <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button
                            variant="contained"
                            onClick={handleGuardar}
                            disabled={saving}
                            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
                        >
                            {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear línea'}
                        </Button>
                    </>
                }
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 0.5 }}>
                    {errorGuardar && <Alert severity="error" role="alert">{errorGuardar}</Alert>}
                    {editando && <Alert severity="info">Dejá vacíos Token y App Secret para no modificarlos.</Alert>}

                    <TextField
                        label="Nombre de la línea"
                        name="nombre"
                        value={form.nombre}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={!!errores.nombre}
                        helperText={errores.nombre ?? 'Ej: Línea Principal, Soporte, Marketing'}
                    />
                    <TextField
                        label="Phone Number ID"
                        name="phoneNumberId"
                        value={form.phoneNumberId}
                        onChange={handleChange}
                        fullWidth
                        required={!editando}
                        error={!!errores.phoneNumberId}
                        helperText={errores.phoneNumberId ?? 'Meta for Developers → Tu app → WhatsApp → Configuración de API'}
                    />
                    <TextField
                        label="WABA ID (WhatsApp Business Account ID)"
                        name="wabaId"
                        value={form.wabaId}
                        onChange={handleChange}
                        fullWidth
                        required={!editando}
                        error={!!errores.wabaId}
                        helperText={errores.wabaId}
                    />
                    <CampoSecreto
                        label={editando ? 'Token de acceso (dejá vacío para no cambiar)' : 'Token de acceso permanente'}
                        name="token"
                        value={form.token}
                        onChange={handleChange}
                        required={!editando}
                        visible={showToken}
                        onToggle={() => setShowToken((p) => !p)}
                        error={!!errores.token}
                        helperText={errores.token ?? 'Token de acceso permanente generado en Meta for Developers'}
                    />
                    <TextField
                        label="Verify Token (para el webhook)"
                        name="verifyToken"
                        value={form.verifyToken}
                        onChange={handleChange}
                        fullWidth
                        required={!editando}
                        error={!!errores.verifyToken}
                        helperText={errores.verifyToken ?? 'Texto que vos elegís. Tiene que coincidir con el registrado en Meta.'}
                    />
                    <CampoSecreto
                        label={editando ? 'App Secret (dejá vacío para no cambiar)' : 'App Secret (opcional pero recomendado)'}
                        name="appSecret"
                        value={form.appSecret}
                        onChange={handleChange}
                        visible={showAppSecret}
                        onToggle={() => setShowAppSecret((p) => !p)}
                        helperText="Se usa para verificar la firma HMAC-SHA256 de los webhooks entrantes."
                    />

                    <Typography component="h3" sx={{ fontSize: 15, fontWeight: 650, mt: 1 }}>Mensajes automáticos</Typography>
                    <TextField
                        label="Mensaje de bienvenida (al iniciar conversación)"
                        name="msgBienvenida"
                        value={form.msgBienvenida}
                        onChange={handleChange}
                        fullWidth
                        multiline
                        minRows={3}
                        placeholder="¡Hola! Gracias por comunicarte con nosotros…"
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
                        placeholder="Procesamos tu solicitud de baja…"
                        helperText="Se envía cuando un contacto toca el botón de baja en una plantilla."
                    />

                    <Typography component="h3" sx={{ fontSize: 15, fontWeight: 650, mt: 1 }}>Límites de envío</Typography>
                    <TextField
                        label="Límite diario de mensajes"
                        name="dailyLimit"
                        type="number"
                        value={form.dailyLimit}
                        onChange={handleChange}
                        fullWidth
                        error={!!errores.dailyLimit}
                        slotProps={{ htmlInput: { min: 1, step: 50, inputMode: 'numeric' } }}
                        helperText={errores.dailyLimit ?? 'Máximo de mensajes por día para esta línea. La campaña se pausa sola al alcanzarlo. Nivel 250: usar 200. Nivel 1000: usar 900.'}
                    />
                </Box>
            </ResponsiveDialog>

            <ConfirmDialog
                open={!!porDesactivar}
                titulo={`¿Desactivar "${porDesactivar?.nombre ?? ''}"?`}
                mensaje="Las campañas de esta línea se van a frenar y no va a recibir ni enviar mensajes hasta que la vuelvas a activar."
                confirmarTexto="Desactivar"
                peligro
                cargando={trabajando}
                onConfirmar={() => alternar(porDesactivar)}
                onCancelar={() => setPorDesactivar(null)}
            />
            <ConfirmDialog
                open={!!porEliminar}
                titulo={`¿Eliminar "${porEliminar?.nombre ?? ''}"?`}
                mensaje="Se borra la configuración de la línea, con su token. Esta acción no se puede deshacer."
                confirmarTexto="Eliminar"
                peligro
                cargando={trabajando}
                onConfirmar={eliminar}
                onCancelar={() => setPorEliminar(null)}
            />
        </PageContainer>
    );
}
