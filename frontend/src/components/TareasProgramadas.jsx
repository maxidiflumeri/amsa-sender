import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert, Autocomplete, Box, Button, Chip, CircularProgress, Divider, FormControlLabel, MenuItem, Stack,
    Switch, TablePagination, TextField, Typography,
} from '@mui/material';
import { History, Pause, Pencil, Play, Plus, RefreshCw, Timer, Trash2, Zap } from 'lucide-react';
import api from '../api/axios';
import { mensajeDeError, useFeedback } from '../context/FeedbackContext';
import { migasDe } from './layout/navConfig';
import {
    BloqueEstado, ConfirmDialog, DataTableResponsive, EmptyState, PageContainer, PageHeader, ResponsiveDialog, SectionCard, StatusChip,
} from './ui';
import MenuMas from './admin/MenuMas';
import HtmlTemplateEditor from './utils/HTMLTemplateEditor';

const TZ_DEFAULT = 'America/Argentina/Buenos_Aires';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// El backend (CrearTareaDto) hoy solo acepta este tipo: ofrecer otros terminaba en un error 400 al guardar.
const TIPOS = [{ value: 'REPORTE_EMAIL_DIARIO', label: 'Reporte de email diario' }];
const NOMBRE_TIPO = {
    REPORTE_EMAIL_DIARIO: 'Reporte de email diario',
    REPORTE_EMAIL_SEMANAL: 'Reporte de email semanal',
    REPORTE_WHATSAPP_DIARIO: 'Reporte de WhatsApp diario',
};
const nombreTipo = (t) => NOMBRE_TIPO[t] ?? t;

const ESTADO_EJECUCION = {
    queued: { label: 'En cola', tono: 'neutro' },
    running: { label: 'Ejecutando', tono: 'info' },
    completed: { label: 'Completada', tono: 'ok' },
    failed: { label: 'Falló', tono: 'error' },
    retrying: { label: 'Reintentando', tono: 'aviso' },
};

const DIAS = { 0: 'domingos', 1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes', 6: 'sábados' };

const fecha = (v) => (v
    ? new Date(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—');

function buildCronFromPreset(preset, { cadaMin = 5, hora = '08', minuto = '00', diaSemana = '1', diaMes = '1', customCron = '0 8 * * *' }) {
    switch (preset) {
        case 'cada_x_minutos': return `*/${parseInt(cadaMin || 1, 10)} * * * *`;
        case 'cada_hora_al_minuto': return `${parseInt(minuto || 0, 10)} * * * *`;
        case 'diario_hora': return `${parseInt(minuto || 0, 10)} ${parseInt(hora || 0, 10)} * * *`;
        case 'semanal_dow_hora': return `${parseInt(minuto || 0, 10)} ${parseInt(hora || 0, 10)} * * ${diaSemana}`;
        case 'mensual_dom_hora': return `${parseInt(minuto || 0, 10)} ${parseInt(hora || 0, 10)} ${parseInt(diaMes || 1, 10)} * *`;
        case 'custom':
        default: return customCron || '0 8 * * *';
    }
}

const dosDigitos = (v) => String(v).padStart(2, '0');

function describePreset(preset, { cadaMin, hora, minuto, diaSemana, diaMes, customCron }) {
    const hm = `${dosDigitos(hora)}:${dosDigitos(minuto)}`;
    switch (preset) {
        case 'cada_x_minutos': return `Cada ${cadaMin} minutos`;
        case 'cada_hora_al_minuto': return `Cada hora, al minuto ${minuto}`;
        case 'diario_hora': return `Todos los días a las ${hm}`;
        case 'semanal_dow_hora': return `Los ${DIAS[diaSemana] ?? diaSemana} a las ${hm}`;
        case 'mensual_dom_hora': return `El día ${diaMes} de cada mes a las ${hm}`;
        default: return `Cron personalizado: ${customCron}`;
    }
}

/**
 * Deduce el preset a partir de la expresión cron. El backend no guarda el preset (la tabla tiene solo el cron), así
 * que al editar se lo reconstruye: sin esto, toda tarea caía en "Cron personalizado".
 */
function inferirPreset(cron) {
    const base = { preset: 'custom', cadaMin: 5, hora: '08', minuto: '00', diaSemana: '1', diaMes: '1', customCron: cron || '0 8 * * *' };
    const p = String(cron || '').trim().split(/\s+/);
    if (p.length !== 5) return base;
    const [m, h, dom, mon, dow] = p;
    const num = (s) => /^\d+$/.test(s);
    if (mon !== '*') return base;
    let r;
    if (/^\*\/\d+$/.test(m) && h === '*' && dom === '*' && dow === '*') {
        r = { preset: 'cada_x_minutos', cadaMin: Number(m.slice(2)) };
    } else if (num(m) && h === '*' && dom === '*' && dow === '*') {
        r = { preset: 'cada_hora_al_minuto', minuto: dosDigitos(m) };
    } else if (num(m) && num(h) && dom === '*' && dow === '*') {
        r = { preset: 'diario_hora', hora: dosDigitos(h), minuto: dosDigitos(m) };
    } else if (num(m) && num(h) && dom === '*' && /^[0-6]$/.test(dow)) {
        r = { preset: 'semanal_dow_hora', hora: dosDigitos(h), minuto: dosDigitos(m), diaSemana: dow };
    } else if (num(m) && num(h) && num(dom) && dow === '*') {
        r = { preset: 'mensual_dom_hora', hora: dosDigitos(h), minuto: dosDigitos(m), diaMes: String(Number(dom)) };
    } else {
        return base;
    }
    return { ...base, ...r };
}

/** Lo que se guarda: el backend rechaza campos que no conoce, así que la descripción va dentro de `configuracion`. */
function sanitizeCreateOrUpdate(raw) {
    return {
        nombre: String(raw.nombre || '').trim(),
        tipo: raw.tipo,
        expresionCron: raw.expresionCron,
        zonaHoraria: raw.zonaHoraria,
        habilitada: Boolean(raw.habilitada),
        destinatarios: Array.isArray(raw.destinatarios) ? raw.destinatarios : [],
        configuracion: {
            reportes: {
                rebotes: !!raw?.configuracion?.reportes?.rebotes,
                acciones: !!raw?.configuracion?.reportes?.acciones,
            },
            asuntoTpl: raw?.configuracion?.asuntoTpl ?? '',
            htmlTpl: raw?.configuracion?.htmlTpl ?? '',
            descripcion: String(raw.descripcion || '').trim(),
        },
    };
}

const descripcionDe = (t) => t?.configuracion?.descripcion || t?.descripcion || '';

function formInicial(t) {
    const cron = t?.expresionCron || t?.cron || '0 8 * * *';
    return {
        nombre: t?.nombre || '',
        descripcion: descripcionDe(t),
        tipo: t?.tipo || 'REPORTE_EMAIL_DIARIO',
        tz: t?.zonaHoraria || t?.tz || TZ_DEFAULT,
        habilitada: t?.habilitada ?? t?.activa ?? true,
        ...inferirPreset(cron),
        destinatarios: Array.isArray(t?.destinatarios) ? t.destinatarios : [],
        asuntoTpl: t?.configuracion?.asuntoTpl || '',
        htmlTpl: t?.configuracion?.htmlTpl || '',
        repRebotes: t?.configuracion?.reportes?.rebotes ?? true,
        repAcciones: t?.configuracion?.reportes?.acciones ?? true,
    };
}

// --- Diálogo crear / editar
function TareaDialog({ open, onClose, onSubmit, initial, guardando, error }) {
    const isEdit = Boolean(initial?.id);
    const [f, setF] = useState(() => formInicial(initial));
    const base = useRef(JSON.stringify(f));
    const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

    const expresionCron = useMemo(() => buildCronFromPreset(f.preset, f), [f]);
    const resumen = useMemo(() => describePreset(f.preset, f), [f]);

    const invalidos = f.destinatarios.filter((d) => !EMAIL_RE.test(d));
    const cadaInvalido = f.preset === 'cada_x_minutos' && !(Number(f.cadaMin) >= 1 && Number(f.cadaMin) <= 59);
    // Qué falta, para decirlo al lado del botón en vez de dejarlo apagado sin explicación.
    const faltantes = [];
    if (!f.nombre.trim()) faltantes.push('el nombre');
    if (cadaInvalido) faltantes.push('un intervalo de 1 a 59 minutos');
    if (f.preset === 'custom' && f.customCron.trim().split(/\s+/).length !== 5) faltantes.push('una expresión cron de 5 campos');
    if (f.destinatarios.length === 0) faltantes.push('al menos un destinatario');
    else if (invalidos.length > 0) faltantes.push('corregir los emails inválidos');

    const sucio = JSON.stringify(f) !== base.current;

    const guardar = () => onSubmit({
        id: initial?.id,
        nombre: f.nombre,
        tipo: f.tipo,
        expresionCron,
        zonaHoraria: f.tz,
        habilitada: f.habilitada,
        destinatarios: f.destinatarios,
        descripcion: f.descripcion,
        configuracion: { reportes: { rebotes: f.repRebotes, acciones: f.repAcciones }, asuntoTpl: f.asuntoTpl, htmlTpl: f.htmlTpl },
    });

    return (
        <ResponsiveDialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            sucio={sucio && !guardando}
            title={isEdit ? 'Editar tarea' : 'Nueva tarea'}
            actions={
                <>
                    {faltantes.length > 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 100%', fontSize: 13 }}>
                            Para guardar falta: {faltantes.join(', ')}.
                        </Typography>
                    )}
                    <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={guardar}
                        disabled={guardando || faltantes.length > 0}
                        startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        {guardando ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear tarea'}
                    </Button>
                </>
            }
        >
            <Stack spacing={2.5} sx={{ pt: 0.5 }}>
                {error && <Alert severity="error" role="alert">{error}</Alert>}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                    <TextField label="Nombre" value={f.nombre} onChange={set('nombre')} fullWidth required />
                    <TextField select label="Tipo" value={f.tipo} onChange={set('tipo')} fullWidth>
                        {TIPOS.map((t) => <MenuItem key={t.value} value={t.value} sx={{ minHeight: 44 }}>{t.label}</MenuItem>)}
                    </TextField>
                </Box>

                <TextField label="Descripción (opcional)" value={f.descripcion} onChange={set('descripcion')} fullWidth multiline minRows={2} />

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2, alignItems: 'center' }}>
                    <TextField select label="Zona horaria" value={f.tz} onChange={set('tz')} fullWidth>
                        <MenuItem value="America/Argentina/Buenos_Aires" sx={{ minHeight: 44 }}>Argentina (Buenos Aires)</MenuItem>
                        <MenuItem value="UTC" sx={{ minHeight: 44 }}>UTC</MenuItem>
                    </TextField>
                    <FormControlLabel
                        sx={{ minHeight: 44, mx: 0 }}
                        control={<Switch checked={f.habilitada} onChange={set('habilitada')} />}
                        label={f.habilitada ? 'Activa' : 'Pausada (no se ejecuta)'}
                    />
                </Box>

                <Divider />
                <Typography component="h3" sx={{ fontWeight: 650, fontSize: 15 }}>Frecuencia</Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                    <TextField select label="Cada cuánto" value={f.preset} onChange={set('preset')} fullWidth>
                        <MenuItem value="cada_x_minutos" sx={{ minHeight: 44 }}>Cada X minutos</MenuItem>
                        <MenuItem value="cada_hora_al_minuto" sx={{ minHeight: 44 }}>Cada hora, a un minuto</MenuItem>
                        <MenuItem value="diario_hora" sx={{ minHeight: 44 }}>Todos los días a una hora</MenuItem>
                        <MenuItem value="semanal_dow_hora" sx={{ minHeight: 44 }}>Una vez por semana</MenuItem>
                        <MenuItem value="mensual_dom_hora" sx={{ minHeight: 44 }}>Una vez por mes</MenuItem>
                        <MenuItem value="custom" sx={{ minHeight: 44 }}>Cron personalizado</MenuItem>
                    </TextField>

                    {f.preset === 'cada_x_minutos' && (
                        <TextField
                            type="number"
                            label="Cada (minutos)"
                            value={f.cadaMin}
                            onChange={set('cadaMin')}
                            fullWidth
                            error={cadaInvalido}
                            helperText={cadaInvalido ? 'Entre 1 y 59.' : undefined}
                            slotProps={{ htmlInput: { min: 1, max: 59, inputMode: 'numeric' } }}
                        />
                    )}
                    {['diario_hora', 'semanal_dow_hora', 'mensual_dom_hora'].includes(f.preset) && (
                        <TextField select label="Hora" value={f.hora} onChange={set('hora')} fullWidth>
                            {Array.from({ length: 24 }, (_, i) => dosDigitos(i)).map((h) => <MenuItem key={h} value={h} sx={{ minHeight: 44 }}>{h}</MenuItem>)}
                        </TextField>
                    )}
                    {['cada_hora_al_minuto', 'diario_hora', 'semanal_dow_hora', 'mensual_dom_hora'].includes(f.preset) && (
                        <TextField select label="Minuto" value={f.minuto} onChange={set('minuto')} fullWidth>
                            {Array.from({ length: 60 }, (_, i) => dosDigitos(i)).map((m) => <MenuItem key={m} value={m} sx={{ minHeight: 44 }}>{m}</MenuItem>)}
                        </TextField>
                    )}
                    {f.preset === 'semanal_dow_hora' && (
                        <TextField select label="Día de la semana" value={f.diaSemana} onChange={set('diaSemana')} fullWidth>
                            {[['1', 'Lunes'], ['2', 'Martes'], ['3', 'Miércoles'], ['4', 'Jueves'], ['5', 'Viernes'], ['6', 'Sábado'], ['0', 'Domingo']].map(([v, l]) => (
                                <MenuItem key={v} value={v} sx={{ minHeight: 44 }}>{l}</MenuItem>
                            ))}
                        </TextField>
                    )}
                    {f.preset === 'mensual_dom_hora' && (
                        <TextField select label="Día del mes" value={f.diaMes} onChange={set('diaMes')} fullWidth>
                            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => <MenuItem key={d} value={d} sx={{ minHeight: 44 }}>{d}</MenuItem>)}
                        </TextField>
                    )}
                </Box>

                {f.preset === 'custom' && (
                    <TextField
                        label="Expresión cron"
                        value={f.customCron}
                        onChange={set('customCron')}
                        helperText="Formato: minuto hora día-del-mes mes día-de-la-semana. Ej: 0 8 * * * es las 08:00 todos los días."
                        fullWidth
                        slotProps={{ htmlInput: { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } }}
                    />
                )}

                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5 }}>
                    <Typography variant="body2"><strong>Se ejecuta:</strong> {resumen}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                        Expresión cron: <code>{expresionCron}</code>
                    </Typography>
                </Box>

                <Divider />
                <Typography component="h3" sx={{ fontWeight: 650, fontSize: 15 }}>Destino y contenido</Typography>

                <Autocomplete
                    multiple
                    freeSolo
                    autoSelect
                    options={[]}
                    value={f.destinatarios}
                    onChange={(_, vals) => setF((p) => ({ ...p, destinatarios: vals.map((v) => String(v).trim()).filter(Boolean) }))}
                    renderTags={(value, getTagProps) =>
                        value.map((option, index) => {
                            const { key, ...props } = getTagProps({ index });
                            return <Chip key={key} variant="outlined" color={EMAIL_RE.test(option) ? 'default' : 'error'} label={option} {...props} />;
                        })
                    }
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Destinatarios (emails)"
                            placeholder="Escribí un email y tocá Enter"
                            error={invalidos.length > 0}
                            helperText={invalidos.length > 0 ? `No son emails válidos: ${invalidos.join(', ')}` : 'Reciben el reporte en cada ejecución.'}
                        />
                    )}
                />

                <TextField
                    label="Asunto"
                    value={f.asuntoTpl}
                    onChange={set('asuntoTpl')}
                    helperText="Podés usar variables como ${DATE}."
                    fullWidth
                />

                <HtmlTemplateEditor
                    value={f.htmlTpl}
                    onChange={(html) => setF((p) => (p.htmlTpl === html ? p : { ...p, htmlTpl: html }))}
                    variables={[{ label: 'Fecha', token: '${DATE}' }]}
                />

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, columnGap: 3 }}>
                    <FormControlLabel sx={{ minHeight: 44, mx: 0 }} control={<Switch checked={f.repRebotes} onChange={set('repRebotes')} />} label="Incluir reporte de rebotes" />
                    <FormControlLabel sx={{ minHeight: 44, mx: 0 }} control={<Switch checked={f.repAcciones} onChange={set('repAcciones')} />} label="Incluir reporte de acciones" />
                </Box>
            </Stack>
        </ResponsiveDialog>
    );
}

function HistorialDialog({ tarea, onClose, loading, error, ejecuciones, onReintentar }) {
    const columns = [
        { key: 'inicioEn', label: 'Inicio', primary: true, render: (e) => fecha(e.inicioEn) },
        {
            key: 'estado',
            label: 'Estado',
            render: (e) => {
                const s = ESTADO_EJECUCION[e.estado] ?? { label: e.estado, tono: 'neutro' };
                return <StatusChip label={s.label} tono={s.tono} />;
            },
        },
        { key: 'finEn', label: 'Fin', render: (e) => fecha(e.finEn) },
        {
            key: 'mensaje',
            label: 'Resultado',
            render: (e) => (e.error != null ? String(e.error).substring(0, 200) : 'Se ejecutó sin errores.'),
        },
    ];
    return (
        <ResponsiveDialog
            open={!!tarea}
            onClose={onClose}
            cerrarConFondo
            maxWidth="lg"
            title={`Historial${tarea ? `: ${tarea.nombre}` : ''}`}
            contentSx={{ p: 0 }}
            actions={<Button onClick={onClose}>Cerrar</Button>}
        >
            {error ? (
                <Box sx={{ p: 2 }}><BloqueEstado estado="error" mensaje={error} onReintentar={onReintentar} /></Box>
            ) : (
                <DataTableResponsive
                    ariaLabel="Ejecuciones de la tarea"
                    columns={columns}
                    rows={ejecuciones}
                    rowKey={(e) => e.id}
                    loading={loading}
                    empty={<EmptyState compact icon={History} title="Todavía no se ejecutó" description="Cuando la tarea corra, cada ejecución queda registrada acá." />}
                />
            )}
        </ResponsiveDialog>
    );
}

export default function TareasProgramadas() {
    const feedback = useFeedback();
    const [estado, setEstado] = useState('cargando');
    const [rows, setRows] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRpp] = useState(10);
    const [dialog, setDialog] = useState(null); // { tarea } (tarea null = nueva)
    const [errorGuardar, setErrorGuardar] = useState('');
    const [saving, setSaving] = useState(false);
    const [hist, setHist] = useState(null); // { tarea, loading, error, rows }
    const [porEliminar, setPorEliminar] = useState(null);
    const [porEjecutar, setPorEjecutar] = useState(null);
    const [trabajando, setTrabajando] = useState(false);

    const paginated = useMemo(() => rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [rows, page, rowsPerPage]);

    const fetchAll = useCallback(async () => {
        setEstado((e) => (e === 'listo' ? e : 'cargando'));
        try {
            const { data } = await api.get('/tareas-programadas');
            setRows(Array.isArray(data) ? data : []);
            setEstado('listo');
        } catch {
            setEstado('error');
        }
    }, []);
    useEffect(() => { fetchAll(); }, [fetchAll]);

    const submitDialog = async (payload) => {
        setSaving(true);
        setErrorGuardar('');
        try {
            const body = sanitizeCreateOrUpdate(payload);
            if (payload.id) {
                await api.put(`/tareas-programadas/${payload.id}`, body);
                feedback.exito('Tarea actualizada.');
            } else {
                await api.post('/tareas-programadas', body);
                feedback.exito('Tarea creada.');
            }
            setDialog(null);
            await fetchAll();
        } catch (e) {
            setErrorGuardar(mensajeDeError(e, 'No se pudo guardar la tarea.'));
        } finally {
            setSaving(false);
        }
    };

    const toggleActiva = async (row) => {
        const estaba = row.habilitada ?? row.activa;
        try {
            await api.post(`/tareas-programadas/${row.id}/alternar`, {});
            feedback.exito(estaba ? 'Tarea pausada: no se va a ejecutar hasta que la actives.' : 'Tarea activada.');
            await fetchAll();
        } catch (e) {
            feedback.error(mensajeDeError(e, 'No se pudo cambiar el estado de la tarea.'));
        }
    };

    const ejecutarAhora = async () => {
        setTrabajando(true);
        try {
            await api.post(`/tareas-programadas/${porEjecutar.id}/ejecutar-ahora`, {});
            feedback.exito('Se mandó a ejecutar. El resultado queda en el historial.');
            setPorEjecutar(null);
            await fetchAll();
        } catch (e) {
            feedback.error(mensajeDeError(e, 'No se pudo ejecutar la tarea.'));
            setPorEjecutar(null);
        } finally {
            setTrabajando(false);
        }
    };

    const remove = async () => {
        setTrabajando(true);
        try {
            await api.delete(`/tareas-programadas/${porEliminar.id}`);
            feedback.exito('Tarea eliminada.');
            setPorEliminar(null);
            await fetchAll();
        } catch (e) {
            feedback.error(mensajeDeError(e, 'No se pudo eliminar la tarea.'));
            setPorEliminar(null);
        } finally {
            setTrabajando(false);
        }
    };

    const cargarHistorial = useCallback(async (tarea) => {
        setHist({ tarea, loading: true, error: '', rows: [] });
        try {
            const { data } = await api.get(`/tareas-programadas/${tarea.id}/ejecuciones`);
            setHist({ tarea, loading: false, error: '', rows: Array.isArray(data) ? data : [] });
        } catch (e) {
            setHist({ tarea, loading: false, error: mensajeDeError(e, 'No se pudo cargar el historial.'), rows: [] });
        }
    }, []);

    const columns = [
        {
            key: 'nombre',
            label: 'Tarea',
            primary: true,
            render: (r) => (
                <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ fontWeight: 600 }}>{r.nombre}</Box>
                    {descripcionDe(r) && <Box sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 400 }}>{descripcionDe(r)}</Box>}
                </Box>
            ),
        },
        { key: 'tipo', label: 'Tipo', secondary: true, render: (r) => nombreTipo(r.tipo) },
        {
            key: 'habilitada',
            label: 'Estado',
            render: (r) => {
                const activa = r.habilitada ?? r.activa;
                return <StatusChip label={activa ? 'Activa' : 'Pausada'} tono={activa ? 'ok' : 'neutro'} vivo={!!activa} />;
            },
        },
        {
            key: 'cron',
            label: 'Se ejecuta',
            render: (r) => {
                const cron = r.expresionCron || r.cron;
                const p = inferirPreset(cron);
                return (
                    <Box>
                        <Box>{describePreset(p.preset, p)}</Box>
                        <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
                            <code>{cron}</code> · {r.zonaHoraria || r.tz || TZ_DEFAULT}
                        </Box>
                    </Box>
                );
            },
        },
        { key: 'proximoRun', label: 'Próxima ejecución', hideBelow: 'lg', render: (r) => ((r.habilitada ?? r.activa) ? fecha(r.proximoRun) : 'Pausada') },
        { key: 'ultimoRun', label: 'Última ejecución', hideBelow: 'lg', render: (r) => fecha(r.ultimoRun) },
    ];

    return (
        <PageContainer>
            <PageHeader
                title="Tareas programadas"
                subtitle="Reportes que se envían solos por email, en el horario que elijas."
                breadcrumbs={migasDe('/config/tareas-programadas')}
                actions={
                    <>
                        <Button variant="outlined" startIcon={<RefreshCw size={18} strokeWidth={1.75} aria-hidden />} onClick={fetchAll}>
                            Actualizar
                        </Button>
                        <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={() => { setErrorGuardar(''); setDialog({ tarea: null }); }}>
                            Nueva tarea
                        </Button>
                    </>
                }
            />

            {estado === 'error' ? (
                <BloqueEstado estado="error" mensaje="No se pudieron cargar las tareas." onReintentar={fetchAll} />
            ) : (
                <SectionCard noPadding>
                    <DataTableResponsive
                        ariaLabel="Tareas programadas"
                        columns={columns}
                        rows={paginated}
                        rowKey={(r) => r.id}
                        loading={estado === 'cargando'}
                        acciones={(row) => {
                            const activa = row.habilitada ?? row.activa;
                            return (
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                    <Button startIcon={<Pencil size={16} strokeWidth={1.75} aria-hidden />} onClick={() => { setErrorGuardar(''); setDialog({ tarea: row }); }}>
                                        Editar
                                    </Button>
                                    <MenuMas
                                        items={[
                                            { label: 'Ejecutar ahora', icon: Zap, onClick: () => setPorEjecutar(row) },
                                            { label: activa ? 'Pausar' : 'Activar', icon: activa ? Pause : Play, onClick: () => toggleActiva(row) },
                                            { label: 'Ver historial', icon: History, onClick: () => cargarHistorial(row) },
                                            { label: 'Eliminar', icon: Trash2, peligro: true, onClick: () => setPorEliminar(row) },
                                        ]}
                                    />
                                </Box>
                            );
                        }}
                        empty={
                            <EmptyState
                                icon={Timer}
                                title="Todavía no hay tareas"
                                description="Creá una tarea para que un reporte llegue por email todos los días, sin que nadie se acuerde."
                                action={{ label: 'Nueva tarea', onClick: () => { setErrorGuardar(''); setDialog({ tarea: null }); } }}
                            />
                        }
                    />
                    {estado === 'listo' && rows.length > 0 && (
                        <TablePagination
                            component="div"
                            count={rows.length}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(e) => { setRpp(parseInt(e.target.value, 10)); setPage(0); }}
                            rowsPerPageOptions={[5, 10, 25]}
                            labelRowsPerPage="Filas:"
                            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                        />
                    )}
                </SectionCard>
            )}

            {dialog && (
                <TareaDialog
                    open
                    initial={dialog.tarea}
                    onClose={() => setDialog(null)}
                    onSubmit={submitDialog}
                    guardando={saving}
                    error={errorGuardar}
                />
            )}

            <HistorialDialog
                tarea={hist?.tarea}
                loading={!!hist?.loading}
                error={hist?.error}
                ejecuciones={hist?.rows ?? []}
                onClose={() => setHist(null)}
                onReintentar={() => hist && cargarHistorial(hist.tarea)}
            />

            <ConfirmDialog
                open={!!porEjecutar}
                titulo="¿Ejecutar la tarea ahora?"
                mensaje={`Se genera y se envía "${porEjecutar?.nombre ?? ''}" ahora mismo a ${Array.isArray(porEjecutar?.destinatarios) ? porEjecutar.destinatarios.length : 0} destinatario(s), sin esperar al horario. La programación sigue igual.`}
                confirmarTexto="Ejecutar ahora"
                cargando={trabajando}
                onConfirmar={ejecutarAhora}
                onCancelar={() => setPorEjecutar(null)}
            />
            <ConfirmDialog
                open={!!porEliminar}
                titulo="¿Eliminar la tarea?"
                mensaje={`Se elimina "${porEliminar?.nombre ?? ''}" y deja de ejecutarse. Los reportes que ya se enviaron no se tocan. No se puede deshacer.`}
                confirmarTexto="Eliminar"
                peligro
                cargando={trabajando}
                onConfirmar={remove}
                onCancelar={() => setPorEliminar(null)}
            />
        </PageContainer>
    );
}
