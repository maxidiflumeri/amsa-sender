import React, { useEffect, useState } from 'react';
import {
    Box, Button, Card, CardContent, Typography, Chip, CircularProgress,
    Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
    Select, MenuItem, FormControl, InputLabel, FormControlLabel,
    Switch, Alert, Tooltip, IconButton, Divider, useTheme,
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import SyncIcon from '@mui/icons-material/Sync';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/HourglassEmpty';
import api from '../../api/axios';

const ESTADO_CHIP = {
    APPROVED: { label: 'Aprobado', color: 'success', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
    PENDING:  { label: 'Pendiente', color: 'warning', icon: <PendingIcon sx={{ fontSize: 14 }} /> },
    REJECTED: { label: 'Rechazado', color: 'error', icon: <CancelIcon sx={{ fontSize: 14 }} /> },
    PAUSED:   { label: 'Pausado', color: 'default', icon: <PendingIcon sx={{ fontSize: 14 }} /> },
};

const ACCIONES = [
    { value: 'INBOX', label: 'Derivar al inbox (hablar con asesor)' },
    { value: 'BAJA',  label: 'Registrar como baja' },
    { value: 'IGNORAR', label: 'Ignorar (no hacer nada)' },
];

/** Extrae los botones Quick Reply de los componentes del template */
function extraerBotonesQR(componentes) {
    if (!Array.isArray(componentes)) return [];
    const buttonsComp = componentes.find(c => c.type === 'BUTTONS');
    if (!buttonsComp) return [];
    return (buttonsComp.buttons || []).filter(b => b.type === 'QUICK_REPLY');
}

/** Muestra una preview simplificada del template */
function TemplatePreview({ componentes }) {
    const theme = useTheme();
    if (!Array.isArray(componentes)) return null;

    const header = componentes.find(c => c.type === 'HEADER');
    const body   = componentes.find(c => c.type === 'BODY');
    const footer = componentes.find(c => c.type === 'FOOTER');
    const buttons = componentes.find(c => c.type === 'BUTTONS');

    return (
        <Box
            sx={{
                backgroundColor: theme.palette.mode === 'dark' ? '#1a2a1a' : '#DCF8C6',
                borderRadius: 2,
                p: 1.5,
                maxWidth: 320,
                fontFamily: '"Helvetica Neue", sans-serif',
                fontSize: 13,
            }}
        >
            {header && header.format === 'TEXT' && (
                <Typography fontWeight="bold" fontSize={13} mb={0.5}>
                    {header.text}
                </Typography>
            )}
            {header && header.format !== 'TEXT' && (
                <Box
                    sx={{
                        backgroundColor: theme.palette.mode === 'dark' ? '#2a3a2a' : '#b2dfdb',
                        borderRadius: 1, p: 1, mb: 0.5, textAlign: 'center', fontSize: 12,
                        color: 'text.secondary',
                    }}
                >
                    [{header.format}]
                </Box>
            )}
            {body && (
                <Typography fontSize={13} sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {body.text}
                </Typography>
            )}
            {footer && (
                <Typography fontSize={11} color="text.secondary" mt={0.5}>
                    {footer.text}
                </Typography>
            )}
            {buttons && (
                <Box mt={1} display="flex" flexDirection="column" gap={0.5}>
                    <Divider sx={{ mb: 0.5 }} />
                    {(buttons.buttons || []).map((btn, i) => (
                        <Box
                            key={i}
                            sx={{
                                textAlign: 'center',
                                color: theme.palette.mode === 'dark' ? '#64b5f6' : '#128C7E',
                                fontSize: 13,
                                fontWeight: 500,
                                py: 0.25,
                            }}
                        >
                            {btn.text}
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
}

/** Dialog para configurar las acciones de los botones QR de un template */
function DialogButtonActions({ open, template, onClose, onGuardado }) {
    const botonesQR = template ? extraerBotonesQR(template.componentes) : [];
    const initial = () => {
        const existing = template?.buttonActions ?? [];
        return botonesQR.map((btn, i) => {
            const guardado = existing.find(a => a.indice === i) || {};
            return {
                indice: i,
                texto: btn.text,
                payload: guardado.payload ?? `BTN_${i + 1}`,
                accion: guardado.accion ?? 'INBOX',
                enviarConfirmacion: guardado.enviarConfirmacion ?? false,
            };
        });
    };

    const [acciones, setAcciones] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open && template) setAcciones(initial());
    }, [open, template]);

    const update = (i, campo, valor) => {
        setAcciones(prev => prev.map((a, idx) => idx === i ? { ...a, [campo]: valor } : a));
    };

    const handleGuardar = async () => {
        setSaving(true);
        setError('');
        try {
            await api.patch(`/wapi/templates/${template.id}/button-actions`, { buttonActions: acciones });
            onGuardado();
            onClose();
        } catch {
            setError('Error al guardar. Intentá de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    if (!template) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                Configurar botones — <em>{template.metaNombre}</em>
            </DialogTitle>
            <DialogContent>
                <Box display="flex" flexDirection="column" gap={3} mt={1}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <Box>
                        <Typography variant="caption" color="text.secondary" mb={1} display="block">
                            Preview del template
                        </Typography>
                        <TemplatePreview componentes={template.componentes} />
                    </Box>

                    <Divider />

                    {botonesQR.length === 0 && (
                        <Alert severity="info">Este template no tiene botones Quick Reply configurados.</Alert>
                    )}

                    {acciones.map((accion, i) => (
                        <Box key={i} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
                            <Typography fontWeight="bold" fontSize={14} mb={1.5}>
                                Botón {i + 1}: "{accion.texto}"
                            </Typography>

                            <Box display="flex" flexDirection="column" gap={1.5}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Acción al recibir respuesta</InputLabel>
                                    <Select
                                        value={accion.accion}
                                        label="Acción al recibir respuesta"
                                        onChange={(e) => update(i, 'accion', e.target.value)}
                                    >
                                        {ACCIONES.map(a => (
                                            <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {accion.accion === 'BAJA' && (
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={accion.enviarConfirmacion}
                                                onChange={(e) => update(i, 'enviarConfirmacion', e.target.checked)}
                                                size="small"
                                            />
                                        }
                                        label={
                                            <Typography fontSize={13}>
                                                Enviar mensaje de confirmación de baja
                                            </Typography>
                                        }
                                    />
                                )}
                            </Box>
                        </Box>
                    ))}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button
                    variant="contained"
                    onClick={handleGuardar}
                    disabled={saving || botonesQR.length === 0}
                >
                    {saving ? <CircularProgress size={18} /> : 'Guardar'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default function WapiTemplates() {
    const theme = useTheme();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [templateSeleccionado, setTemplateSeleccionado] = useState(null);
    const [feedback, setFeedback] = useState({ open: false, message: '', type: 'success' });

    useEffect(() => { fetchTemplates(); }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await api.get('/wapi/templates');
            setTemplates(res.data);
        } catch {
            setFeedback({ open: true, message: 'Error al cargar templates.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSincronizar = async () => {
        setSyncing(true);
        try {
            const res = await api.post('/wapi/templates/sincronizar');
            const { sincronizados, errores } = res.data;
            const msg = errores.length > 0
                ? `${sincronizados} sincronizados, ${errores.length} con error.`
                : `${sincronizados} templates sincronizados correctamente.`;
            setFeedback({ open: true, message: msg, type: errores.length > 0 ? 'warning' : 'success' });
            await fetchTemplates();
        } catch (err) {
            const msg = err.response?.data?.message || 'Error al sincronizar con Meta.';
            setFeedback({ open: true, message: msg, type: 'error' });
        } finally {
            setSyncing(false);
        }
    };

    const abrirConfig = (tpl) => {
        setTemplateSeleccionado(tpl);
        setDialogOpen(true);
    };

    const onGuardado = async () => {
        setFeedback({ open: true, message: 'Configuración guardada.', type: 'success' });
        await fetchTemplates();
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="40vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box py={4}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
                <Box>
                    <Typography variant="h5" fontWeight="bold">Templates</Typography>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                        Templates aprobados en Meta. Sincronizá para traer los últimos cambios.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                    onClick={handleSincronizar}
                    disabled={syncing}
                >
                    {syncing ? 'Sincronizando...' : 'Sincronizar desde Meta'}
                </Button>
            </Box>

            {templates.length === 0 && !loading && (
                <Alert severity="info">
                    No hay templates cargados. Hacé click en "Sincronizar desde Meta" para traerlos.
                </Alert>
            )}

            {/* Grid de templates */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
                    gap: 2,
                }}
            >
                {templates.map((tpl) => {
                    const estado = ESTADO_CHIP[tpl.estado] ?? { label: tpl.estado, color: 'default' };
                    const botonesQR = extraerBotonesQR(tpl.componentes);
                    const tieneAcciones = Array.isArray(tpl.buttonActions) && tpl.buttonActions.length > 0;

                    return (
                        <Card key={tpl.id} variant="outlined" sx={{ display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                                {/* Nombre + estado */}
                                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                                    <Typography fontWeight="bold" fontSize={14} sx={{ wordBreak: 'break-word', mr: 1 }}>
                                        {tpl.metaNombre}
                                    </Typography>
                                    <Chip
                                        label={estado.label}
                                        color={estado.color}
                                        size="small"
                                        icon={estado.icon}
                                    />
                                </Box>

                                {/* Metadata */}
                                <Box display="flex" gap={0.75} flexWrap="wrap" mb={1.5}>
                                    <Chip label={tpl.categoria} size="small" variant="outlined" />
                                    <Chip label={tpl.idioma} size="small" variant="outlined" />
                                </Box>

                                {/* Preview */}
                                {tpl.estado === 'APPROVED' && (
                                    <TemplatePreview componentes={tpl.componentes} />
                                )}

                                {/* Estado de botones */}
                                {botonesQR.length > 0 && (
                                    <Box mt={1.5}>
                                        <Typography variant="caption" color="text.secondary">
                                            Botones QR: {botonesQR.length}
                                        </Typography>
                                        {tieneAcciones ? (
                                            <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
                                                {tpl.buttonActions.map((a, i) => (
                                                    <Chip
                                                        key={i}
                                                        label={`${a.texto ?? `Btn ${i + 1}`} → ${a.accion}`}
                                                        size="small"
                                                        color={a.accion === 'BAJA' ? 'error' : a.accion === 'INBOX' ? 'success' : 'default'}
                                                        variant="outlined"
                                                    />
                                                ))}
                                            </Box>
                                        ) : (
                                            <Typography variant="caption" color="warning.main" display="block" mt={0.25}>
                                                Sin acciones configuradas
                                            </Typography>
                                        )}
                                    </Box>
                                )}

                                {/* Sync date */}
                                <Typography variant="caption" color="text.disabled" display="block" mt={1.5}>
                                    Sincronizado: {new Date(tpl.sincronizadoAt).toLocaleString('es-AR')}
                                </Typography>
                            </CardContent>

                            {/* Footer con acción */}
                            <Box
                                sx={{
                                    borderTop: '1px solid', borderColor: 'divider',
                                    px: 2, py: 1,
                                    backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#fafafa',
                                    display: 'flex', justifyContent: 'flex-end',
                                }}
                            >
                                <Tooltip title={botonesQR.length === 0 ? 'Sin botones QR para configurar' : 'Configurar acciones de botones'}>
                                    <span>
                                        <Button
                                            size="small"
                                            startIcon={<SettingsIcon />}
                                            onClick={() => abrirConfig(tpl)}
                                            disabled={botonesQR.length === 0}
                                            color={tieneAcciones ? 'success' : 'primary'}
                                        >
                                            {tieneAcciones ? 'Reconfigurar' : 'Configurar botones'}
                                        </Button>
                                    </span>
                                </Tooltip>
                            </Box>
                        </Card>
                    );
                })}
            </Box>

            {/* Dialog configuración */}
            <DialogButtonActions
                open={dialogOpen}
                template={templateSeleccionado}
                onClose={() => setDialogOpen(false)}
                onGuardado={onGuardado}
            />

            <Snackbar
                open={feedback.open}
                autoHideDuration={5000}
                onClose={() => setFeedback(p => ({ ...p, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <MuiAlert
                    onClose={() => setFeedback(p => ({ ...p, open: false }))}
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
