import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert, Autocomplete, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select,
    TextField, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Eye, FilePenLine, FileText, Paperclip, Save, Send } from 'lucide-react';
import EmailEditor from 'react-email-editor';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { renderTemplate } from '../../utils/renderTemplate';
import { migasDe } from '../layout/navConfig';
import { ConfirmDialog, EmptyState, PageContainer, PageHeader, ResponsiveDialog, SectionCard, VistaPreviaEmail } from '../ui';
import HTMLTemplateEditor from '../utils/HTMLTemplateEditor';
import { REGEX_EMAIL } from '../plantillas/variablesEmail';

// Se acepta pegar varios emails juntos, separados por coma, punto y coma, espacio o salto de línea.
const SEPARADORES = /[\s,;]+/;

/** Parte un texto en emails sueltos, sin vacíos. */
function separarEmails(texto) {
    return String(texto).split(SEPARADORES).map((e) => e.trim()).filter(Boolean);
}

/** Une listas de emails sin repetir (sin distinguir mayúsculas): el chip usa el email como key. */
function sinDuplicados(lista) {
    const vistos = new Set();
    return lista.filter((e) => {
        const k = e.toLowerCase();
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
    });
}

export default function EnvioManual() {
    const feedback = useFeedback();
    const theme = useTheme();
    const navigate = useNavigate();
    const hayEditorDiseno = useMediaQuery(theme.breakpoints.up('md'));
    const [params, setParams] = useSearchParams();
    // El modo está en la URL: el atrás del celular no tira abajo lo que se estaba armando.
    const modo = params.get('modo') === 'libre' ? 'libre' : 'plantilla';
    const cambiarModo = (m) => {
        const nuevo = new URLSearchParams(params);
        if (m === 'libre') nuevo.set('modo', 'libre');
        else nuevo.delete('modo');
        setParams(nuevo, { replace: true });
    };

    // Destinatario y cuenta (comunes)
    const [toList, setToList] = useState([]);
    const [textoEmail, setTextoEmail] = useState('');
    const [toNombre, setToNombre] = useState('');
    const [smtpId, setSmtpId] = useState('');
    const [cuentas, setCuentas] = useState([]);

    // Adjuntos
    const [adjuntos, setAdjuntos] = useState([]);
    const adjuntosRef = useRef(null);

    // Con plantilla
    const [templates, setTemplates] = useState([]);
    const [templateSeleccionado, setTemplateSeleccionado] = useState(null);
    const [templateData, setTemplateData] = useState(null);
    const [variables, setVariables] = useState([]);
    const [variableValues, setVariableValues] = useState({});
    const [asuntoManual, setAsuntoManual] = useState('');
    const [loadingTemplate, setLoadingTemplate] = useState(false);

    // Composición libre
    const [subjectLibre, setSubjectLibre] = useState('');
    const [htmlLibre, setHtmlLibre] = useState('');
    const emailEditorRef = useRef(null);
    const [editorReady, setEditorReady] = useState(false);

    // UI
    const [enviando, setEnviando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [previewAbierto, setPreviewAbierto] = useState(false);
    const [guardarAbierto, setGuardarAbierto] = useState(false);
    const [nombreTemplateNuevo, setNombreTemplateNuevo] = useState('');
    const [guardando, setGuardando] = useState(false);
    // Lo que espera confirmación cuando son varios destinatarios: { html }.
    const [pendiente, setPendiente] = useState(null);

    useEffect(() => {
        api.get('/email/cuentas')
            .then((r) => setCuentas(r.data || []))
            .catch((err) => feedback.error(mensajeDeError(err, 'No se pudieron cargar las cuentas de email.')));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Las plantillas se filtran por la cuenta elegida.
    useEffect(() => {
        const url = smtpId ? `/email/templates?smtpId=${smtpId}` : '/email/templates';
        api.get(url)
            .then((r) => {
                setTemplates(r.data || []);
                setTemplateSeleccionado((prev) => (prev && !(r.data || []).find((t) => t.id === prev.id) ? null : prev));
            })
            .catch((err) => feedback.error(mensajeDeError(err, 'No se pudieron cargar las plantillas.')));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [smtpId]);

    const seleccionarTemplate = useCallback(async (tmpl) => {
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
            const { data: varData } = await api.post('/email/manual/extract-vars', { html: data.html || '', asunto: data.asunto || '' });
            setVariables(varData.variables || []);
            setVariableValues((prev) => {
                const next = { ...prev };
                for (const v of varData.variables || []) if (!(v in next)) next[v] = '';
                return next;
            });
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo cargar la plantilla.'));
        } finally {
            setLoadingTemplate(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const quitarAdjunto = (index) => setAdjuntos((prev) => prev.filter((_, i) => i !== index));

    const agregarEmails = (texto) => {
        const nuevos = separarEmails(texto);
        if (nuevos.length) setToList((prev) => sinDuplicados([...prev, ...nuevos]));
    };

    const previewHtml = useMemo(() => {
        if (modo === 'plantilla') {
            if (!templateData?.html) return '';
            return renderTemplate(templateData.html, { nombre: toNombre, ...variableValues }, { conservarFaltantes: true });
        }
        return htmlLibre;
    }, [modo, templateData, toNombre, variableValues, htmlLibre]);

    const asuntoPreview = useMemo(() => {
        if (modo === 'plantilla') return renderTemplate(asuntoManual, { nombre: toNombre, ...variableValues }, { conservarFaltantes: true });
        return subjectLibre;
    }, [modo, asuntoManual, toNombre, variableValues, subjectLibre]);

    // El contenido de la composición libre: el editor de diseño se exporta; el básico ya lo tiene en el estado.
    const obtenerHtmlLibre = () =>
        new Promise((resolve) => {
            const editor = hayEditorDiseno && editorReady ? emailEditorRef.current?.editor : null;
            if (!editor) {
                resolve(htmlLibre);
                return;
            }
            editor.exportHtml((data) => {
                setHtmlLibre(data.html);
                resolve(data.html);
            });
        });

    const validar = (htmlFinal) => {
        if (toList.length === 0) return 'Agregá al menos un email de destino.';
        const malo = toList.find((e) => !REGEX_EMAIL.test(e.trim()));
        if (malo) return `Este email no es válido: ${malo}`;
        if (!smtpId) return 'Elegí la cuenta de email desde la que se envía.';
        if (modo === 'plantilla') {
            if (!templateSeleccionado) return 'Elegí una plantilla.';
        } else {
            if (!subjectLibre.trim()) return 'Escribí el asunto.';
            if (!htmlFinal?.trim()) return 'Escribí el contenido del email.';
        }
        return null;
    };

    const ejecutarEnvio = async (htmlFinal) => {
        setEnviando(true);
        setResultado(null);
        try {
            const formData = new FormData();
            toList.forEach((email) => formData.append('to', email.trim()));
            if (toNombre.trim()) formData.append('toNombre', toNombre.trim());
            formData.append('smtpId', String(smtpId));
            formData.append('subject', asuntoPreview);
            formData.append('html', htmlFinal);
            if (modo === 'plantilla' && templateSeleccionado) {
                formData.append('templateId', String(templateSeleccionado.id));
                formData.append('variables', JSON.stringify({ nombre: toNombre, ...variableValues }));
            }
            adjuntos.forEach((f) => formData.append('adjuntos', f));

            const { data } = await api.post('/email/manual/send', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setResultado(data);
            if (data.ok && !data.omitidos?.length) {
                feedback.exito(data.total === 1 ? 'Mail enviado.' : `${data.enviados}/${data.total} mails enviados.`);
            } else {
                feedback.aviso(`${data.enviados}/${data.total} mails enviados. Mirá el detalle abajo.`);
            }
        } catch (err) {
            const msg = mensajeDeError(err, 'No se pudo enviar el mail.');
            setResultado({ ok: false, error: msg });
            feedback.error(msg);
        } finally {
            setEnviando(false);
        }
    };

    const enviar = async () => {
        const htmlFinal = modo === 'libre' ? await obtenerHtmlLibre() : previewHtml;
        const error = validar(htmlFinal);
        if (error) {
            feedback.aviso(error);
            return;
        }
        // A varias personas, una confirmación: un envío no se deshace.
        if (toList.length > 1) {
            setPendiente({ html: htmlFinal });
            return;
        }
        await ejecutarEnvio(htmlFinal);
    };

    const abrirPreview = async () => {
        if (modo === 'libre') await obtenerHtmlLibre();
        setPreviewAbierto(true);
    };

    const guardarComoPlantilla = async () => {
        if (!nombreTemplateNuevo.trim()) return;
        const htmlFinal = await obtenerHtmlLibre();
        if (!htmlFinal?.trim()) {
            feedback.aviso('Escribí el contenido del email antes de guardarlo como plantilla.');
            return;
        }
        setGuardando(true);
        try {
            await api.post('/email/manual/guardar-template', { nombre: nombreTemplateNuevo.trim(), asunto: subjectLibre, html: htmlFinal });
            feedback.exito('Plantilla guardada.');
            setGuardarAbierto(false);
            setNombreTemplateNuevo('');
            api.get('/email/templates').then((r) => setTemplates(r.data || [])).catch(() => { /* la lista se recarga al elegir otra cuenta */ });
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo guardar la plantilla.'));
        } finally {
            setGuardando(false);
        }
    };

    const tarjetaDestino = (
        <SectionCard title="Destinatario y cuenta">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Autocomplete
                    multiple
                    freeSolo
                    autoSelect
                    options={[]}
                    value={toList}
                    inputValue={textoEmail}
                    onInputChange={(_, v, motivo) => {
                        if (motivo !== 'input') {
                            setTextoEmail(v);
                            return;
                        }
                        // Al tipear o pegar una coma, un espacio o varios emails juntos, los completos se pasan a chips.
                        if (SEPARADORES.test(v)) {
                            const terminaEnSeparador = SEPARADORES.test(v.slice(-1));
                            const partes = separarEmails(v);
                            const resto = terminaEnSeparador ? '' : partes.pop() ?? '';
                            agregarEmails(partes.join(' '));
                            setTextoEmail(resto);
                        } else {
                            setTextoEmail(v);
                        }
                    }}
                    onChange={(_, nuevo) => setToList(sinDuplicados(nuevo.flatMap((e) => separarEmails(e))))}
                    renderTags={(value, getTagProps) =>
                        value.map((email, index) => {
                            const { key, ...resto } = getTagProps({ index });
                            return (
                                <Chip
                                    key={key ?? email}
                                    label={email}
                                    {...resto}
                                    color={REGEX_EMAIL.test(email) ? 'default' : 'error'}
                                    sx={{ height: { xs: 32, md: 24 } }}
                                />
                            );
                        })
                    }
                    renderInput={(p) => (
                        <TextField
                            {...p}
                            label="Email de destino"
                            placeholder={toList.length === 0 ? 'nombre@dominio.com' : ''}
                            helperText="Podés pegar varios, separados por coma o espacio."
                            inputProps={{ ...p.inputProps, inputMode: 'email', autoCapitalize: 'off' }}
                        />
                    )}
                />
                <TextField label="Nombre (opcional)" value={toNombre} onChange={(e) => setToNombre(e.target.value)} fullWidth />
                <FormControl fullWidth>
                    <InputLabel id="cuenta-manual">Cuenta de email</InputLabel>
                    <Select labelId="cuenta-manual" value={smtpId} label="Cuenta de email" onChange={(e) => setSmtpId(e.target.value)}>
                        {cuentas.map((c) => <MenuItem key={c.id} value={c.id}>{c.nombre} — {c.usuario}</MenuItem>)}
                    </Select>
                </FormControl>
            </Box>
        </SectionCard>
    );

    const tarjetaAdjuntos = (
        <SectionCard title="Archivos adjuntos">
            <input
                ref={adjuntosRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                    setAdjuntos((prev) => [...prev, ...Array.from(e.target.files)]);
                    e.target.value = '';
                }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'flex-start' }}>
                <Button variant="outlined" startIcon={<Paperclip size={18} strokeWidth={1.75} aria-hidden />} onClick={() => adjuntosRef.current?.click()}>
                    Adjuntar archivos
                </Button>
                {adjuntos.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        {adjuntos.map((f, i) => (
                            <Chip key={`${f.name}-${f.size}-${i}`} label={f.name} onDelete={() => quitarAdjunto(i)} sx={{ height: { xs: 32, md: 24 }, maxWidth: '100%' }} />
                        ))}
                    </Box>
                )}
            </Box>
        </SectionCard>
    );

    const tarjetaAcciones = (
        <SectionCard>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button
                    variant="contained"
                    startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : <Send size={18} strokeWidth={1.75} aria-hidden />}
                    onClick={enviar}
                    disabled={enviando}
                    sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
                >
                    {enviando ? 'Enviando…' : 'Enviar'}
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<Eye size={18} strokeWidth={1.75} aria-hidden />}
                    onClick={abrirPreview}
                    disabled={modo === 'plantilla' && !previewHtml}
                    sx={{ flex: { xs: '1 1 calc(50% - 6px)', sm: '0 0 auto' } }}
                >
                    Vista previa
                </Button>
                {modo === 'libre' && (
                    <Button
                        variant="outlined"
                        startIcon={<Save size={18} strokeWidth={1.75} aria-hidden />}
                        onClick={() => setGuardarAbierto(true)}
                        sx={{ flex: { xs: '1 1 calc(50% - 6px)', sm: '0 0 auto' } }}
                    >
                        Guardar como plantilla
                    </Button>
                )}
            </Box>

            {resultado && (
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {resultado.error ? (
                        <Alert severity="error">{resultado.error}</Alert>
                    ) : (
                        <Alert
                            severity={resultado.ok && !resultado.omitidos?.length ? 'success' : 'warning'}
                            action={<Button color="inherit" size="small" onClick={() => navigate('/email/reportes')} sx={{ minHeight: 44 }}>Ver reportes</Button>}
                        >
                            {resultado.total === 1 && resultado.ok && !resultado.omitidos?.length
                                ? `Mail enviado · reporte #${resultado.reporteIds?.[0]}`
                                : `${resultado.enviados}/${resultado.total} mails enviados.`}
                        </Alert>
                    )}
                    {resultado.errores?.length > 0 && (
                        <Alert severity="error">
                            No se pudieron enviar:
                            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                {resultado.errores.map((e) => <li key={e.email}>{e.email}{e.error ? `: ${e.error}` : ''}</li>)}
                            </Box>
                        </Alert>
                    )}
                    {resultado.omitidos?.length > 0 && (
                        <Alert severity="info">
                            No se enviaron porque pidieron la baja:
                            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                {resultado.omitidos.map((e) => <li key={e.email}>{e.email}</li>)}
                            </Box>
                        </Alert>
                    )}
                </Box>
            )}
        </SectionCard>
    );

    const tarjetaPlantilla = (
        <SectionCard title="Plantilla">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Autocomplete
                    options={templates}
                    getOptionLabel={(o) => o.nombre || ''}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    value={templateSeleccionado}
                    onChange={(_, v) => seleccionarTemplate(v)}
                    loading={loadingTemplate}
                    noOptionsText="No hay plantillas para esta cuenta"
                    renderInput={(p) => (
                        <TextField
                            {...p}
                            label="Plantilla"
                            InputProps={{
                                ...p.InputProps,
                                endAdornment: (<>{loadingTemplate && <CircularProgress size={16} />}{p.InputProps.endAdornment}</>),
                            }}
                        />
                    )}
                />
                {templateData && (
                    <TextField label="Asunto" value={asuntoManual} onChange={(e) => setAsuntoManual(e.target.value)} fullWidth helperText="Podés usar variables como {{nombre}}." />
                )}
                {variables.length > 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Typography variant="subtitle2" color="text.secondary">Variables de la plantilla</Typography>
                        {variables.map((v) => (
                            <TextField
                                key={v}
                                label={v}
                                value={variableValues[v] || ''}
                                onChange={(e) => setVariableValues((prev) => ({ ...prev, [v]: e.target.value }))}
                                fullWidth
                            />
                        ))}
                    </Box>
                )}
            </Box>
        </SectionCard>
    );

    // El editor va arriba del botón Enviar. En el celular es el editor básico: el de diseño no entra.
    const tarjetaContenido = (
        <SectionCard title="Contenido">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="Asunto" value={subjectLibre} onChange={(e) => setSubjectLibre(e.target.value)} fullWidth />
                {hayEditorDiseno ? (
                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                        <EmailEditor
                            ref={emailEditorRef}
                            onReady={() => setEditorReady(true)}
                            options={{ locale: 'es-ES', features: { textEditor: { tables: true } } }}
                            style={{ height: 'max(500px, calc(100dvh - 320px))' }}
                        />
                    </Box>
                ) : (
                    <HTMLTemplateEditor
                        value={htmlLibre}
                        onChange={setHtmlLibre}
                        variables={[{ label: 'Nombre', token: '{{nombre}}' }]}
                        placeholder="Escribí el mensaje…"
                    />
                )}
            </Box>
        </SectionCard>
    );

    const tarjetaVistaPrevia = templateData ? (
        <SectionCard title="Vista previa" subtitle={asuntoPreview ? <>Asunto: {asuntoPreview}</> : undefined}>
            <VistaPreviaEmail html={previewHtml} />
        </SectionCard>
    ) : (
        <SectionCard>
            <EmptyState compact icon={FileText} title="Elegí una plantilla" description="Acá vas a ver cómo queda el mail antes de mandarlo." />
        </SectionCard>
    );

    return (
        <PageContainer>
            <PageHeader
                title="Envío manual"
                subtitle="Mandá un mail suelto a una o varias personas, con una plantilla o escribiéndolo en el momento."
                breadcrumbs={migasDe('/email/envio-manual')}
            />

            <ToggleButtonGroup
                value={modo}
                exclusive
                onChange={(_, v) => v && cambiarModo(v)}
                aria-label="Cómo armar el mail"
                sx={{ mb: 2, width: { xs: '100%', sm: 'auto' }, '& .MuiToggleButton-root': { minHeight: 44, flex: { xs: 1, sm: 'none' }, gap: 1, textTransform: 'none' } }}
            >
                <ToggleButton value="plantilla"><FileText size={18} strokeWidth={1.75} aria-hidden />Con plantilla</ToggleButton>
                <ToggleButton value="libre"><FilePenLine size={18} strokeWidth={1.75} aria-hidden />Escribirlo yo</ToggleButton>
            </ToggleButtonGroup>

            {modo === 'plantilla' ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 480px) minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {tarjetaDestino}
                        {tarjetaPlantilla}
                        {tarjetaAdjuntos}
                        {tarjetaAcciones}
                    </Box>
                    {tarjetaVistaPrevia}
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {tarjetaDestino}
                    {tarjetaContenido}
                    {tarjetaAdjuntos}
                    {tarjetaAcciones}
                </Box>
            )}

            <ResponsiveDialog
                open={previewAbierto}
                onClose={() => setPreviewAbierto(false)}
                cerrarConFondo
                maxWidth="md"
                title="Vista previa"
                actions={<Button variant="contained" onClick={() => setPreviewAbierto(false)}>Cerrar</Button>}
            >
                {asuntoPreview && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}><strong>Asunto:</strong> {asuntoPreview}</Typography>}
                <VistaPreviaEmail html={previewHtml} />
            </ResponsiveDialog>

            <ResponsiveDialog
                open={guardarAbierto}
                onClose={() => !guardando && setGuardarAbierto(false)}
                maxWidth="xs"
                title="Guardar como plantilla"
                actions={
                    <>
                        <Button onClick={() => setGuardarAbierto(false)} disabled={guardando}>Cancelar</Button>
                        <Button
                            variant="contained"
                            onClick={guardarComoPlantilla}
                            disabled={guardando || !nombreTemplateNuevo.trim()}
                            startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : <Save size={18} strokeWidth={1.75} aria-hidden />}
                        >
                            Guardar
                        </Button>
                    </>
                }
            >
                <TextField label="Nombre de la plantilla" value={nombreTemplateNuevo} onChange={(e) => setNombreTemplateNuevo(e.target.value)} fullWidth autoFocus sx={{ mt: 0.5 }} />
            </ResponsiveDialog>

            <ConfirmDialog
                open={!!pendiente}
                titulo={`¿Enviar a ${toList.length} destinatarios?`}
                mensaje={<>Se va a mandar «{asuntoPreview}» a {toList.length} direcciones de email. Un envío no se puede deshacer.</>}
                confirmarTexto={`Enviar a ${toList.length}`}
                onConfirmar={() => {
                    const html = pendiente.html;
                    setPendiente(null);
                    ejecutarEnvio(html);
                }}
                onCancelar={() => setPendiente(null)}
            />
        </PageContainer>
    );
}
