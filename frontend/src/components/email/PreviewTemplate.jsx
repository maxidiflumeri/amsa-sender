import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import { Pencil, RefreshCw, Send } from 'lucide-react';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import { BloqueEstado, PageContainer, PageHeader, SectionCard, VistaPreviaEmail } from '../ui';
import { REGEX_EMAIL } from '../plantillas/variablesEmail';

/**
 * La plantilla tal como la recibe alguien: con los datos de un contacto real de una campaña, y con la opción de
 * mandarse una prueba. El HTML va en el iframe aislado de `VistaPreviaEmail`; antes se inyectaba en la app y se
 * forzaba `table { display: block }`, así que lo que se veía no era lo que llegaba.
 */
export default function PreviewTemplate() {
    const { id } = useParams();
    const navigate = useNavigate();
    const feedback = useFeedback();

    const [plantilla, setPlantilla] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState(null);

    const [html, setHtml] = useState('');
    const [asunto, setAsunto] = useState('');

    const [cuentas, setCuentas] = useState([]);
    const [smtpId, setSmtpId] = useState('');
    const [destino, setDestino] = useState('');
    const [enviando, setEnviando] = useState(false);

    const [campanias, setCampanias] = useState([]);
    const [campaniaId, setCampaniaId] = useState('');
    // Los contactos de cada campaña ya pedidos, para no volver a pedirlos al elegir "Otro contacto".
    const [contactosCache, setContactosCache] = useState({});
    const [cargandoContactos, setCargandoContactos] = useState(false);
    const [indiceContacto, setIndiceContacto] = useState(-1);

    const cargar = useCallback(async () => {
        setCargando(true);
        setErrorCarga(null);
        try {
            const { data: tpl } = await api.get(`/email/templates/${id}`);
            setPlantilla(tpl);
            setHtml(tpl.html ?? '');
            setAsunto(tpl.asunto ?? '');
            const [{ data: lite }, { data: cuentasSmtp }] = await Promise.all([
                api.get('/email/campanias?lite=1'),
                api.get('/email/cuentas'),
            ]);
            setCampanias((lite || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20));
            setCuentas(cuentasSmtp || []);
        } catch (err) {
            setErrorCarga(mensajeDeError(err, 'No se pudo cargar la plantilla.'));
        } finally {
            setCargando(false);
        }
    }, [id]);

    useEffect(() => { cargar(); }, [cargar]);

    const mostrarConDatos = async (datos) => {
        try {
            const { data } = await api.post('/email/templates/preview', { html: plantilla?.html ?? '', asunto: plantilla?.asunto ?? '', datos: datos ?? {} });
            setHtml(data.html);
            setAsunto(data.asunto);
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo generar la vista previa con datos reales.'));
        }
    };

    const elegirContacto = async (campania, indice) => {
        const lista = contactosCache[campania] ?? [];
        setIndiceContacto(indice);
        await mostrarConDatos(lista[indice]?.datos);
    };

    const alElegirCampania = async (valor) => {
        const num = Number(valor);
        setCampaniaId(num || '');
        setIndiceContacto(-1);
        if (!num) {
            setHtml(plantilla?.html ?? '');
            setAsunto(plantilla?.asunto ?? '');
            return;
        }
        let items = contactosCache[num];
        if (!items) {
            setCargandoContactos(true);
            try {
                const { data: resp } = await api.get(`/email/campanias/${num}/contactos`);
                items = Array.isArray(resp?.items) ? resp.items : [];
                setContactosCache((prev) => ({ ...prev, [num]: items }));
            } catch (err) {
                feedback.error(mensajeDeError(err, 'No se pudieron obtener los contactos de la campaña.'));
                return;
            } finally {
                setCargandoContactos(false);
            }
        }
        if (items.length === 0) {
            setHtml(plantilla?.html ?? '');
            setAsunto(plantilla?.asunto ?? '');
            feedback.aviso('Esa campaña no tiene contactos: se muestra la plantilla sin datos.');
            return;
        }
        const i = Math.floor(Math.random() * items.length);
        setIndiceContacto(i);
        await mostrarConDatos(items[i]?.datos);
    };

    const otroContacto = async () => {
        const lista = contactosCache[campaniaId] ?? [];
        if (lista.length < 2) {
            feedback.info('Esa campaña tiene un solo contacto.');
            return;
        }
        let i;
        do { i = Math.floor(Math.random() * lista.length); } while (i === indiceContacto);
        await elegirContacto(campaniaId, i);
    };

    const enviarPrueba = async () => {
        if (!smtpId) {
            feedback.aviso('Elegí la cuenta desde la que se manda la prueba.');
            return;
        }
        if (!REGEX_EMAIL.test(destino.trim())) {
            feedback.aviso('Escribí un email de destino válido.');
            return;
        }
        setEnviando(true);
        try {
            await api.post('/email/envio/enviar-preview', { html, subject: asunto, to: destino.trim(), smtpId: Number(smtpId) });
            feedback.exito(`Prueba enviada a ${destino.trim()}.`);
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo enviar la prueba.'));
        } finally {
            setEnviando(false);
        }
    };

    const contactosDeCampania = contactosCache[campaniaId] ?? [];

    return (
        <PageContainer>
            <PageHeader
                title={plantilla ? `Vista previa: ${plantilla.nombre}` : 'Vista previa'}
                breadcrumbs={migasDe('/email/templates')}
                back="/email/templates"
                actions={
                    <Button variant="contained" startIcon={<Pencil size={18} strokeWidth={1.75} aria-hidden />} onClick={() => navigate(`/email/crearTemplate?id=${id}`)} disabled={!plantilla}>
                        Editar
                    </Button>
                }
            />

            {cargando && <BloqueEstado estado="cargando" mensaje="Cargando plantilla…" />}
            {errorCarga && <BloqueEstado estado="error" mensaje={errorCarga} onReintentar={cargar} />}

            {!cargando && !errorCarga && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 360px) minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <SectionCard title="Ver con datos reales" subtitle="Elegí una campaña para ver la plantilla con los datos de uno de sus contactos.">
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <FormControl fullWidth>
                                    <InputLabel id="campania-preview">Campaña</InputLabel>
                                    <Select labelId="campania-preview" label="Campaña" value={campaniaId} onChange={(e) => alElegirCampania(e.target.value)}>
                                        <MenuItem value="">Sin datos (la plantilla tal cual)</MenuItem>
                                        {campanias.map((c) => (
                                            <MenuItem key={c.id} value={Number(c.id)}>
                                                {c.nombre} · {new Date(c.createdAt).toLocaleDateString('es-AR')}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                {cargandoContactos && <Typography variant="caption" color="text.secondary">Cargando contactos de la campaña…</Typography>}
                                {campaniaId && contactosDeCampania.length > 1 && (
                                    <Button variant="outlined" startIcon={<RefreshCw size={18} strokeWidth={1.75} aria-hidden />} onClick={otroContacto}>
                                        Otro contacto
                                    </Button>
                                )}
                            </Box>
                        </SectionCard>

                        <SectionCard title="Enviarme una prueba" subtitle="Manda esta vista previa a un email para verla en una bandeja de entrada.">
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <FormControl fullWidth>
                                    <InputLabel id="cuenta-preview">Cuenta de email</InputLabel>
                                    <Select labelId="cuenta-preview" label="Cuenta de email" value={smtpId} onChange={(e) => setSmtpId(e.target.value)}>
                                        {cuentas.map((c) => <MenuItem key={c.id} value={c.id}>{c.nombre} ({c.usuario})</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <TextField
                                    label="Email de destino"
                                    type="email"
                                    value={destino}
                                    onChange={(e) => setDestino(e.target.value)}
                                    placeholder="usuario@dominio.com"
                                    inputProps={{ autoCapitalize: 'off', inputMode: 'email' }}
                                />
                                <Button
                                    variant="contained"
                                    onClick={enviarPrueba}
                                    disabled={enviando}
                                    startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : <Send size={18} strokeWidth={1.75} aria-hidden />}
                                >
                                    {enviando ? 'Enviando…' : 'Enviar prueba'}
                                </Button>
                            </Box>
                        </SectionCard>
                    </Box>

                    <SectionCard title="Así llega" subtitle={<><strong>Asunto:</strong> {asunto || 'Sin asunto'}</>}>
                        {!campaniaId && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Estás viendo la plantilla sin datos: las variables aparecen como {'{{nombre}}'}. Elegí una campaña para ver cómo le llega a un contacto.
                            </Alert>
                        )}
                        {cargandoContactos ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
                        ) : (
                            <VistaPreviaEmail html={html} titulo={`Vista previa de ${plantilla?.nombre ?? 'la plantilla'}`} />
                        )}
                    </SectionCard>
                </Box>
            )}
        </PageContainer>
    );
}
