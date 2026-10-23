import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert, Box, Button, CircularProgress, FormControl, FormHelperText, InputLabel, MenuItem, Select, TextField, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Monitor, Save } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import { BloqueEstado, ConfirmDialog, PageContainer, PageHeader, SectionCard, VistaPreviaEmail } from '../ui';
import SelectorEmoji from '../plantillas/SelectorEmoji';
import { VARIABLES_EMAIL } from '../plantillas/variablesEmail';
import EditorTemplate from './EditorTemplate';

/**
 * Crear o editar una plantilla de email. El nombre, el remitente y el asunto se editan en cualquier pantalla; el
 * diseño (Unlayer) solo desde `md`: en un celular no se puede armar un email arrastrando bloques, así que ahí se ve
 * la vista previa y un aviso.
 */
export default function CrearTemplate() {
    const feedback = useFeedback();
    const theme = useTheme();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const idUrl = searchParams.get('id');
    const hayEditor = useMediaQuery(theme.breakpoints.up('md'));

    const editorRef = useRef(null);
    const asuntoRef = useRef(null);
    // El id que ya está cargado en pantalla: después de crear, la URL pasa a ?id= y no hay que volver a pedirlo.
    const idCargado = useRef(null);

    const [nombre, setNombre] = useState('');
    const [asunto, setAsunto] = useState('');
    const [cuentaSmtpId, setCuentaSmtpId] = useState('');
    const [cuentasSmtp, setCuentasSmtp] = useState([]);
    const [design, setDesign] = useState(null);
    const [html, setHtml] = useState('');
    const [original, setOriginal] = useState({ nombre: '', asunto: '', cuentaSmtpId: '' });
    const [disenoTocado, setDisenoTocado] = useState(false);

    const [cargando, setCargando] = useState(!!idUrl);
    const [errorCarga, setErrorCarga] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [errores, setErrores] = useState({});
    const [errorGuardado, setErrorGuardado] = useState('');
    const [confirmarSalir, setConfirmarSalir] = useState(false);

    const esEdicion = !!idUrl;

    useEffect(() => {
        api.get('/email/cuentas')
            .then((r) => setCuentasSmtp(r.data || []))
            .catch((err) => feedback.error(mensajeDeError(err, 'No se pudieron cargar los remitentes.')));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cargar = useCallback(async () => {
        if (!idUrl || idCargado.current === idUrl) return;
        setCargando(true);
        setErrorCarga(null);
        try {
            const { data } = await api.get(`/email/templates/${idUrl}`);
            idCargado.current = idUrl;
            setNombre(data.nombre ?? '');
            setAsunto(data.asunto ?? '');
            setDesign(data.design ?? null);
            setHtml(data.html ?? '');
            setCuentaSmtpId(data.cuentaSmtpId || '');
            setOriginal({ nombre: data.nombre ?? '', asunto: data.asunto ?? '', cuentaSmtpId: data.cuentaSmtpId || '' });
            setDisenoTocado(false);
        } catch (err) {
            setErrorCarga(mensajeDeError(err, 'No se pudo cargar la plantilla.'));
        } finally {
            setCargando(false);
        }
    }, [idUrl]);

    useEffect(() => { cargar(); }, [cargar]);

    const sucio = nombre !== original.nombre || asunto !== original.asunto || cuentaSmtpId !== original.cuentaSmtpId || disenoTocado;

    // Cerrar la pestaña o recargar con cambios sin guardar. Salir por el menú de la app no se puede interceptar con
    // el router de esta app, por eso "Volver" pregunta por su cuenta.
    useEffect(() => {
        if (!sucio) return undefined;
        const avisar = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', avisar);
        return () => window.removeEventListener('beforeunload', avisar);
    }, [sucio]);

    const insertarEnAsunto = (texto) => {
        const input = asuntoRef.current;
        const start = input?.selectionStart ?? asunto.length;
        const end = input?.selectionEnd ?? asunto.length;
        setAsunto(asunto.slice(0, start) + texto + asunto.slice(end));
        setErrores((e) => ({ ...e, asunto: undefined }));
        setTimeout(() => {
            input?.focus();
            input?.setSelectionRange(start + texto.length, start + texto.length);
        }, 0);
    };

    const guardar = async () => {
        const nuevos = {};
        if (!nombre.trim()) nuevos.nombre = 'El nombre es obligatorio.';
        if (!asunto.trim()) nuevos.asunto = 'El asunto es obligatorio.';
        if (!hayEditor && !esEdicion) nuevos.diseno = 'Una plantilla nueva se diseña desde una computadora.';
        setErrores(nuevos);
        setErrorGuardado('');
        if (Object.keys(nuevos).length > 0) return;

        setGuardando(true);
        try {
            let htmlFinal = html;
            let designFinal = design;
            if (hayEditor) {
                try {
                    ({ html: htmlFinal, design: designFinal } = await editorRef.current.exportar());
                } catch {
                    setErrorGuardado('El editor de diseño todavía está cargando. Esperá un momento y probá de nuevo.');
                    return;
                }
            }
            const payload = { nombre, asunto, html: htmlFinal, design: designFinal, cuentaSmtpId: cuentaSmtpId || null };

            if (esEdicion) {
                await api.put(`/email/templates/${idUrl}`, payload);
                feedback.exito('Plantilla guardada.');
                setHtml(htmlFinal);
                setDesign(designFinal);
                setOriginal({ nombre, asunto, cuentaSmtpId });
                setDisenoTocado(false);
            } else {
                const { data } = await api.post('/email/templates', payload);
                feedback.exito('Plantilla creada.');
                setOriginal({ nombre, asunto, cuentaSmtpId });
                setDisenoTocado(false);
                if (data?.id) {
                    // Pasa a modo edición: si no, guardar de nuevo crearía una plantilla duplicada.
                    idCargado.current = String(data.id);
                    navigate(`/email/crearTemplate?id=${data.id}`, { replace: true });
                } else {
                    navigate('/email/templates', { replace: true });
                }
            }
        } catch (err) {
            const msg = mensajeDeError(err, 'No se pudo guardar la plantilla.');
            setErrorGuardado(msg);
            feedback.error(msg);
        } finally {
            setGuardando(false);
        }
    };

    const volver = () => {
        if (sucio) setConfirmarSalir(true);
        else navigate('/email/templates');
    };

    return (
        <PageContainer>
            <PageHeader
                title={esEdicion ? 'Editar plantilla' : 'Nueva plantilla'}
                breadcrumbs={migasDe('/email/templates')}
                actions={
                    <>
                        <Button onClick={volver} disabled={guardando}>Volver</Button>
                        <Button
                            variant="contained"
                            onClick={guardar}
                            disabled={guardando || cargando || !!errorCarga}
                            startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : <Save size={18} strokeWidth={1.75} aria-hidden />}
                        >
                            {guardando ? 'Guardando…' : 'Guardar'}
                        </Button>
                    </>
                }
            />

            {errorCarga && <BloqueEstado estado="error" mensaje={errorCarga} onReintentar={cargar} />}
            {cargando && <BloqueEstado estado="cargando" mensaje="Cargando plantilla…" />}

            {!cargando && !errorCarga && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {errorGuardado && <Alert severity="error">{errorGuardado}</Alert>}
                    {errores.diseno && <Alert severity="warning">{errores.diseno}</Alert>}

                    <SectionCard title="Datos de la plantilla">
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField
                                fullWidth
                                label="Nombre de la plantilla"
                                value={nombre}
                                onChange={(e) => {
                                    setNombre(e.target.value);
                                    setErrores((x) => ({ ...x, nombre: undefined }));
                                }}
                                error={!!errores.nombre}
                                helperText={errores.nombre}
                            />

                            <FormControl fullWidth>
                                <InputLabel id="remitente-plantilla">Remitente (opcional)</InputLabel>
                                <Select labelId="remitente-plantilla" value={cuentaSmtpId} label="Remitente (opcional)" onChange={(e) => setCuentaSmtpId(e.target.value)}>
                                    <MenuItem value="">Global (aparece con todos los remitentes)</MenuItem>
                                    {cuentasSmtp.map((c) => (
                                        <MenuItem key={c.id} value={c.id}>{c.nombre} — {c.emailFrom}</MenuItem>
                                    ))}
                                </Select>
                                <FormHelperText>Si elegís un remitente, la plantilla solo aparece cuando se usa esa cuenta de email.</FormHelperText>
                            </FormControl>

                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexDirection: { xs: 'column', sm: 'row' } }}>
                                <TextField
                                    fullWidth
                                    label="Asunto del email"
                                    value={asunto}
                                    inputRef={asuntoRef}
                                    onChange={(e) => {
                                        setAsunto(e.target.value);
                                        setErrores((x) => ({ ...x, asunto: undefined }));
                                    }}
                                    error={!!errores.asunto}
                                    helperText={errores.asunto}
                                />
                                <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' }, flex: 'none' }}>
                                    <FormControl sx={{ minWidth: { sm: 190 }, flex: { xs: 1, sm: 'none' } }}>
                                        <Select
                                            displayEmpty
                                            value=""
                                            inputProps={{ 'aria-label': 'Insertar variable en el asunto' }}
                                            onChange={(e) => insertarEnAsunto(`{{${e.target.value}}}`)}
                                        >
                                            <MenuItem disabled value="">Insertar variable</MenuItem>
                                            {VARIABLES_EMAIL.map((v) => <MenuItem key={v} value={v}>{`{{${v}}}`}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                    <SelectorEmoji onSelect={insertarEnAsunto} />
                                </Box>
                            </Box>
                        </Box>
                    </SectionCard>

                    {hayEditor ? (
                        <EditorTemplate ref={editorRef} initialDesign={design} onCambio={() => setDisenoTocado(true)} />
                    ) : (
                        <SectionCard
                            title="Vista previa"
                            subtitle="Así se ve el diseño guardado."
                        >
                            <Alert severity="info" icon={<Monitor size={20} strokeWidth={1.75} aria-hidden />} sx={{ mb: 2 }}>
                                <Typography variant="body2" component="span">El diseño se edita desde una computadora. Desde acá podés cambiar el nombre, el remitente y el asunto.</Typography>
                            </Alert>
                            {html ? <VistaPreviaEmail html={html} /> : (
                                <Typography variant="body2" color="text.secondary">Esta plantilla todavía no tiene diseño.</Typography>
                            )}
                        </SectionCard>
                    )}
                </Box>
            )}

            <ConfirmDialog
                open={confirmarSalir}
                peligro
                titulo="¿Salir sin guardar?"
                mensaje="Hay cambios en la plantilla que todavía no se guardaron. Si salís, se pierden."
                confirmarTexto="Salir sin guardar"
                cancelarTexto="Seguir editando"
                onConfirmar={() => navigate('/email/templates')}
                onCancelar={() => setConfirmarSalir(false)}
            />
        </PageContainer>
    );
}
