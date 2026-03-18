import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Box, Typography, ToggleButton, ToggleButtonGroup, TextField, Button,
    FormControl, InputLabel, Select, MenuItem, Paper, CircularProgress,
    Snackbar, Alert, Autocomplete, Chip, Dialog, DialogTitle,
    DialogContent, DialogActions, Divider, Tooltip, IconButton,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import PreviewIcon from '@mui/icons-material/Preview';
import ArticleIcon from '@mui/icons-material/Article';
import EditNoteIcon from '@mui/icons-material/EditNote';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import EmailEditor from 'react-email-editor';
import api from '../../api/axios';
import { renderTemplate } from '../../utils/renderTemplate';

export default function EnvioManual() {
    const [modo, setModo] = useState('template');

    // Destinatario y SMTP (comunes)
    const [toList, setToList] = useState([]);
    const [toNombre, setToNombre] = useState('');
    const [smtpId, setSmtpId] = useState('');
    const [cuentas, setCuentas] = useState([]);

    // Adjuntos
    const [adjuntos, setAdjuntos] = useState([]);
    const adjuntosRef = useRef(null);

    // Modo A: template
    const [templates, setTemplates] = useState([]);
    const [templateSeleccionado, setTemplateSeleccionado] = useState(null);
    const [templateData, setTemplateData] = useState(null); // { html, asunto, design }
    const [variables, setVariables] = useState([]);
    const [variableValues, setVariableValues] = useState({});
    const [asuntoManual, setAsuntoManual] = useState('');

    // Modo B: composición libre
    const [subjectLibre, setSubjectLibre] = useState('');
    const [htmlLibre, setHtmlLibre] = useState('');
    const emailEditorRef = useRef(null);
    const [editorReady, setEditorReady] = useState(false);

    // UI
    const [enviando, setEnviando] = useState(false);
    const [resultado, setResultado] = useState(null); // { ok, reporteId, error }
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
    const [loadingTemplate, setLoadingTemplate] = useState(false);
    const [previewDialog, setPreviewDialog] = useState(false);
    const [guardarDialog, setGuardarDialog] = useState(false);
    const [nombreTemplateNuevo, setNombreTemplateNuevo] = useState('');
    const [guardando, setGuardando] = useState(false);

    // Cargar cuentas SMTP al montar
    useEffect(() => {
        api.get('/email/cuentas').then(r => setCuentas(r.data || [])).catch(() => { });
    }, []);

    // Recargar templates filtrados cada vez que cambia el SMTP seleccionado
    useEffect(() => {
        const url = smtpId ? `/email/templates?smtpId=${smtpId}` : '/email/templates';
        api.get(url).then(r => {
            setTemplates(r.data || []);
            // Si el template seleccionado ya no está en los resultados, limpiarlo
            setTemplateSeleccionado(prev =>
                prev && !(r.data || []).find(t => t.id === prev.id) ? null : prev
            );
        }).catch(() => { });
    }, [smtpId]);

    // Al seleccionar template: cargar HTML completo + extraer variables
    const handleSeleccionarTemplate = useCallback(async (tmpl) => {
        if (!tmpl) {
            setTemplateSeleccionado(null);
            setTemplateData(null);
            setVariables([]);
            setVariableValues({});
            setAsuntoManual('');
            return;
        }
        setLoadingTemplate(true);
        try {
            const { data } = await api.get(`/email/templates/${tmpl.id}`);
            setTemplateSeleccionado(tmpl);
            setTemplateData(data);
            setAsuntoManual(data.asunto || '');

            const { data: varData } = await api.post('/email/manual/extract-vars', {
                html: data.html || '',
                asunto: data.asunto || '',
            });
            setVariables(varData.variables || []);
            // Inicializar valores vacíos por variable nueva
            setVariableValues(prev => {
                const next = { ...prev };
                for (const v of varData.variables || []) {
                    if (!(v in next)) next[v] = '';
                }
                return next;
            });
        } catch {
            mostrarSnack('Error al cargar el template', 'error');
        } finally {
            setLoadingTemplate(false);
        }
    }, []);

    const quitarAdjunto = (index) => {
        setAdjuntos(prev => prev.filter((_, i) => i !== index));
        // Resetear el input para que se pueda volver a seleccionar el mismo archivo
        if (adjuntosRef.current) adjuntosRef.current.value = '';
    };

    // Preview HTML con variables aplicadas (calculado en cliente)
    const previewHtml = useMemo(() => {
        if (modo === 'template') {
            if (!templateData?.html) return '';
            return renderTemplate(templateData.html, { nombre: toNombre, ...variableValues });
        }
        return htmlLibre;
    }, [modo, templateData, toNombre, variableValues, htmlLibre]);

    const asuntoPreview = useMemo(() => {
        if (modo === 'template') {
            return renderTemplate(asuntoManual, { nombre: toNombre, ...variableValues });
        }
        return subjectLibre;
    }, [modo, asuntoManual, toNombre, variableValues, subjectLibre]);

    // Exportar HTML desde Unlayer antes de enviar (Modo B)
    const exportarHtmlLibre = () =>
        new Promise((resolve) => {
            if (!editorReady || !emailEditorRef.current?.editor) {
                resolve(htmlLibre);
                return;
            }
            emailEditorRef.current.editor.exportHtml((data) => {
                setHtmlLibre(data.html);
                resolve(data.html);
            });
        });

    const validar = (htmlFinal) => {
        if (toList.length === 0) return 'Agregá al menos un email destinatario';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of toList) {
            if (!emailRegex.test(email.trim())) return `Email inválido: ${email}`;
        }
        if (!smtpId) return 'Seleccioná una cuenta SMTP';
        if (modo === 'template') {
            if (!templateSeleccionado) return 'Seleccioná un template';
        } else {
            if (!subjectLibre.trim()) return 'El asunto es requerido';
            if (!htmlFinal?.trim()) return 'El contenido del email es requerido';
        }
        return null;
    };

    const handleEnviar = async () => {
        let htmlFinal = previewHtml;
        if (modo === 'libre') {
            htmlFinal = await exportarHtmlLibre();
        }

        const error = validar(htmlFinal);
        if (error) { mostrarSnack(error, 'warning'); return; }

        setEnviando(true);
        setResultado(null);
        try {
            const formData = new FormData();
            toList.forEach(email => formData.append('to', email.trim()));
            if (toNombre.trim()) formData.append('toNombre', toNombre.trim());
            formData.append('smtpId', String(smtpId));
            formData.append('subject', asuntoPreview);
            formData.append('html', htmlFinal);
            if (modo === 'template' && templateSeleccionado) {
                formData.append('templateId', String(templateSeleccionado.id));
                formData.append('variables', JSON.stringify({ nombre: toNombre, ...variableValues }));
            }
            adjuntos.forEach(f => formData.append('adjuntos', f));

            const { data } = await api.post('/email/manual/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResultado(data);
            const msg = data.total === 1
                ? 'Mail enviado correctamente'
                : `${data.enviados}/${data.total} mails enviados`;
            mostrarSnack(msg, data.ok ? 'success' : 'warning');
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Error al enviar';
            setResultado({ ok: false, error: msg });
            mostrarSnack(msg, 'error');
        } finally {
            setEnviando(false);
        }
    };

    const handleGuardarTemplate = async () => {
        if (!nombreTemplateNuevo.trim()) return;
        let htmlFinal = htmlLibre;
        if (editorReady && emailEditorRef.current?.editor) {
            htmlFinal = await exportarHtmlLibre();
        }
        setGuardando(true);
        try {
            await api.post('/email/manual/guardar-template', {
                nombre: nombreTemplateNuevo.trim(),
                asunto: subjectLibre,
                html: htmlFinal,
            });
            mostrarSnack('Template guardado', 'success');
            setGuardarDialog(false);
            setNombreTemplateNuevo('');
            // Recargar lista de templates
            api.get('/email/templates').then(r => setTemplates(r.data || [])).catch(() => { });
        } catch {
            mostrarSnack('Error al guardar el template', 'error');
        } finally {
            setGuardando(false);
        }
    };

    const mostrarSnack = (msg, severity = 'info') => {
        setSnack({ open: true, msg, severity });
    };

    return (
        <Box sx={{ py: 3, maxWidth: 1400, mx: 'auto' }}>
            <Typography variant="h5" fontWeight="bold" mb={3}>
                Envío Manual de Mail
            </Typography>

            {/* Selector de modo */}
            <Box mb={3}>
                <ToggleButtonGroup
                    value={modo}
                    exclusive
                    onChange={(_, v) => { if (v) setModo(v); }}
                    size="small"
                >
                    <ToggleButton value="template">
                        <ArticleIcon sx={{ mr: 1, fontSize: 18 }} />
                        Desde template
                    </ToggleButton>
                    <ToggleButton value="libre">
                        <EditNoteIcon sx={{ mr: 1, fontSize: 18 }} />
                        Composición libre
                    </ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <Box display="flex" gap={3} alignItems="flex-start" flexWrap="wrap">
                {/* Panel izquierdo: formulario */}
                <Paper elevation={2} sx={{ flex: '1 1 420px', minWidth: 320, p: 3, borderRadius: 3 }}>

                    {/* Datos del destinatario */}
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                        Destinatario
                    </Typography>
                    <Box display="flex" flexDirection="column" gap={2} mb={3}>
                        <Autocomplete
                            multiple
                            freeSolo
                            options={[]}
                            value={toList}
                            onChange={(_, newValue) => setToList(newValue)}
                            renderTags={(value, getTagProps) =>
                                value.map((email, index) => (
                                    <Chip
                                        key={email}
                                        label={email}
                                        {...getTagProps({ index })}
                                        size="small"
                                        color={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'default' : 'error'}
                                    />
                                ))
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Email(s) destinatario(s) *"
                                    placeholder={toList.length === 0 ? 'Escribí y presioná Enter' : ''}
                                    size="small"
                                    helperText="Presioná Enter para agregar cada email"
                                />
                            )}
                        />
                        <TextField
                            label="Nombre"
                            value={toNombre}
                            onChange={e => setToNombre(e.target.value)}
                            size="small"
                            fullWidth
                        />
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    {/* Archivos adjuntos */}
                    <Typography variant="subtitle1" fontWeight="bold" mb={1}>
                        Archivos adjuntos
                    </Typography>
                    <input
                        ref={adjuntosRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => {
                            setAdjuntos(prev => [...prev, ...Array.from(e.target.files)]);
                            e.target.value = '';
                        }}
                    />
                    <Box display="flex" flexDirection="column" gap={1} mb={3}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AttachFileIcon />}
                            onClick={() => adjuntosRef.current?.click()}
                            sx={{ alignSelf: 'flex-start' }}
                        >
                            Adjuntar archivos
                        </Button>
                        {adjuntos.length > 0 && (
                            <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
                                {adjuntos.map((f, i) => (
                                    <Chip
                                        key={i}
                                        label={f.name}
                                        size="small"
                                        onDelete={() => quitarAdjunto(i)}
                                        deleteIcon={<CloseIcon />}
                                    />
                                ))}
                            </Box>
                        )}
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    {/* Cuenta SMTP */}
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                        Cuenta de envío
                    </Typography>
                    <FormControl size="small" fullWidth sx={{ mb: 3 }}>
                        <InputLabel>Cuenta SMTP *</InputLabel>
                        <Select
                            value={smtpId}
                            onChange={e => setSmtpId(e.target.value)}
                            label="Cuenta SMTP *"
                        >
                            {cuentas.map(c => (
                                <MenuItem key={c.id} value={c.id}>
                                    {c.nombre} — {c.usuario}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Divider sx={{ mb: 3 }} />

                    {/* Modo A: template */}
                    {modo === 'template' && (
                        <>
                            <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                                Template
                            </Typography>

                            <Autocomplete
                                options={templates}
                                getOptionLabel={o => o.nombre || ''}
                                value={templateSeleccionado}
                                onChange={(_, v) => handleSeleccionarTemplate(v)}
                                loading={loadingTemplate}
                                size="small"
                                fullWidth
                                renderInput={params => (
                                    <TextField
                                        {...params}
                                        label="Seleccionar template *"
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {loadingTemplate && <CircularProgress size={16} />}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                                sx={{ mb: 2 }}
                            />

                            {/* Asunto editable */}
                            {templateData && (
                                <TextField
                                    label="Asunto"
                                    value={asuntoManual}
                                    onChange={e => setAsuntoManual(e.target.value)}
                                    size="small"
                                    fullWidth
                                    sx={{ mb: 2 }}
                                    helperText="Podés usar variables como {{nombre}}"
                                />
                            )}

                            {/* Variables dinámicas */}
                            {variables.length > 0 && (
                                <>
                                    <Box display="flex" alignItems="center" gap={1} mb={1} mt={1}>
                                        <Typography variant="subtitle2" color="text.secondary">
                                            Variables del template
                                        </Typography>
                                        <Box display="flex" gap={0.5} flexWrap="wrap">
                                            {variables.map(v => (
                                                <Chip key={v} label={`{{${v}}}`} size="small" variant="outlined" />
                                            ))}
                                        </Box>
                                    </Box>
                                    <Box display="flex" flexDirection="column" gap={1.5} mt={1}>
                                        {variables.map(v => (
                                            <TextField
                                                key={v}
                                                label={v}
                                                value={variableValues[v] || ''}
                                                onChange={e => setVariableValues(prev => ({ ...prev, [v]: e.target.value }))}
                                                size="small"
                                                fullWidth
                                            />
                                        ))}
                                    </Box>
                                </>
                            )}
                        </>
                    )}

                    {/* Modo B: composición libre */}
                    {modo === 'libre' && (
                        <>
                            <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                                Contenido
                            </Typography>
                            <TextField
                                label="Asunto *"
                                value={subjectLibre}
                                onChange={e => setSubjectLibre(e.target.value)}
                                size="small"
                                fullWidth
                                sx={{ mb: 2 }}
                            />
                            <Typography variant="caption" color="text.secondary" mb={1} display="block">
                                Editor de contenido
                            </Typography>
                        </>
                    )}

                    <Divider sx={{ my: 3 }} />

                    {/* Acciones */}
                    <Box display="flex" gap={1.5} flexWrap="wrap">
                        <Button
                            variant="contained"
                            startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                            onClick={handleEnviar}
                            disabled={enviando}
                            sx={{ flex: 1 }}
                        >
                            {enviando ? 'Enviando...' : 'Enviar'}
                        </Button>
                        <Tooltip title="Vista previa">
                            <IconButton
                                onClick={() => setPreviewDialog(true)}
                                disabled={!previewHtml}
                                color="primary"
                                sx={{ border: '1px solid', borderColor: 'divider' }}
                            >
                                <PreviewIcon />
                            </IconButton>
                        </Tooltip>
                        {modo === 'libre' && (
                            <Tooltip title="Guardar como template">
                                <IconButton
                                    onClick={() => setGuardarDialog(true)}
                                    color="secondary"
                                    sx={{ border: '1px solid', borderColor: 'divider' }}
                                >
                                    <SaveIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>

                    {/* Resultado del envío */}
                    {resultado && (
                        <Box mt={2}>
                            {resultado.ok ? (
                                <Alert
                                    severity="success"
                                    action={
                                        <Tooltip title="Ver reportes">
                                            <IconButton size="small" href="/email/reportes" target="_blank">
                                                <OpenInNewIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    }
                                >
                                    {resultado.total === 1
                                        ? `Mail enviado · reporte #${resultado.reporteIds?.[0]}`
                                        : `${resultado.enviados}/${resultado.total} mails enviados`}
                                </Alert>
                            ) : resultado.enviados > 0 ? (
                                <Alert severity="warning">
                                    {resultado.enviados}/{resultado.total} enviados.{' '}
                                    {resultado.errores?.map(e => e.email).join(', ')} fallaron.
                                </Alert>
                            ) : (
                                <Alert severity="error">{resultado.error || 'Error al enviar'}</Alert>
                            )}
                        </Box>
                    )}
                </Paper>

                {/* Panel derecho: preview + editor Unlayer (Modo B) */}
                <Box sx={{ flex: '1 1 500px', minWidth: 320 }}>
                    {modo === 'libre' && (
                        <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden', mb: 2 }}>
                            <Box px={2} py={1.5} borderBottom="1px solid" sx={{ borderColor: 'divider' }}>
                                <Typography variant="subtitle2" fontWeight="bold">
                                    Editor de contenido
                                </Typography>
                            </Box>
                            <EmailEditor
                                ref={emailEditorRef}
                                onReady={() => setEditorReady(true)}
                                options={{ locale: 'es-ES', features: { textEditor: { tables: true } } }}
                                style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}
                            />
                        </Paper>
                    )}

                    {/* Live preview */}
                    {(modo === 'template' && templateData) && (
                        <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                            <Box
                                px={2} py={1.5}
                                borderBottom="1px solid"
                                sx={{ borderColor: 'divider' }}
                                display="flex"
                                alignItems="center"
                                justifyContent="space-between"
                            >
                                <Typography variant="subtitle2" fontWeight="bold">
                                    Vista previa
                                </Typography>
                                {asuntoPreview && (
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                                        Asunto: {asuntoPreview}
                                    </Typography>
                                )}
                            </Box>
                            <Box sx={{ height: 600, overflow: 'auto', bgcolor: '#f5f5f5' }}>
                                <iframe
                                    srcDoc={previewHtml}
                                    title="Vista previa del email"
                                    sandbox="allow-same-origin"
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                />
                            </Box>
                        </Paper>
                    )}

                    {modo === 'template' && !templateData && (
                        <Paper
                            elevation={0}
                            sx={{
                                borderRadius: 3,
                                border: '2px dashed',
                                borderColor: 'divider',
                                height: 300,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column',
                                gap: 1,
                                color: 'text.secondary',
                            }}
                        >
                            <PreviewIcon sx={{ fontSize: 48, opacity: 0.3 }} />
                            <Typography variant="body2">
                                Seleccioná un template para ver la vista previa
                            </Typography>
                        </Paper>
                    )}
                </Box>
            </Box>

            {/* Dialog: vista previa en modal */}
            <Dialog open={previewDialog} onClose={() => setPreviewDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    Vista previa
                    {asuntoPreview && (
                        <Typography variant="caption" display="block" color="text.secondary">
                            Asunto: {asuntoPreview}
                        </Typography>
                    )}
                </DialogTitle>
                <DialogContent dividers sx={{ p: 0, height: '70vh' }}>
                    <iframe
                        srcDoc={previewHtml}
                        title="Vista previa del email"
                        sandbox="allow-same-origin"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPreviewDialog(false)}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog: guardar como template */}
            <Dialog open={guardarDialog} onClose={() => setGuardarDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Guardar como template</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Nombre del template"
                        value={nombreTemplateNuevo}
                        onChange={e => setNombreTemplateNuevo(e.target.value)}
                        fullWidth
                        autoFocus
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setGuardarDialog(false)}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={handleGuardarTemplate}
                        disabled={guardando || !nombreTemplateNuevo.trim()}
                        startIcon={guardando ? <CircularProgress size={14} /> : <SaveIcon />}
                    >
                        Guardar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar de feedback */}
            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
