import React, { useEffect, useState } from 'react';
import {
    Alert, Box, Button, CircularProgress, Divider, FormControl, FormHelperText, InputLabel, MenuItem, Select, Step,
    StepContent, StepLabel, Stepper, TextField, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { FileUp } from 'lucide-react';
import api from '../../api/axios';
import { ResponsiveDialog } from '../ui';

/**
 * Lee del CSV las columnas del encabezado y cuántas filas de datos trae, sin parsearlo entero. El conteo es de líneas
 * no vacías: alcanza para decir cuántos mensajes se van a enviar (los dados de baja los descarta el backend al crear).
 */
function leerCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const lineas = String(e.target.result).replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
            const primera = lineas[0] ?? '';
            // Detecta separador (coma o punto y coma)
            const sep = primera.includes(';') ? ';' : ',';
            const columnas = primera.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
            resolve({ columnas, filas: Math.max(lineas.length - 1, 0) });
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

/** Extrae variables {{1}}, {{2}}, etc. del body de los componentes */
function extraerVariables(componentes) {
    if (!Array.isArray(componentes)) return [];
    const body = componentes.find((c) => c.type === 'BODY');
    if (!body?.text) return [];
    const matches = [...body.text.matchAll(/\{\{(\d+)\}\}/g)];
    return [...new Set(matches.map((m) => m[1]))].sort((a, b) => Number(a) - Number(b));
}

const STEPS = ['Datos básicos', 'Mapear variables', 'Configurar envío'];

// Los delays se cargan en segundos (como los piensa quien arma la campaña) y se mandan en milisegundos, como espera el backend.
const DELAY_MIN_INICIAL = 30;
const DELAY_MAX_INICIAL = 60;

/**
 * Asistente de nueva campaña de WhatsApp API.
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(data: {totalContactos: number, omitidosPorBaja?: number}) => void} props.onCreado
 */
export default function SubirCampaniaWapiModal({ open, onClose, onCreado }) {
    const theme = useTheme();
    const celular = useMediaQuery(theme.breakpoints.down('sm'));
    const [step, setStep] = useState(0);
    const [nombre, setNombre] = useState('');
    const [archivo, setArchivo] = useState(null);
    const [columnasCSV, setColumnasCSV] = useState([]);
    const [filasCSV, setFilasCSV] = useState(0);
    const [templates, setTemplates] = useState([]);
    const [templateId, setTemplateId] = useState('');
    const [templateSeleccionado, setTemplateSeleccionado] = useState(null);
    const [variablesTemplate, setVariablesTemplate] = useState([]); // ['1','2',...]
    const [variableMapping, setVariableMapping] = useState({}); // { '1': 'nombre', '2': 'deuda' }
    const [delayMinS, setDelayMinS] = useState(DELAY_MIN_INICIAL);
    const [delayMaxS, setDelayMaxS] = useState(DELAY_MAX_INICIAL);
    const [loading, setLoading] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [error, setError] = useState('');
    const [configs, setConfigs] = useState([]);
    const [configId, setConfigId] = useState('');

    // Cada vez que se abre arranca limpio y vuelve a pedir líneas y plantillas (pudieron cambiar).
    useEffect(() => {
        if (!open) return undefined;
        let activo = true;
        setStep(0);
        setNombre('');
        setArchivo(null);
        setColumnasCSV([]);
        setFilasCSV(0);
        setTemplateId('');
        setTemplateSeleccionado(null);
        setVariablesTemplate([]);
        setVariableMapping({});
        setDelayMinS(DELAY_MIN_INICIAL);
        setDelayMaxS(DELAY_MAX_INICIAL);
        setError('');
        setConfigId('');
        setLoadingTemplates(true);

        api.get('/wapi/config')
            .then((res) => {
                if (!activo) return;
                const activas = (Array.isArray(res.data) ? res.data : []).filter((c) => c.activo);
                setConfigs(activas);
                if (activas.length === 1) setConfigId(String(activas[0].id));
            })
            .catch(() => {});
        api.get('/wapi/templates')
            .then((res) => { if (activo) setTemplates(res.data.filter((t) => t.estado === 'APPROVED')); })
            .catch(() => { if (activo) setError('No se pudieron cargar las plantillas.'); })
            .finally(() => { if (activo) setLoadingTemplates(false); });
        return () => { activo = false; };
    }, [open]);

    // Plantillas filtradas según la línea seleccionada (mismo wabaId)
    const templatesFiltrados = configId
        ? templates.filter((t) => {
            const cfg = configs.find((c) => String(c.id) === configId);
            return cfg ? t.wabaId === cfg.wabaId : true;
        })
        : templates;
    const faltaLinea = configs.length > 0 && !configId;

    const handleArchivo = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        setError('');
        setArchivo(file);
        try {
            const { columnas, filas } = await leerCSV(file);
            setColumnasCSV(columnas);
            setFilasCSV(filas);
            if (!columnas.some((c) => c === 'numero')) {
                setError(`El CSV no tiene una columna «numero». Las columnas que trae son: ${columnas.join(', ') || 'ninguna'}.`);
            }
        } catch {
            setColumnasCSV([]);
            setFilasCSV(0);
            setError('No se pudo leer el CSV.');
        }
    };

    const handleTemplateChange = (id) => {
        setTemplateId(id);
        const tpl = templates.find((t) => t.id === Number(id));
        setTemplateSeleccionado(tpl ?? null);
        const vars = tpl ? extraerVariables(tpl.componentes) : [];
        setVariablesTemplate(vars);
        // Resetear mapping al cambiar plantilla
        setVariableMapping(Object.fromEntries(vars.map((v) => [v, ''])));
    };

    const tieneNumero = columnasCSV.some((c) => c === 'numero');
    const puedeAvanzarPaso0 = nombre.trim() && archivo && templateId && (configs.length === 0 || configId) && tieneNumero;
    const puedeAvanzarPaso1 = variablesTemplate.every((v) => variableMapping[v]);
    const delayValido = delayMinS > 0 && delayMinS < delayMaxS;
    const sucio = !!(nombre.trim() || archivo || templateId);
    const lineaElegida = configs.find((c) => String(c.id) === configId);

    const handleSiguiente = () => {
        setError('');
        if (step === 0 && !puedeAvanzarPaso0) {
            setError(archivo && !tieneNumero
                ? 'El CSV tiene que traer una columna «numero».'
                : 'Completá el nombre, la línea de envío, la plantilla y subí un CSV.');
            return;
        }
        if (step === 1 && !puedeAvanzarPaso1) {
            setError('Mapeá todas las variables de la plantilla.');
            return;
        }
        setStep((s) => s + 1);
    };

    const handleCrear = async () => {
        if (loading) return;
        setLoading(true);
        setError('');
        try {
            const user = JSON.parse(localStorage.getItem('usuario') ?? '{}');
            const formData = new FormData();
            formData.append('file', archivo);
            formData.append('nombre', nombre.trim());
            formData.append('templateId', String(templateId));
            formData.append('variableMapping', JSON.stringify(variableMapping));
            formData.append('delayMinMs', String(Math.round(delayMinS * 1000)));
            formData.append('delayMaxMs', String(Math.round(delayMaxS * 1000)));
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

    // ── Contenido de cada paso ───────────────────────────────────────────────

    const paso0 = (
        <Box display="flex" flexDirection="column" gap={2} sx={{ pt: 1 }}>
            <TextField label="Nombre de la campaña" value={nombre} onChange={(e) => setNombre(e.target.value)} fullWidth required />

            {configs.length > 0 && (
                <FormControl fullWidth required>
                    <InputLabel id="wapi-linea-label">Línea de envío</InputLabel>
                    <Select
                        labelId="wapi-linea-label"
                        value={configId}
                        label="Línea de envío"
                        onChange={(e) => {
                            setConfigId(e.target.value);
                            setTemplateId('');
                            setTemplateSeleccionado(null);
                            setVariablesTemplate([]);
                            setVariableMapping({});
                        }}
                    >
                        {configs.map((c) => (
                            <MenuItem key={c.id} value={String(c.id)} sx={{ minHeight: 44 }}>
                                {c.nombre ?? `Línea ${c.id}`}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

            <FormControl fullWidth required disabled={loadingTemplates || faltaLinea}>
                <InputLabel id="wapi-plantilla-label">Plantilla aprobada</InputLabel>
                <Select
                    labelId="wapi-plantilla-label"
                    value={templateId}
                    label="Plantilla aprobada"
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    // El valor elegido se ve como el nombre solo: el detalle (categoría e idioma) queda en la lista.
                    renderValue={(id) => templates.find((t) => t.id === Number(id))?.metaNombre ?? ''}
                >
                    {templatesFiltrados.map((t) => (
                        <MenuItem key={t.id} value={t.id} sx={{ minHeight: 44, whiteSpace: 'normal' }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{t.metaNombre}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>
                                    {[t.categoria, t.idioma].filter(Boolean).join(' · ')}
                                </Typography>
                            </Box>
                        </MenuItem>
                    ))}
                    {templatesFiltrados.length === 0 && !loadingTemplates && (
                        <MenuItem disabled>No hay plantillas aprobadas para esta línea. Sincronizalas primero.</MenuItem>
                    )}
                </Select>
                {faltaLinea && <FormHelperText>Elegí una línea primero.</FormHelperText>}
            </FormControl>

            <Button variant="outlined" component="label" startIcon={<FileUp size={18} strokeWidth={1.75} aria-hidden />} sx={{ justifyContent: 'flex-start', overflowWrap: 'anywhere' }}>
                {archivo ? archivo.name : 'Seleccionar CSV'}
                <input type="file" accept=".csv,text/csv" hidden onChange={handleArchivo} />
            </Button>
            {columnasCSV.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12.5 }}>
                    {numero(filasCSV)} filas · Columnas detectadas: {columnasCSV.join(', ')}
                </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12.5 }}>
                El CSV debe tener una columna <strong>numero</strong> con el número en formato internacional (ej: 5491112345678).
            </Typography>
        </Box>
    );

    const paso1 = (
        <Box display="flex" flexDirection="column" gap={2} sx={{ pt: 1 }}>
            {variablesTemplate.length === 0 ? (
                <Alert severity="info">Esta plantilla no tiene variables en el cuerpo. No hay nada que mapear.</Alert>
            ) : (
                <>
                    <Typography variant="body2" color="text.secondary">Asigná cada variable de la plantilla a una columna del CSV.</Typography>
                    {variablesTemplate.map((varNum) => (
                        <FormControl key={varNum} fullWidth required>
                            <InputLabel id={`wapi-var-${varNum}`}>{`Variable {{${varNum}}}`}</InputLabel>
                            <Select
                                labelId={`wapi-var-${varNum}`}
                                value={variableMapping[varNum] ?? ''}
                                label={`Variable {{${varNum}}}`}
                                onChange={(e) => setVariableMapping((prev) => ({ ...prev, [varNum]: e.target.value }))}
                            >
                                {columnasCSV.map((col) => (
                                    <MenuItem key={col} value={col} sx={{ minHeight: 44 }}>{col}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    ))}
                </>
            )}
        </Box>
    );

    const paso2 = (
        <Box display="flex" flexDirection="column" gap={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
                La espera entre mensajes es aleatoria dentro del rango que pongas, lo que reduce la detección de patrones automáticos por parte de Meta.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <TextField
                    label="Espera mínima (segundos)"
                    type="number"
                    value={delayMinS}
                    onChange={(e) => setDelayMinS(Number(e.target.value))}
                    fullWidth
                    inputProps={{ min: 1, max: 120, step: 1, inputMode: 'numeric' }}
                    helperText="Ej: 30 = medio minuto"
                    error={delayMinS >= delayMaxS}
                />
                <TextField
                    label="Espera máxima (segundos)"
                    type="number"
                    value={delayMaxS}
                    onChange={(e) => setDelayMaxS(Number(e.target.value))}
                    fullWidth
                    inputProps={{ min: 1, max: 120, step: 1, inputMode: 'numeric' }}
                    helperText="Ej: 60 = un minuto"
                    error={delayMaxS <= delayMinS}
                />
            </Box>
            {!delayValido && <Alert severity="warning">La espera mínima debe ser mayor que cero y menor que la máxima.</Alert>}
            <Divider />

            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Resumen</Typography>
                <Typography variant="body2">Campaña: <strong>{nombre}</strong></Typography>
                {lineaElegida && (
                    <Typography variant="body2">Línea: <strong>{lineaElegida.nombre ?? `Línea ${lineaElegida.id}`}</strong></Typography>
                )}
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>Plantilla: <strong>{templateSeleccionado?.metaNombre}</strong></Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>Archivo: <strong>{archivo?.name}</strong></Typography>
                <Typography variant="body2">Espera: <strong>{delayMinS} a {delayMaxS} segundos (al azar)</strong></Typography>
                {variablesTemplate.length > 0 && (
                    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        Variables: {variablesTemplate.map((v) => `{{${v}}} → ${variableMapping[v]}`).join(', ')}
                    </Typography>
                )}
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
                    Se van a enviar {numero(filasCSV)} mensajes.
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12.5 }}>
                    Los contactos dados de baja se omiten al crear la campaña; el aviso te dice cuántos.
                </Typography>
            </Box>
        </Box>
    );

    const pasos = [paso0, paso1, paso2];

    return (
        <ResponsiveDialog
            open={open}
            onClose={loading ? () => {} : onClose}
            title="Nueva campaña de WhatsApp API"
            maxWidth="sm"
            sucio={sucio && !loading}
            actions={(
                <>
                    <Button onClick={onClose} disabled={loading} color="inherit">Cancelar</Button>
                    <Box sx={{ flex: 1 }} />
                    <Button onClick={() => { setError(''); setStep((s) => s - 1); }} disabled={step === 0 || loading}>Atrás</Button>
                    {step < STEPS.length - 1 ? (
                        <Button variant="contained" onClick={handleSiguiente}>Siguiente</Button>
                    ) : (
                        <Button
                            variant="contained"
                            onClick={handleCrear}
                            disabled={loading || !delayValido}
                            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                        >
                            {loading ? 'Creando…' : 'Crear campaña'}
                        </Button>
                    )}
                </>
            )}
        >
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {celular ? (
                // En el celular el asistente es vertical: cada paso se abre debajo de su título.
                <Stepper activeStep={step} orientation="vertical">
                    {STEPS.map((label, i) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                            <StepContent>{pasos[i]}</StepContent>
                        </Step>
                    ))}
                </Stepper>
            ) : (
                <>
                    <Stepper activeStep={step} alternativeLabel sx={{ mb: 2 }}>
                        {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                    </Stepper>
                    {pasos[step]}
                </>
            )}
        </ResponsiveDialog>
    );
}

const numero = (n) => (n ?? 0).toLocaleString('es-AR');
