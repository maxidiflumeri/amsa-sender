import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, Chip, CircularProgress, Divider, FormControl, FormControlLabel, InputAdornment, InputLabel,
    MenuItem, Paper, Select, Switch, TextField, Typography,
} from '@mui/material';
import { RefreshCw, Search, Settings2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import {
    BloqueEstado, EmptyState, PageContainer, PageHeader, ResponsiveDialog, StatusChip, WaBurbuja, formatoWhatsApp,
} from '../ui';

// Estados de Meta traducidos, con el tono de su chip (antes: Aprobado/Rechazado en inglés mezclado con íconos sueltos).
const ESTADO = {
    APPROVED: { label: 'Aprobada', tono: 'ok' },
    PENDING: { label: 'Pendiente', tono: 'aviso' },
    REJECTED: { label: 'Rechazada', tono: 'error' },
    PAUSED: { label: 'Pausada', tono: 'neutro' },
};

const CATEGORIA = { MARKETING: 'Marketing', UTILITY: 'Utilidad', AUTHENTICATION: 'Autenticación' };

const ACCIONES = [
    { value: 'INBOX', label: 'Derivar a Conversaciones (hablar con un asesor)' },
    { value: 'BAJA', label: 'Registrar como baja' },
    { value: 'IGNORAR', label: 'Ignorar (no hacer nada)' },
];
const ACCION_CORTA = { INBOX: 'Conversaciones', BAJA: 'Baja', IGNORAR: 'Ignorar' };

/** Extrae los botones de respuesta rápida de los componentes de la plantilla. */
function extraerBotonesQR(componentes) {
    if (!Array.isArray(componentes)) return [];
    const comp = componentes.find((c) => c.type === 'BUTTONS');
    return (comp?.buttons || []).filter((b) => b.type === 'QUICK_REPLY');
}

/** La plantilla tal como la ve quien la recibe: una sola burbuja de WhatsApp, con sus botones. */
function VistaPlantilla({ componentes }) {
    if (!Array.isArray(componentes)) return null;
    const header = componentes.find((c) => c.type === 'HEADER');
    const body = componentes.find((c) => c.type === 'BODY');
    const footer = componentes.find((c) => c.type === 'FOOTER');
    const botones = componentes.find((c) => c.type === 'BUTTONS')?.buttons?.map((b) => b.text).filter(Boolean);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <WaBurbuja direccion="saliente" botones={botones} sx={{ maxWidth: '100%', alignSelf: 'flex-start' }}>
                {header?.format === 'TEXT' && <Box sx={{ fontWeight: 700, mb: 0.5 }}>{header.text}</Box>}
                {header && header.format !== 'TEXT' && (
                    <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1, mb: 0.5, textAlign: 'center', fontSize: 12, color: 'text.secondary' }}>
                        {{ IMAGE: 'Imagen', VIDEO: 'Video', DOCUMENT: 'Documento' }[header.format] ?? header.format}
                    </Box>
                )}
                {body?.text ? formatoWhatsApp(body.text) : null}
                {footer?.text && <Box sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.5 }}>{footer.text}</Box>}
            </WaBurbuja>
        </Box>
    );
}

/** Qué hace cada botón de respuesta rápida cuando el deudor lo toca. */
function DialogAccionesBotones({ open, plantilla, onClose, onGuardado }) {
    const feedback = useFeedback();
    const botonesQR = useMemo(() => (plantilla ? extraerBotonesQR(plantilla.componentes) : []), [plantilla]);
    const inicial = useMemo(() => {
        const existentes = plantilla?.buttonActions ?? [];
        return botonesQR.map((btn, i) => {
            const guardado = existentes.find((a) => a.indice === i) || {};
            return {
                indice: i,
                texto: btn.text,
                payload: guardado.payload ?? `BTN_${i + 1}`,
                accion: guardado.accion ?? 'INBOX',
                enviarConfirmacion: guardado.enviarConfirmacion ?? false,
            };
        });
    }, [plantilla, botonesQR]);

    const [acciones, setAcciones] = useState([]);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open && plantilla) {
            setAcciones(inicial);
            setError('');
        }
    }, [open, plantilla, inicial]);

    // Para avisar antes de descartar: compara contra lo que había al abrir.
    const sucio = JSON.stringify(acciones) !== JSON.stringify(inicial);

    const cambiar = (i, campo, valor) => setAcciones((prev) => prev.map((a, idx) => (idx === i ? { ...a, [campo]: valor } : a)));

    const guardar = async () => {
        setGuardando(true);
        setError('');
        try {
            await api.patch(`/wapi/templates/${plantilla.id}/button-actions`, { buttonActions: acciones });
            feedback.exito('Configuración de los botones guardada.');
            await onGuardado();
            onClose();
        } catch (err) {
            // El error queda adentro del diálogo, donde se está mirando.
            setError(mensajeDeError(err, 'No se pudo guardar. Probá de nuevo.'));
        } finally {
            setGuardando(false);
        }
    };

    if (!plantilla) return null;

    return (
        <ResponsiveDialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            sucio={sucio}
            title={<>Configurar botones · <em>{plantilla.metaNombre}</em></>}
            actions={
                <>
                    <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={guardar}
                        disabled={guardando || botonesQR.length === 0}
                        startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : undefined}
                    >
                        Guardar
                    </Button>
                </>
            }
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {error && <Alert severity="error">{error}</Alert>}

                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Así la recibe el deudor</Typography>
                    <VistaPlantilla componentes={plantilla.componentes} />
                </Box>

                <Divider />

                {botonesQR.length === 0 && <Alert severity="info">Esta plantilla no tiene botones de respuesta rápida.</Alert>}

                {acciones.map((accion, i) => (
                    <Box key={accion.indice} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
                        <Typography sx={{ fontWeight: 650, fontSize: 14, mb: 1.5 }}>Botón {i + 1}: «{accion.texto}»</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id={`accion-${i}`}>Qué pasa cuando lo toca</InputLabel>
                                <Select
                                    labelId={`accion-${i}`}
                                    value={accion.accion}
                                    label="Qué pasa cuando lo toca"
                                    onChange={(e) => cambiar(i, 'accion', e.target.value)}
                                >
                                    {ACCIONES.map((a) => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
                                </Select>
                            </FormControl>

                            <TextField
                                label="Payload del botón"
                                size="small"
                                fullWidth
                                value={accion.payload}
                                onChange={(e) => cambiar(i, 'payload', e.target.value)}
                                helperText="Usá {{1}}, {{2}}… (variables de la plantilla) o {{nombre_columna}} (columna del CSV). Ej: INBOX|ref={{nro_cliente}}"
                                inputProps={{ maxLength: 128 }}
                            />

                            {accion.accion === 'BAJA' && (
                                <FormControlLabel
                                    sx={{ minHeight: 44 }}
                                    control={<Switch checked={accion.enviarConfirmacion} onChange={(e) => cambiar(i, 'enviarConfirmacion', e.target.checked)} />}
                                    label={<Typography sx={{ fontSize: 14 }}>Enviar mensaje de confirmación de la baja</Typography>}
                                />
                            )}
                        </Box>
                    </Box>
                ))}
            </Box>
        </ResponsiveDialog>
    );
}

export default function WapiTemplates() {
    const feedback = useFeedback();
    const [params, setParams] = useSearchParams();
    // La línea y la búsqueda están en la URL: el atrás del celular vuelve a donde estaba.
    const configId = params.get('linea') ?? '';
    const busqueda = params.get('q') ?? '';

    const [plantillas, setPlantillas] = useState([]);
    const [lineas, setLineas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState(null);
    const [sincronizando, setSincronizando] = useState(false);
    const [seleccionada, setSeleccionada] = useState(null);

    const cambiarParam = (clave, valor) => {
        const nuevo = new URLSearchParams(params);
        if (valor) nuevo.set(clave, valor);
        else nuevo.delete(clave);
        setParams(nuevo, { replace: true });
    };

    useEffect(() => {
        api.get('/wapi/config')
            .then((res) => setLineas(Array.isArray(res.data) ? res.data : []))
            .catch((err) => feedback.error(mensajeDeError(err, 'No se pudieron cargar las líneas.')));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cargar = useCallback(async () => {
        setCargando(true);
        setErrorCarga(null);
        try {
            const res = await api.get(configId ? `/wapi/templates?configId=${configId}` : '/wapi/templates');
            setPlantillas(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setErrorCarga(mensajeDeError(err, 'No se pudieron cargar las plantillas.'));
        } finally {
            setCargando(false);
        }
    }, [configId]);

    useEffect(() => { cargar(); }, [cargar]);

    const sincronizar = async () => {
        setSincronizando(true);
        try {
            const res = await api.post(configId ? `/wapi/templates/sincronizar?configId=${configId}` : '/wapi/templates/sincronizar');
            const { sincronizados, errores = [] } = res.data;
            if (errores.length > 0) feedback.aviso(`${sincronizados} sincronizadas, ${errores.length} con error.`);
            else feedback.exito(`${sincronizados} plantillas sincronizadas.`);
            await cargar();
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo sincronizar con Meta.'), { accion: { etiqueta: 'Reintentar', onClick: sincronizar } });
        } finally {
            setSincronizando(false);
        }
    };

    const visibles = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return plantillas;
        return plantillas.filter((p) => p.metaNombre?.toLowerCase().includes(q));
    }, [plantillas, busqueda]);

    return (
        <PageContainer>
            <PageHeader
                title="Plantillas"
                subtitle="Las plantillas aprobadas en Meta para la API de WhatsApp. Sincronizá para traer los últimos cambios."
                breadcrumbs={migasDe('/wapi/templates')}
                actions={
                    <Button
                        variant="contained"
                        onClick={sincronizar}
                        disabled={sincronizando}
                        startIcon={sincronizando ? <CircularProgress size={16} color="inherit" /> : <RefreshCw size={18} strokeWidth={1.75} aria-hidden />}
                    >
                        {sincronizando ? 'Sincronizando…' : 'Sincronizar desde Meta'}
                    </Button>
                }
            />

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 2.5 }}>
                {lineas.length > 0 && (
                    <FormControl size="small" sx={{ minWidth: { sm: 240 } }}>
                        <InputLabel id="filtro-linea">Línea</InputLabel>
                        <Select labelId="filtro-linea" value={configId} label="Línea" onChange={(e) => cambiarParam('linea', e.target.value)}>
                            <MenuItem value="">Todas las líneas</MenuItem>
                            {lineas.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.nombre ?? `Línea ${c.id}`}</MenuItem>)}
                        </Select>
                    </FormControl>
                )}
                <TextField
                    size="small"
                    placeholder="Buscar por nombre"
                    value={busqueda}
                    onChange={(e) => cambiarParam('q', e.target.value)}
                    inputProps={{ 'aria-label': 'Buscar plantillas por nombre' }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} strokeWidth={1.75} aria-hidden /></InputAdornment> }}
                    sx={{ flex: 1, maxWidth: { sm: 360 } }}
                />
            </Box>

            {/* Filtrar o sincronizar no tapa la pantalla con un spinner: las tarjetas quedan y se atenúan. */}
            {errorCarga && <BloqueEstado estado="error" mensaje={errorCarga} onReintentar={cargar} />}
            {cargando && plantillas.length === 0 && !errorCarga && <BloqueEstado estado="cargando" mensaje="Cargando plantillas…" />}

            {!errorCarga && !(cargando && plantillas.length === 0) && visibles.length === 0 && (
                <EmptyState
                    icon={Search}
                    title={busqueda ? 'No hay plantillas con ese nombre' : 'Todavía no hay plantillas'}
                    description={busqueda ? 'Probá con otra búsqueda o cambiá de línea.' : 'Sincronizá desde Meta para traer las plantillas de tu cuenta.'}
                    action={busqueda ? undefined : { label: 'Sincronizar desde Meta', onClick: sincronizar }}
                />
            )}

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
                    gap: 2,
                    opacity: cargando && plantillas.length > 0 ? 0.55 : 1,
                    transition: 'opacity .15s',
                }}
            >
                {visibles.map((tpl) => {
                    const estado = ESTADO[tpl.estado] ?? { label: tpl.estado, tono: 'neutro' };
                    const botonesQR = extraerBotonesQR(tpl.componentes);
                    const acciones = Array.isArray(tpl.buttonActions) ? tpl.buttonActions : [];
                    const motivo = tpl.estado === 'REJECTED' ? (tpl.motivoRechazo ?? tpl.rejectedReason ?? tpl.rechazoMotivo) : null;

                    return (
                        <Paper key={tpl.id} variant="outlined" sx={{ borderRadius: '14px', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                            <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                                    <Typography sx={{ fontWeight: 650, fontSize: 15, overflowWrap: 'anywhere' }}>{tpl.metaNombre}</Typography>
                                    <StatusChip label={estado.label} tono={estado.tono} sx={{ flex: 'none' }} />
                                </Box>

                                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                    <Chip label={CATEGORIA[tpl.categoria] ?? tpl.categoria} size="small" variant="outlined" />
                                    <Chip label={tpl.idioma} size="small" variant="outlined" />
                                </Box>

                                {tpl.estado === 'REJECTED' && (
                                    <Alert severity="error" variant="outlined" sx={{ py: 0 }}>
                                        {motivo ? `Meta la rechazó: ${motivo}` : 'Meta rechazó esta plantilla. Corregila en el administrador de Meta y volvé a sincronizar.'}
                                    </Alert>
                                )}

                                {tpl.estado === 'APPROVED' && <VistaPlantilla componentes={tpl.componentes} />}

                                {botonesQR.length > 0 && (
                                    <Box>
                                        {acciones.length > 0 ? (
                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                {acciones.map((a, i) => (
                                                    <Chip
                                                        key={i}
                                                        size="small"
                                                        variant="outlined"
                                                        color={a.accion === 'BAJA' ? 'error' : a.accion === 'INBOX' ? 'success' : 'default'}
                                                        label={`${a.texto ?? `Botón ${i + 1}`} → ${ACCION_CORTA[a.accion] ?? a.accion}`}
                                                    />
                                                ))}
                                            </Box>
                                        ) : (
                                            <Typography variant="caption" sx={{ color: 'warning.main' }}>Los botones todavía no tienen acción configurada.</Typography>
                                        )}
                                    </Box>
                                )}

                                {tpl.sincronizadoAt && (
                                    <Typography variant="caption" color="text.secondary">
                                        Sincronizada el {new Date(tpl.sincronizadoAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                                    </Typography>
                                )}
                            </Box>

                            {botonesQR.length > 0 && (
                                <Box sx={{ borderTop: 1, borderColor: 'divider', px: 2, py: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
                                        size="small"
                                        startIcon={<Settings2 size={18} strokeWidth={1.75} aria-hidden />}
                                        onClick={() => setSeleccionada(tpl)}
                                        sx={{ minHeight: { xs: 44, sm: 32 } }}
                                    >
                                        {acciones.length > 0 ? 'Reconfigurar botones' : 'Configurar botones'}
                                    </Button>
                                </Box>
                            )}
                        </Paper>
                    );
                })}
            </Box>

            <DialogAccionesBotones open={!!seleccionada} plantilla={seleccionada} onClose={() => setSeleccionada(null)} onGuardado={cargar} />
        </PageContainer>
    );
}
