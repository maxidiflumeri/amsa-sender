import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, ListItemText, MenuItem, TextField,
    Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { ChevronDown } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { mensajeDeError, useFeedback } from '../context/FeedbackContext';
import { useEventoSocket } from '../context/SocketContext';
import { BloqueEstado, ConfirmDialog, ResponsiveDialog, StatusChip } from './ui';
import { pluralizar } from './campanias/waweb/formatos';

// Enviar o agendar una campaña de WhatsApp Web: plantilla, sesiones que van a enviar, ritmo y, si se agenda, la
// fecha. Antes de mandar se muestra el resumen y se pide confirmar.

// El backend guarda el ritmo en milisegundos; la pantalla lo muestra en segundos, que es como lo piensa quien envía.
const RITMO_POR_DEFECTO = { batchSize: 5, delayEntreMensajes: 25_000, delayEntreLotes: 60_000 };

const aSegundos = (ms) => String(Number(ms) / 1000);

function ritmoAFormulario(ritmo) {
    return {
        batchSize: String(ritmo.batchSize),
        delayEntreMensajes: aSegundos(ritmo.delayEntreMensajes),
        delayEntreLotes: aSegundos(ritmo.delayEntreLotes),
    };
}

function Resumen({ filas }) {
    return (
        <Box
            component="dl"
            sx={{ m: 0, p: 2, border: 1, borderColor: 'divider', borderRadius: '14px', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '120px 1fr' }, columnGap: 2, rowGap: { xs: 0, sm: 1 } }}
        >
            {filas.map(([titulo, valor]) => (
                <Box key={titulo} sx={{ display: 'contents' }}>
                    <Box component="dt" sx={{ fontSize: 13, color: 'text.secondary', mt: { xs: 1, sm: 0 } }}>{titulo}</Box>
                    <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere', fontWeight: valor === '—' ? 400 : 600 }}>{valor}</Box>
                </Box>
            ))}
        </Box>
    );
}

export default function EnviarMensajesModal({ open, onSendSuccess, onClose, campaña, mostrarCalendario = false }) {
    const feedback = useFeedback();
    const { usuario } = useAuth();
    const [sesiones, setSesiones] = useState([]);
    const [seleccionadas, setSeleccionadas] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [templateId, setTemplateId] = useState('');
    const [cargando, setCargando] = useState(false);
    const [errorCarga, setErrorCarga] = useState(false);
    const [formRitmo, setFormRitmo] = useState(ritmoAFormulario(RITMO_POR_DEFECTO));
    const [fechaAgendada, setFechaAgendada] = useState(null);
    const [guardandoRitmo, setGuardandoRitmo] = useState(false);
    const [confirmando, setConfirmando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [reintento, setReintento] = useState(0);

    const total = campaña?.contactosCount ?? campaña?.contactos?.length ?? 0;

    const cargarSesiones = useCallback(async () => {
        const res = await api.get('/whatsapp/sesiones/status');
        setSesiones(res.data);
        // Una sesión que se cayó deja de estar elegida.
        setSeleccionadas((actual) => actual.filter((id) => res.data.some((s) => s.id === id && s.estado === 'conectado')));
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        setSeleccionadas([]);
        setTemplateId('');
        setFechaAgendada(null);
        setConfirmando(false);
        setFormRitmo(ritmoAFormulario(RITMO_POR_DEFECTO));
        let cancelado = false;
        setCargando(true);
        setErrorCarga(false);
        Promise.all([cargarSesiones(), api.get('/whatsapp/templates').then((res) => !cancelado && setTemplates(res.data))])
            .catch(() => !cancelado && setErrorCarga(true))
            .finally(() => !cancelado && setCargando(false));
        // El ritmo guardado es opcional: si no se puede leer, se usa el de siempre.
        api.get('/config', { params: { scope: 'whatsapp.envio' } })
            .then((res) => {
                if (cancelado) return;
                const guardado = res.data ?? {};
                setFormRitmo(ritmoAFormulario({
                    batchSize: Number(guardado.batchSize ?? RITMO_POR_DEFECTO.batchSize),
                    delayEntreMensajes: Number(guardado.delayEntreMensajes ?? RITMO_POR_DEFECTO.delayEntreMensajes),
                    delayEntreLotes: Number(guardado.delayEntreLotes ?? RITMO_POR_DEFECTO.delayEntreLotes),
                }));
            })
            .catch(() => undefined);
        return () => {
            cancelado = true;
        };
    }, [open, reintento, cargarSesiones]);

    // Si una sesión se conecta o se cae con el diálogo abierto, la lista se actualiza.
    useEventoSocket('estado_sesion', ({ estado }) => {
        if (open && estado !== 'qr') cargarSesiones().catch(() => undefined);
    });

    const ritmo = useMemo(() => {
        const lote = Number(formRitmo.batchSize);
        const entreMensajes = Number(formRitmo.delayEntreMensajes);
        const entreLotes = Number(formRitmo.delayEntreLotes);
        const valido = Number.isInteger(lote) && lote >= 1 && entreMensajes >= 0 && entreLotes >= 0
            && formRitmo.delayEntreMensajes !== '' && formRitmo.delayEntreLotes !== '';
        return { valido, config: { batchSize: lote, delayEntreMensajes: Math.round(entreMensajes * 1000), delayEntreLotes: Math.round(entreLotes * 1000) } };
    }, [formRitmo]);

    const template = templates.find((t) => t.id === templateId);
    const conectadas = sesiones.filter((s) => s.estado === 'conectado');
    const elegidas = sesiones.filter((s) => seleccionadas.includes(s.id));
    const fechaValida = fechaAgendada instanceof Date && !Number.isNaN(fechaAgendada.getTime()) && fechaAgendada > new Date();
    const fechaConError = mostrarCalendario && !!fechaAgendada && !fechaValida;
    const listo = !!template && elegidas.length > 0 && ritmo.valido && (!mostrarCalendario || fechaValida);

    const textoSesiones = elegidas.map((s) => s.ani || s.id).join(', ');
    const cuando = !mostrarCalendario
        ? 'Apenas confirmes'
        : fechaValida ? fechaAgendada.toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' }) : '—';

    const enviar = async () => {
        setEnviando(true);
        try {
            await api.post(`/whatsapp/campanias/${campaña.id}/aplicar-template`, { templateId });
            if (mostrarCalendario) {
                await api.post(`/whatsapp/campanias/${campaña.id}/agendar`, {
                    sessionIds: seleccionadas,
                    fechaAgenda: fechaAgendada,
                    config: ritmo.config,
                });
            } else {
                await api.post('/whatsapp/mensajes/send-messages', {
                    sessionIds: seleccionadas,
                    campaña: campaña.id,
                    config: ritmo.config,
                });
            }
            setConfirmando(false);
            onSendSuccess();
        } catch (error) {
            feedback.error(mensajeDeError(error, 'No se pudo iniciar el envío.'));
        } finally {
            setEnviando(false);
        }
    };

    const guardarRitmo = async () => {
        setGuardandoRitmo(true);
        try {
            await api.post('/config', { userId: usuario?.id, scope: 'whatsapp.envio', valores: ritmo.config });
            feedback.exito('Ritmo guardado como predeterminado.');
        } catch (error) {
            feedback.error(mensajeDeError(error, 'No se pudo guardar el ritmo.'));
        } finally {
            setGuardandoRitmo(false);
        }
    };

    const campoRitmo = (clave, label, ayuda, { entero = false } = {}) => (
        <TextField
            label={label}
            type="number"
            fullWidth
            value={formRitmo[clave]}
            onChange={(e) => setFormRitmo((prev) => ({ ...prev, [clave]: e.target.value }))}
            helperText={ayuda}
            slotProps={{ htmlInput: { min: entero ? 1 : 0, step: entero ? 1 : 'any', inputMode: entero ? 'numeric' : 'decimal' } }}
            error={formRitmo[clave] === '' || Number(formRitmo[clave]) < (entero ? 1 : 0)}
        />
    );

    return (
        <>
            <ResponsiveDialog
                open={open}
                onClose={() => !enviando && onClose()}
                title={`${mostrarCalendario ? 'Agendar' : 'Enviar'} «${campaña?.nombre}»`}
                sucio={!!templateId || seleccionadas.length > 0 || !!fechaAgendada}
                actions={(
                    <>
                        <Button onClick={onClose} disabled={enviando}>Cancelar</Button>
                        <Button variant="contained" disabled={!listo || enviando} onClick={() => setConfirmando(true)}>
                            {mostrarCalendario ? 'Agendar campaña' : 'Enviar campaña'}
                        </Button>
                    </>
                )}
            >
                {cargando && <BloqueEstado estado="cargando" mensaje="Cargando sesiones y plantillas…" />}
                {errorCarga && <BloqueEstado estado="error" mensaje="No se pudieron cargar las sesiones o las plantillas." onReintentar={() => setReintento((n) => n + 1)} />}
                {!cargando && !errorCarga && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                        <Autocomplete
                            fullWidth
                            options={templates}
                            getOptionLabel={(t) => t.nombre}
                            isOptionEqualToValue={(a, b) => a.id === b.id}
                            value={template ?? null}
                            onChange={(_, nuevo) => setTemplateId(nuevo ? nuevo.id : '')}
                            noOptionsText="No hay plantillas de WhatsApp Web"
                            renderInput={(params) => <TextField {...params} label="Plantilla" helperText="El texto del mensaje que se va a enviar." />}
                        />

                        <Box>
                            <TextField
                                select
                                fullWidth
                                label="Sesiones"
                                value={seleccionadas}
                                onChange={(e) => setSeleccionadas(e.target.value)}
                                error={conectadas.length === 0}
                                helperText={conectadas.length === 0
                                    ? 'No hay ninguna sesión conectada. Conectá una desde Envíos › WhatsApp Web › Sesiones.'
                                    : 'Los mensajes se reparten entre las sesiones que elijas.'}
                                slotProps={{
                                    select: {
                                        multiple: true,
                                        renderValue: (ids) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {ids.map((id) => <Chip key={id} size="small" label={sesiones.find((s) => s.id === id)?.ani || id} />)}
                                            </Box>
                                        ),
                                    },
                                }}
                            >
                                {sesiones.map((s) => (
                                    <MenuItem key={s.id} value={s.id} disabled={s.estado !== 'conectado'} sx={{ minHeight: 44, gap: 1 }}>
                                        <Checkbox checked={seleccionadas.includes(s.id)} tabIndex={-1} disableRipple sx={{ p: 0.5 }} />
                                        <ListItemText primary={s.ani || 'Sin número todavía'} />
                                        <StatusChip label={s.estado === 'conectado' ? 'Conectada' : 'No disponible'} tono={s.estado === 'conectado' ? 'ok' : 'neutro'} />
                                    </MenuItem>
                                ))}
                            </TextField>
                            {conectadas.length > 1 && seleccionadas.length < conectadas.length && (
                                <Button size="small" onClick={() => setSeleccionadas(conectadas.map((s) => s.id))} sx={{ mt: 0.5, minHeight: { xs: 44, sm: 30 } }}>
                                    Elegir todas las conectadas
                                </Button>
                            )}
                        </Box>

                        {mostrarCalendario && (
                            <DateTimePicker
                                label="Fecha y hora del envío"
                                value={fechaAgendada}
                                onChange={setFechaAgendada}
                                minDateTime={new Date()}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        error: fechaConError,
                                        helperText: fechaConError ? 'Elegí una fecha y hora que todavía no pasaron.' : undefined,
                                    },
                                }}
                            />
                        )}

                        <Accordion disableGutters variant="outlined" sx={{ borderRadius: '14px', '&::before': { display: 'none' }, overflow: 'hidden' }}>
                            <AccordionSummary expandIcon={<ChevronDown size={20} strokeWidth={1.75} aria-hidden />} sx={{ minHeight: 48 }}>
                                <Typography sx={{ fontWeight: 600 }}>Ritmo de envío</Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {campoRitmo('batchSize', 'Mensajes por lote', 'Cuántos contactos toma cada sesión antes de hacer la pausa larga.', { entero: true })}
                                {campoRitmo('delayEntreMensajes', 'Espera entre mensajes (segundos)', 'El tiempo que pasa entre un mensaje y el siguiente de la misma sesión.')}
                                {campoRitmo('delayEntreLotes', 'Espera entre lotes (segundos)', 'La pausa que hace una sesión al terminar un lote.')}
                                <Box>
                                    <Button
                                        variant="outlined"
                                        disabled={guardandoRitmo || !ritmo.valido}
                                        onClick={guardarRitmo}
                                        startIcon={guardandoRitmo ? <CircularProgress size={16} color="inherit" /> : undefined}
                                    >
                                        {guardandoRitmo ? 'Guardando…' : 'Guardar como predeterminado'}
                                    </Button>
                                </Box>
                            </AccordionDetails>
                        </Accordion>

                        <Box>
                            <Typography component="h3" sx={{ fontSize: 14, fontWeight: 650, mb: 1 }}>Resumen</Typography>
                            <Resumen
                                filas={[
                                    ['Mensajes', pluralizar(total, 'mensaje', 'mensajes')],
                                    ['Plantilla', template ? template.nombre : '—'],
                                    ['Sesiones', textoSesiones || '—'],
                                    ['Ritmo', ritmo.valido ? `Un mensaje cada ${formRitmo.delayEntreMensajes} s; lotes de ${formRitmo.batchSize} con ${formRitmo.delayEntreLotes} s de pausa` : 'Revisá los valores del ritmo'],
                                    ['Cuándo', cuando],
                                ]}
                            />
                        </Box>
                    </Box>
                )}
            </ResponsiveDialog>

            <ConfirmDialog
                open={confirmando}
                titulo={mostrarCalendario ? '¿Agendar el envío?' : '¿Enviar la campaña?'}
                mensaje={`Se van a enviar ${pluralizar(total, 'mensaje', 'mensajes')} por ${elegidas.length === 1 ? 'la sesión' : 'las sesiones'} ${textoSesiones} con la plantilla «${template?.nombre ?? ''}»${mostrarCalendario ? `, el ${cuando}` : ''}.`}
                confirmarTexto={mostrarCalendario ? 'Agendar' : 'Enviar ahora'}
                cargando={enviando}
                onConfirmar={enviar}
                onCancelar={() => setConfirmando(false)}
            />
        </>
    );
}
