import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { BloqueEstado, ConfirmDialog, ResponsiveDialog } from '../ui';
import { pluralizar } from '../campanias/waweb/formatos';

// Enviar o agendar una campaña de Email: cuenta de envío, plantilla y, si se agenda, la fecha. Antes de mandar se
// muestra el resumen de qué sale y desde dónde, y se pide confirmar.

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

export default function EnviarMailsModal({ open, onSendSuccess, onClose, campaña, mostrarCalendario = false }) {
    const feedback = useFeedback();
    const [cuentas, setCuentas] = useState([]);
    const [cargandoCuentas, setCargandoCuentas] = useState(false);
    const [errorCuentas, setErrorCuentas] = useState(false);
    const [cuentaId, setCuentaId] = useState('');
    const [templates, setTemplates] = useState([]);
    const [cargandoTemplates, setCargandoTemplates] = useState(false);
    const [errorTemplates, setErrorTemplates] = useState(false);
    const [templateId, setTemplateId] = useState('');
    const [fechaAgendada, setFechaAgendada] = useState(null);
    const [confirmando, setConfirmando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [reintento, setReintento] = useState(0);

    const total = campaña?.contactosCount ?? campaña?._count?.contactos ?? 0;

    useEffect(() => {
        if (!open) return undefined;
        setCuentaId('');
        setTemplateId('');
        setTemplates([]);
        setFechaAgendada(null);
        setConfirmando(false);
        let cancelado = false;
        setCargandoCuentas(true);
        setErrorCuentas(false);
        api.get('/email/cuentas')
            .then((res) => !cancelado && setCuentas(res.data))
            .catch(() => !cancelado && setErrorCuentas(true))
            .finally(() => !cancelado && setCargandoCuentas(false));
        return () => {
            cancelado = true;
        };
    }, [open, reintento]);

    // Las plantillas dependen de la cuenta: se muestran las de ese remitente y las globales.
    useEffect(() => {
        if (!open || !cuentaId) {
            setTemplates([]);
            return undefined;
        }
        let cancelado = false;
        setCargandoTemplates(true);
        setErrorTemplates(false);
        api.get('/email/templates', { params: { smtpId: cuentaId } })
            .then((res) => {
                if (cancelado) return;
                setTemplates(res.data);
                // Si la plantilla elegida no es de esta cuenta, se descarta.
                setTemplateId((actual) => (res.data.some((t) => t.id === actual) ? actual : ''));
            })
            .catch(() => !cancelado && setErrorTemplates(true))
            .finally(() => !cancelado && setCargandoTemplates(false));
        return () => {
            cancelado = true;
        };
    }, [open, cuentaId]);

    const cuenta = cuentas.find((c) => c.id === cuentaId);
    const template = templates.find((t) => t.id === templateId);
    const fechaValida = fechaAgendada instanceof Date && !Number.isNaN(fechaAgendada.getTime()) && fechaAgendada > new Date();
    const fechaConError = mostrarCalendario && !!fechaAgendada && !fechaValida;
    const listo = !!cuenta && !!template && (!mostrarCalendario || fechaValida);

    const cuando = useMemo(() => {
        if (!mostrarCalendario) return 'Apenas confirmes';
        return fechaValida ? fechaAgendada.toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' }) : '—';
    }, [mostrarCalendario, fechaValida, fechaAgendada]);

    const enviar = async () => {
        setEnviando(true);
        try {
            if (mostrarCalendario) {
                await api.post('/email/envio/campania/agendar', {
                    idCampania: campaña.id,
                    idTemplate: templateId,
                    idCuentaSmtp: cuentaId,
                    fechaAgenda: fechaAgendada,
                });
            } else {
                await api.post('/email/envio/campania', {
                    idCampania: campaña.id,
                    idTemplate: templateId,
                    idCuentaSmtp: cuentaId,
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

    return (
        <>
            <ResponsiveDialog
                open={open}
                onClose={() => !enviando && onClose()}
                title={`${mostrarCalendario ? 'Agendar' : 'Enviar'} «${campaña?.nombre}»`}
                sucio={!!cuentaId || !!templateId || !!fechaAgendada}
                actions={(
                    <>
                        <Button onClick={onClose} disabled={enviando}>Cancelar</Button>
                        <Button variant="contained" disabled={!listo || enviando} onClick={() => setConfirmando(true)}>
                            {mostrarCalendario ? 'Agendar campaña' : 'Enviar campaña'}
                        </Button>
                    </>
                )}
            >
                {cargandoCuentas && <BloqueEstado estado="cargando" mensaje="Cargando cuentas…" />}
                {errorCuentas && <BloqueEstado estado="error" mensaje="No se pudieron cargar las cuentas de email." onReintentar={() => setReintento((n) => n + 1)} />}
                {!cargandoCuentas && !errorCuentas && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                        <TextField
                            select
                            fullWidth
                            label="Cuenta de envío"
                            value={cuentaId}
                            onChange={(e) => setCuentaId(e.target.value)}
                            helperText={cuentas.length === 0 ? 'No hay cuentas de email cargadas. Se cargan en Ajustes › Cuentas de email.' : 'Los mails salen desde esta cuenta.'}
                            error={cuentas.length === 0}
                        >
                            {cuentas.map((c) => (
                                <MenuItem key={c.id} value={c.id} sx={{ minHeight: 44, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                                    {c.nombre} — {c.usuario}
                                </MenuItem>
                            ))}
                        </TextField>

                        <Autocomplete
                            fullWidth
                            options={templates}
                            loading={cargandoTemplates}
                            disabled={!cuentaId}
                            getOptionLabel={(t) => t.nombre}
                            isOptionEqualToValue={(a, b) => a.id === b.id}
                            value={template ?? null}
                            onChange={(_, nuevo) => setTemplateId(nuevo ? nuevo.id : '')}
                            noOptionsText="No hay plantillas para esta cuenta"
                            loadingText="Cargando plantillas…"
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Plantilla"
                                    error={errorTemplates}
                                    helperText={errorTemplates
                                        ? 'No se pudieron cargar las plantillas. Elegí la cuenta de nuevo para reintentar.'
                                        : cuentaId ? 'Se muestran las plantillas de esa cuenta y las globales.' : 'Primero elegí la cuenta de envío.'}
                                />
                            )}
                        />

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

                        <Box>
                            <Typography component="h3" sx={{ fontSize: 14, fontWeight: 650, mb: 1 }}>Resumen</Typography>
                            <Resumen
                                filas={[
                                    ['Mails', `${pluralizar(total, 'mail', 'mails')}`],
                                    ['Cuenta', cuenta ? `${cuenta.nombre} (${cuenta.usuario})` : '—'],
                                    ['Plantilla', template ? template.nombre : '—'],
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
                mensaje={`Se van a enviar ${pluralizar(total, 'mail', 'mails')} desde la cuenta ${cuenta?.nombre ?? ''}${cuenta ? ` (${cuenta.usuario})` : ''} con la plantilla «${template?.nombre ?? ''}»${mostrarCalendario ? `, el ${cuando}` : ''}.`}
                confirmarTexto={mostrarCalendario ? 'Agendar' : 'Enviar ahora'}
                cargando={enviando}
                onConfirmar={enviar}
                onCancelar={() => setConfirmando(false)}
            />
        </>
    );
}
