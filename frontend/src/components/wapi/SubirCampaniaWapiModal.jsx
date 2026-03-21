import React, { useEffect, useState } from 'react';
import {
    Box, Button, TextField, Typography, CircularProgress,
    Alert, Step, StepLabel, Stepper, Select, MenuItem,
    FormControl, InputLabel, Chip, Divider,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import api from '../../api/axios';

/** Lee las cabeceras del CSV en el cliente sin parsear todo el archivo */
function leerColumnasCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const firstLine = text.split('\n')[0];
            // Detecta separador (coma o punto y coma)
            const sep = firstLine.includes(';') ? ';' : ',';
            const columnas = firstLine.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
            resolve(columnas);
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

/** Extrae variables {{1}}, {{2}}, etc. del body de los componentes */
function extraerVariables(componentes) {
    if (!Array.isArray(componentes)) return [];
    const body = componentes.find(c => c.type === 'BODY');
    if (!body?.text) return [];
    const matches = [...body.text.matchAll(/\{\{(\d+)\}\}/g)];
    return [...new Set(matches.map(m => m[1]))].sort((a, b) => Number(a) - Number(b));
}

const STEPS = ['Datos básicos', 'Mapear variables', 'Configurar envío'];

export default function SubirCampaniaWapiModal({ onCreado }) {
    const [step, setStep] = useState(0);
    const [nombre, setNombre] = useState('');
    const [archivo, setArchivo] = useState(null);
    const [columnasCSV, setColumnasCSV] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [templateId, setTemplateId] = useState('');
    const [templateSeleccionado, setTemplateSeleccionado] = useState(null);
    const [variablesTemplate, setVariablesTemplate] = useState([]); // ['1','2',...]
    const [variableMapping, setVariableMapping] = useState({}); // { '1': 'nombre', '2': 'deuda' }
    const [delayMs, setDelayMs] = useState(1200);
    const [loading, setLoading] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [error, setError] = useState('');
    const [configs, setConfigs] = useState([]);
    const [configId, setConfigId] = useState('');

    useEffect(() => {
        api.get('/wapi/config')
            .then(res => {
                const activas = (Array.isArray(res.data) ? res.data : []).filter(c => c.activo);
                setConfigs(activas);
                if (activas.length === 1) setConfigId(String(activas[0].id));
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        api.get('/wapi/templates')
            .then(res => setTemplates(res.data.filter(t => t.estado === 'APPROVED')))
            .catch(() => setError('No se pudieron cargar los templates.'))
            .finally(() => setLoadingTemplates(false));
    }, []);

    const handleArchivo = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setArchivo(file);
        try {
            const cols = await leerColumnasCSV(file);
            setColumnasCSV(cols);
        } catch {
            setError('No se pudo leer el CSV.');
        }
    };

    const handleTemplateChange = (id) => {
        setTemplateId(id);
        const tpl = templates.find(t => t.id === Number(id));
        setTemplateSeleccionado(tpl ?? null);
        const vars = tpl ? extraerVariables(tpl.componentes) : [];
        setVariablesTemplate(vars);
        // Resetear mapping al cambiar template
        setVariableMapping(Object.fromEntries(vars.map(v => [v, ''])));
    };

    const puedeAvanzarPaso0 = nombre.trim() && archivo && templateId && (configs.length === 0 || configId);
    const puedeAvanzarPaso1 = variablesTemplate.every(v => variableMapping[v]);

    const handleSiguiente = () => {
        setError('');
        if (step === 0 && !puedeAvanzarPaso0) {
            setError('Completá el nombre, la línea de envío, el template y subí un CSV.');
            return;
        }
        if (step === 1 && !puedeAvanzarPaso1) {
            setError('Mapeá todas las variables del template.');
            return;
        }
        setStep(s => s + 1);
    };

    const handleCrear = async () => {
        setLoading(true);
        setError('');
        try {
            const user = JSON.parse(localStorage.getItem('usuario') ?? '{}');
            const formData = new FormData();
            formData.append('file', archivo);
            formData.append('nombre', nombre.trim());
            formData.append('templateId', String(templateId));
            formData.append('variableMapping', JSON.stringify(variableMapping));
            formData.append('delayMs', String(delayMs));
            if (user?.id) formData.append('userId', String(user.id));
            if (configId) formData.append('configId', String(configId));

            const res = await api.post('/wapi/campanias', formData);
            onCreado(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Error al crear la campaña.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box display="flex" flexDirection="column" gap={3}>
            <Stepper activeStep={step} alternativeLabel>
                {STEPS.map(label => (
                    <Step key={label}><StepLabel>{label}</StepLabel></Step>
                ))}
            </Stepper>

            {error && <Alert severity="error">{error}</Alert>}

            {/* ── PASO 0: Datos básicos ── */}
            {step === 0 && (
                <Box display="flex" flexDirection="column" gap={2}>
                    <TextField
                        label="Nombre de la campaña"
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        fullWidth
                        required
                    />

                    {configs.length > 0 && (
                        <FormControl fullWidth required>
                            <InputLabel>Línea de envío</InputLabel>
                            <Select
                                value={configId}
                                label="Línea de envío"
                                onChange={e => setConfigId(e.target.value)}
                            >
                                {configs.map(c => (
                                    <MenuItem key={c.id} value={String(c.id)}>
                                        {c.nombre ?? `Línea ${c.id}`}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <FormControl fullWidth required>
                        <InputLabel>Template aprobado</InputLabel>
                        <Select
                            value={templateId}
                            label="Template aprobado"
                            onChange={e => handleTemplateChange(e.target.value)}
                            disabled={loadingTemplates}
                        >
                            {templates.map(t => (
                                <MenuItem key={t.id} value={t.id}>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <span>{t.metaNombre}</span>
                                        <Chip label={t.categoria} size="small" variant="outlined" />
                                        <Chip label={t.idioma} size="small" variant="outlined" />
                                    </Box>
                                </MenuItem>
                            ))}
                            {templates.length === 0 && !loadingTemplates && (
                                <MenuItem disabled>No hay templates aprobados. Sincronizá primero.</MenuItem>
                            )}
                        </Select>
                    </FormControl>

                    <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                        {archivo ? archivo.name : 'Seleccionar CSV'}
                        <input type="file" accept=".csv" hidden onChange={handleArchivo} />
                    </Button>
                    {columnasCSV.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                            Columnas detectadas: {columnasCSV.join(', ')}
                        </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                        El CSV debe tener una columna <strong>numero</strong> con el número en formato internacional (ej: 5491112345678).
                    </Typography>
                </Box>
            )}

            {/* ── PASO 1: Mapear variables ── */}
            {step === 1 && (
                <Box display="flex" flexDirection="column" gap={2}>
                    {variablesTemplate.length === 0 ? (
                        <Alert severity="info">
                            Este template no tiene variables en el body. No hay nada que mapear.
                        </Alert>
                    ) : (
                        <>
                            <Typography variant="body2" color="text.secondary">
                                Asigná cada variable del template a una columna del CSV.
                            </Typography>
                            {variablesTemplate.map(varNum => (
                                <FormControl key={varNum} fullWidth required>
                                    <InputLabel>{`Variable {{${varNum}}}`}</InputLabel>
                                    <Select
                                        value={variableMapping[varNum] ?? ''}
                                        label={`Variable {{${varNum}}}`}
                                        onChange={e => setVariableMapping(prev => ({ ...prev, [varNum]: e.target.value }))}
                                    >
                                        {columnasCSV.map(col => (
                                            <MenuItem key={col} value={col}>{col}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            ))}
                        </>
                    )}
                </Box>
            )}

            {/* ── PASO 2: Configurar envío ── */}
            {step === 2 && (
                <Box display="flex" flexDirection="column" gap={2}>
                    <TextField
                        label="Delay entre mensajes (ms)"
                        type="number"
                        value={delayMs}
                        onChange={e => setDelayMs(Number(e.target.value))}
                        fullWidth
                        inputProps={{ min: 500, max: 10000, step: 100 }}
                        helperText="Tiempo de espera entre cada envío. Mínimo recomendado: 1000ms para evitar bloqueos de Meta."
                    />

                    <Divider />

                    <Box sx={{ backgroundColor: 'action.hover', borderRadius: 1, p: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={1}>Resumen</Typography>
                        <Typography variant="body2">Campaña: <strong>{nombre}</strong></Typography>
                        {configId && configs.length > 0 && (
                            <Typography variant="body2">Línea: <strong>{configs.find(c => String(c.id) === configId)?.nombre ?? configId}</strong></Typography>
                        )}
                        <Typography variant="body2">Template: <strong>{templateSeleccionado?.metaNombre}</strong></Typography>
                        <Typography variant="body2">Archivo: <strong>{archivo?.name}</strong></Typography>
                        <Typography variant="body2">Delay: <strong>{delayMs}ms</strong></Typography>
                        {variablesTemplate.length > 0 && (
                            <Typography variant="body2">
                                Variables: {variablesTemplate.map(v => `{{${v}}} → ${variableMapping[v]}`).join(', ')}
                            </Typography>
                        )}
                    </Box>
                </Box>
            )}

            {/* Navegación */}
            <Box display="flex" justifyContent="space-between">
                <Button onClick={() => setStep(s => s - 1)} disabled={step === 0}>
                    Atrás
                </Button>
                {step < STEPS.length - 1 ? (
                    <Button variant="contained" onClick={handleSiguiente}>
                        Siguiente
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        onClick={handleCrear}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        {loading ? 'Creando...' : 'Crear campaña'}
                    </Button>
                )}
            </Box>
        </Box>
    );
}
