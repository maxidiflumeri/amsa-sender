import { useEffect, useMemo, useState } from 'react';
import {
    Box, Paper, Typography, Button, IconButton, Chip, Table, TableHead, TableRow, TableCell, TableBody,
    TablePagination, Tooltip, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
    FormControlLabel, Switch, Stack, CircularProgress, LinearProgress, Snackbar, Alert, Autocomplete
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import dayjs from 'dayjs';
import api from '../api/axios';
import HtmlTemplateEditor from './utils/HTMLTemplateEditor';

const TZ_DEFAULT = 'America/Argentina/Buenos_Aires';
const TIPOS = [
    { value: 'REPORTE_EMAIL_DIARIO', label: 'Reporte Email Diario' },
    { value: 'REPORTE_EMAIL_SEMANAL', label: 'Reporte Email Semanal' },
    { value: 'REPORTE_WHATSAPP_DIARIO', label: 'Reporte WhatsApp Diario' },
    // agrega los que maneje tu backend
];

function humanEstado(activa) { return activa ? 'activa' : 'pausada'; }
function chipEstado(activa) {
    return <Chip size="small" label={activa ? 'Activa' : 'Pausada'} color={activa ? 'success' : 'default'} variant={activa ? 'filled' : 'outlined'} />;
}

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
function describePreset(preset, p) {
    const { cadaMin, hora, minuto, diaSemana, diaMes, customCron } = p;
    const dowMap = { '0': 'Dom', '1': 'Lun', '2': 'Mar', '3': 'Mié', '4': 'Jue', '5': 'Vie', '6': 'Sáb' };
    switch (preset) {
        case 'cada_x_minutos': return `Cada ${cadaMin} min`;
        case 'cada_hora_al_minuto': return `Cada hora al minuto ${minuto}`;
        case 'diario_hora': return `Diario ${hora.padStart(2, '0')}:${minuto.padStart(2, '0')}`;
        case 'semanal_dow_hora': return `Semanal (${dowMap[diaSemana] || diaSemana}) ${hora.padStart(2, '0')}:${minuto.padStart(2, '0')}`;
        case 'mensual_dom_hora': return `Mensual (día ${diaMes}) ${hora.padStart(2, '0')}:${minuto.padStart(2, '0')}`;
        case 'custom': return `Cron: ${customCron}`;
        default: return '';
    }
}

function sanitizeCreateOrUpdate(raw) {
    return {
        nombre: String(raw.nombre || '').trim(),
        tipo: raw.tipo,
        expresionCron: raw.expresionCron,          // cron final
        zonaHoraria: raw.zonaHoraria,              // ej: "America/Argentina/Buenos_Aires"
        habilitada: Boolean(raw.habilitada),
        destinatarios: Array.isArray(raw.destinatarios) ? raw.destinatarios : [],
        configuracion: {
            reportes: {
                rebotes: !!raw?.configuracion?.reportes?.rebotes,
                acciones: !!raw?.configuracion?.reportes?.acciones,
            },
            asuntoTpl: raw?.configuracion?.asuntoTpl ?? '',
            htmlTpl: raw?.configuracion?.htmlTpl ?? '',
        },
    };
}

// --- Dialogo Crear/Editar con configuracion y destinatarios
function TareaDialog({ open, onClose, onSubmit, initial }) {
    const isEdit = Boolean(initial?.id);
    // Campos base
    const [nombre, setNombre] = useState(initial?.nombre || '');
    const [descripcion, setDescripcion] = useState(initial?.descripcion || '');
    const [tipo, setTipo] = useState(initial?.tipo || 'REPORTE_EMAIL_DIARIO');
    const [tz, setTz] = useState(initial?.zonaHoraria || initial?.tz || TZ_DEFAULT);
    const [habilitada, setHabilitada] = useState(initial?.habilitada ?? initial?.activa ?? true);

    // Presets cron
    const [preset, setPreset] = useState(initial?.preset || 'diario_hora');
    const [cadaMin, setCadaMin] = useState(initial?.cadaMin || 5);
    const [hora, setHora] = useState(initial?.hora || '08');
    const [minuto, setMinuto] = useState(initial?.minuto || '00');
    const [diaSemana, setDiaSemana] = useState(initial?.diaSemana || '1');
    const [diaMes, setDiaMes] = useState(initial?.diaMes || '1');
    const [customCron, setCustomCron] = useState(initial?.expresionCron || initial?.cron || '0 8 * * *');

    // Config específica
    const [destinatarios, setDestinatarios] = useState(initial?.destinatarios || []);
    const [asuntoTpl, setAsuntoTpl] = useState(initial?.configuracion?.asuntoTpl || '');
    const [htmlTpl, setHtmlTpl] = useState(initial?.configuracion?.htmlTpl || '');
    const [repRebotes, setRepRebotes] = useState(initial?.configuracion?.reportes?.rebotes ?? true);
    const [repAcciones, setRepAcciones] = useState(initial?.configuracion?.reportes?.acciones ?? true);

    useEffect(() => {
        if (open && initial) {
            setNombre(initial?.nombre || '');
            setDescripcion(initial?.descripcion || '');
            setTipo(initial?.tipo || 'REPORTE_EMAIL_DIARIO');
            setTz(initial?.zonaHoraria || initial?.tz || TZ_DEFAULT);
            setHabilitada(initial?.habilitada ?? initial?.activa ?? true);

            if (initial?.preset) {
                setPreset(initial.preset);
                setCadaMin(initial?.cadaMin || 5);
                setHora(initial?.hora || '08');
                setMinuto(initial?.minuto || '00');
                setDiaSemana(initial?.diaSemana || '1');
                setDiaMes(initial?.diaMes || '1');
                setCustomCron(initial?.expresionCron || initial?.cron || '0 8 * * *');
            } else {
                setPreset('custom');
                setCustomCron(initial?.expresionCron || initial?.cron || '0 8 * * *');
            }

            setDestinatarios(initial?.destinatarios || []);
            setAsuntoTpl(initial?.configuracion?.asuntoTpl || '');
            setHtmlTpl(initial?.configuracion?.htmlTpl || '');
            setRepRebotes(initial?.configuracion?.reportes?.rebotes ?? true);
            setRepAcciones(initial?.configuracion?.reportes?.acciones ?? true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const cronParams = { cadaMin, hora, minuto, diaSemana, diaMes, customCron };
    const expresionCron = useMemo(() => buildCronFromPreset(preset, cronParams), [preset, cadaMin, hora, minuto, diaSemana, diaMes, customCron]);
    const presetDesc = useMemo(() => describePreset(preset, cronParams), [preset, cadaMin, hora, minuto, diaSemana, diaMes, customCron]);

    const disabledSave = !nombre || !expresionCron || !tz || !tipo || destinatarios.length === 0;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{isEdit ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} fullWidth />
                        <TextField select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} fullWidth>
                            {TIPOS.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                        </TextField>
                    </Stack>

                    <TextField
                        label="Descripción (opcional)"
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        fullWidth multiline minRows={2}
                    />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField select label="Zona horaria" value={tz} onChange={(e) => setTz(e.target.value)} fullWidth>
                            <MenuItem value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</MenuItem>
                            <MenuItem value="UTC">UTC</MenuItem>
                        </TextField>
                        <FormControlLabel control={<Switch checked={habilitada} onChange={(e) => setHabilitada(e.target.checked)} />} label={habilitada ? 'Activa' : 'Pausada'} />
                    </Stack>

                    <Divider />

                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Frecuencia</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField select label="Preset" value={preset} onChange={(e) => setPreset(e.target.value)} fullWidth>
                            <MenuItem value="cada_x_minutos">Cada X minutos</MenuItem>
                            <MenuItem value="cada_hora_al_minuto">Cada hora al minuto</MenuItem>
                            <MenuItem value="diario_hora">Diario a una hora</MenuItem>
                            <MenuItem value="semanal_dow_hora">Semanal (día de semana + hora)</MenuItem>
                            <MenuItem value="mensual_dom_hora">Mensual (día del mes + hora)</MenuItem>
                            <MenuItem value="custom">Cron personalizado</MenuItem>
                        </TextField>

                        {preset === 'cada_x_minutos' && (
                            <TextField type="number" label="Cada (min)" value={cadaMin} onChange={(e) => setCadaMin(e.target.value)} fullWidth />
                        )}
                        {(preset === 'diario_hora' || preset === 'semanal_dow_hora' || preset === 'mensual_dom_hora') && (
                            <TextField select label="Hora" value={hora} onChange={(e) => setHora(e.target.value)} fullWidth>
                                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                            </TextField>
                        )}
                        {(preset === 'cada_hora_al_minuto' || preset === 'diario_hora' || preset === 'semanal_dow_hora' || preset === 'mensual_dom_hora') && (
                            <TextField select label="Minuto" value={minuto} onChange={(e) => setMinuto(e.target.value)} fullWidth>
                                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                            </TextField>
                        )}
                        {preset === 'semanal_dow_hora' && (
                            <TextField select label="Día de semana" value={diaSemana} onChange={(e) => setDiaSemana(e.target.value)} fullWidth>
                                <MenuItem value="1">Lunes</MenuItem><MenuItem value="2">Martes</MenuItem><MenuItem value="3">Miércoles</MenuItem>
                                <MenuItem value="4">Jueves</MenuItem><MenuItem value="5">Viernes</MenuItem><MenuItem value="6">Sábado</MenuItem><MenuItem value="0">Domingo</MenuItem>
                            </TextField>
                        )}
                        {preset === 'mensual_dom_hora' && (
                            <TextField select label="Día del mes" value={diaMes} onChange={(e) => setDiaMes(e.target.value)} fullWidth>
                                {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                            </TextField>
                        )}
                    </Stack>

                    {preset === 'custom' && (
                        <TextField
                            label="Expresión cron"
                            value={customCron}
                            onChange={(e) => setCustomCron(e.target.value)}
                            helperText="Formato: m h dom mon dow (ej: 0 8 * * * → 08:00 todos los días)"
                            fullWidth
                        />
                    )}

                    <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="body2"><strong>Resumen:</strong> {presetDesc}</Typography>
                        <Typography variant="caption">Cron resultante: <code>{expresionCron}</code></Typography>
                    </Box>

                    <Divider />

                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Destino y contenido</Typography>

                    <Autocomplete
                        multiple freeSolo
                        options={[]} // opcionalmente podés sugerir emails
                        value={destinatarios}
                        onChange={(_, vals) => setDestinatarios(vals)}
                        renderTags={(value, getTagProps) =>
                            value.map((option, index) => (<Chip variant="outlined" label={option} {...getTagProps({ index })} />))
                        }
                        renderInput={(params) => <TextField {...params} label="Destinatarios (emails)" placeholder="Agregar email y Enter" />}
                    />

                    <TextField
                        label="Asunto (asuntoTpl)"
                        value={asuntoTpl}
                        onChange={(e) => setAsuntoTpl(e.target.value)}
                        helperText="Podés usar variables como ${DATE}"
                        fullWidth
                    />

                    <HtmlTemplateEditor
                        value={htmlTpl}
                        onChange={setHtmlTpl}
                        variables={[
                            { label: 'Fecha', token: '${DATE}' },
                            // si mañana querés más: { label: 'Usuario', token: '${USER}' }, etc.
                        ]}
                    />

                    <Stack direction="row" spacing={2}>
                        <FormControlLabel control={<Switch checked={repRebotes} onChange={(e) => setRepRebotes(e.target.checked)} />} label="Incluir reportes de rebotes" />
                        <FormControlLabel control={<Switch checked={repAcciones} onChange={(e) => setRepAcciones(e.target.checked)} />} label="Incluir reportes de acciones" />
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button
                    onClick={() => onSubmit({
                        id: initial?.id,
                        // mapeo EXACTO al backend:
                        nombre,
                        tipo,
                        expresionCron,
                        zonaHoraria: tz,
                        habilitada,
                        destinatarios,
                        configuracion: {
                            reportes: { rebotes: repRebotes, acciones: repAcciones },
                            asuntoTpl,
                            htmlTpl,
                        },
                        // metadatos para re-editar amigable (opcional persistirlos):
                        descripcion,
                        preset, cadaMin, hora, minuto, diaSemana, diaMes,
                    })}
                    variant="contained"
                    disabled={disabledSave}
                >
                    {isEdit ? 'Guardar' : 'Crear'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

function HistorialDialog({ open, onClose, loading, ejecuciones }) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
            <DialogTitle>Historial de ejecuciones</DialogTitle>
            <DialogContent dividers>
                {loading && <LinearProgress sx={{ mb: 2 }} />}
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Fecha Inicio</TableCell>
                            <TableCell>Fecha Fin</TableCell>
                            <TableCell>Estado</TableCell>
                            <TableCell>Mensaje</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {ejecuciones?.length ? ejecuciones.map((e) => (
                            <TableRow key={e.id}>
                                <TableCell>{e.inicioEn != null ? `${new Date(e.inicioEn).toLocaleString()}` : '-'}</TableCell>
                                <TableCell>{e.finEn != null ? `${new Date(e.finEn).toLocaleString()}` : '-'}</TableCell>
                                <TableCell><Chip size="small" label={e.estado} color={e.estado === 'completed' ? 'success' : e.estado === 'failed' ? 'error' : 'default'} /></TableCell>
                                <TableCell>{e.error != null ? `${e.error.substring(0, 200)}` : 'Procesado Exitosamente.'}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={4} align="center">Sin ejecuciones registradas.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </DialogContent>
            <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
        </Dialog>
    );
}

export default function TareasProgramadas() {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRpp] = useState(10);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [histOpen, setHistOpen] = useState(false);
    const [histLoading, setHistLoading] = useState(false);
    const [histRows, setHistRows] = useState([]);
    const [saving, setSaving] = useState(false);
    const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });

    const paginated = useMemo(() => rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [rows, page, rowsPerPage]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/tareas-programadas');
            setRows(data || []);
        } catch {
            setSnack({ open: true, msg: 'Error cargando tareas', sev: 'error' });
        } finally { setLoading(false); }
    };
    useEffect(() => { fetchAll(); }, []);

    const handleCreate = () => { setEditing(null); setDialogOpen(true); };
    const handleEdit = (row) => { setEditing(row); setDialogOpen(true); };

    const submitDialog = async (payload) => {
        setSaving(true);
        try {
            const body = sanitizeCreateOrUpdate(payload); // <<< quita descripcion/preset/cadaMin/hora/minuto/diaSemana/diaMes

            if (payload.id) {
                // UPDATE: id por URL; body solo con campos permitidos
                await api.put(`/tareas-programadas/${payload.id}`, body);
                setSnack({ open: true, msg: 'Tarea actualizada', sev: 'success' });
            } else {
                // CREATE: solo campos permitidos
                await api.post('/tareas-programadas', body);
                setSnack({ open: true, msg: 'Tarea creada', sev: 'success' });
            }

            setDialogOpen(false);
            await fetchAll();
        } catch (e) {
            setSnack({ open: true, msg: 'Error guardando tarea', sev: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const toggleActiva = async (row) => {
        try {
            await api.post(`/tareas-programadas/${row.id}/alternar`, {});
            setSnack({ open: true, msg: row.habilitada ? 'Tarea pausada' : 'Tarea reanudada', sev: 'success' });
            await fetchAll();
        } catch {
            setSnack({ open: true, msg: 'Error al alternar estado', sev: 'error' });
        }
    };

    const runNow = async (row) => {
        try {
            await api.post(`/tareas-programadas/${row.id}/ejecutar-ahora`, {});
            setSnack({ open: true, msg: 'Ejecución forzada disparada', sev: 'success' });
        } catch {
            setSnack({ open: true, msg: 'Error al ejecutar ahora', sev: 'error' });
        }
    };

    const remove = async (row) => {
        if (!confirm(`¿Eliminar la tarea "${row.nombre}"?`)) return;
        try {
            await api.delete(`/tareas-programadas/${row.id}`);
            setSnack({ open: true, msg: 'Tarea eliminada', sev: 'success' });
            await fetchAll();
        } catch {
            setSnack({ open: true, msg: 'Error al eliminar tarea', sev: 'error' });
        }
    };

    const openHistorial = async (row) => {
        setHistOpen(true); setHistRows([]); setHistLoading(true);
        try {
            const { data } = await api.get(`/tareas-programadas/${row.id}/ejecuciones`);
            setHistRows(data || []);
        } catch {
            setSnack({ open: true, msg: 'Error cargando historial', sev: 'error' });
        } finally { setHistLoading(false); }
    };

    return (
        <Paper sx={{ p: 2, mt: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Tareas programadas</Typography>
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Refrescar"><IconButton onClick={fetchAll}><RefreshIcon /></IconButton></Tooltip>
                    <Button sx={{
                        borderRadius: 2,
                        fontFamily: commonFont,
                        textTransform: 'none',
                        fontSize: '0.9rem',
                        backgroundColor: '#075E54',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            backgroundColor: '#0b7b65',
                            transform: 'scale(1.03)',
                            boxShadow: 4,
                        },
                    }} startIcon={<AddIcon />} variant="contained" onClick={handleCreate}>Nueva tarea</Button>
                </Stack>
            </Stack>

            {loading && <LinearProgress sx={{ mb: 1 }} />}

            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Nombre</TableCell>
                        <TableCell>Tipo</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell>Cron</TableCell>
                        <TableCell>TZ</TableCell>
                        <TableCell>Próximo run</TableCell>
                        <TableCell>Último run</TableCell>
                        <TableCell align="right">Acciones</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {paginated.map((row) => (
                        <TableRow key={row.id} hover>
                            <TableCell>
                                <Stack spacing={0.2}>
                                    <Typography fontWeight={600}>{row.nombre}</Typography>
                                    {row.descripcion && <Typography variant="caption" color="text.secondary">{row.descripcion}</Typography>}
                                </Stack>
                            </TableCell>
                            <TableCell>{row.tipo}</TableCell>
                            <TableCell>{chipEstado(row.habilitada ?? row.activa)}</TableCell>
                            <TableCell><code>{row.expresionCron || row.cron}</code></TableCell>
                            <TableCell>{row.zonaHoraria || row.tz || TZ_DEFAULT}</TableCell>
                            <TableCell>{row.proximoRun ? dayjs(row.proximoRun).format('YYYY-MM-DD HH:mm') : '-'}</TableCell>
                            <TableCell>{row.ultimoRun ? dayjs(row.ultimoRun).format('YYYY-MM-DD HH:mm') : '-'}</TableCell>
                            <TableCell align="right">
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                    <Tooltip title="Editar"><span><IconButton onClick={() => handleEdit(row)}><EditIcon /></IconButton></span></Tooltip>
                                    <Tooltip title={(row.habilitada ?? row.activa) ? 'Pausar' : 'Reanudar'}>
                                        <span><IconButton onClick={() => toggleActiva(row)}>{(row.habilitada ?? row.activa) ? <PauseIcon /> : <PlayArrowIcon />}</IconButton></span>
                                    </Tooltip>
                                    <Tooltip title="Ejecutar ahora"><span><IconButton onClick={() => runNow(row)}><PlayCircleFilledWhiteIcon /></IconButton></span></Tooltip>
                                    <Tooltip title="Historial"><span><IconButton onClick={() => openHistorial(row)}><HistoryIcon /></IconButton></span></Tooltip>
                                    <Tooltip title="Eliminar"><span><IconButton onClick={() => remove(row)} color="error"><DeleteIcon /></IconButton></span></Tooltip>
                                </Stack>
                            </TableCell>
                        </TableRow>
                    ))}

                    {!loading && paginated.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                                <Stack alignItems="center" spacing={1}>
                                    <HistoryIcon fontSize="large" />
                                    <Typography>No hay tareas todavía</Typography>
                                    <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Crear la primera tarea</Button>
                                </Stack>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            <TablePagination
                component="div"
                count={rows.length}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRpp(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[5, 10, 25]}
            />

            <TareaDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={submitDialog} initial={editing} />
            <HistorialDialog open={histOpen} onClose={() => setHistOpen(false)} loading={histLoading} ejecuciones={histRows} />

            {saving && (
                <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                    <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <CircularProgress size={24} /><Typography>Guardando…</Typography>
                    </Paper>
                </Box>
            )}

            <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))}>
                <Alert severity={snack.sev} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
            </Snackbar>
        </Paper>
    );
}