import { useCallback, useEffect, useState } from 'react';
import {
    Alert, Box, Button, CircularProgress, IconButton, InputAdornment, Paper, Skeleton, TextField, Typography,
} from '@mui/material';
import { Eye, EyeOff, Mail, Plus, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import {
    BloqueEstado, ConfirmDialog, EmptyState, PageContainer, PageHeader, ResponsiveDialog, SectionCard, StatusChip,
} from '../ui';
import MenuMas from '../admin/MenuMas';

const FORM_VACIO = { nombre: '', host: '', puerto: 587, usuario: '', password: '', remitente: '', emailFrom: '' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NOMBRES_DNS = {
    spf: 'SPF (Sender Policy Framework)',
    dkim: 'DKIM (DomainKeys Identified Mail)',
    dmarc: 'DMARC (Domain-based Message Authentication, Reporting & Conformance)',
};

// El resultado de la última prueba de cada cuenta vive en el navegador: el backend no lo guarda.
function leerPruebas() {
    try {
        const parsed = JSON.parse(localStorage.getItem('smtpTestResultados') || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
        /* JSON roto o storage bloqueado: se arranca sin historial */
    }
    return {};
}

function guardarPruebas(valor) {
    try {
        localStorage.setItem('smtpTestResultados', JSON.stringify(valor));
    } catch {
        /* storage bloqueado: el resultado queda sólo en memoria */
    }
}

function validar(f) {
    const e = {};
    if (!f.nombre.trim()) e.nombre = 'Poné un nombre para reconocer la cuenta.';
    if (!f.host.trim()) e.host = 'Falta el servidor (host).';
    const puerto = Number(f.puerto);
    if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) e.puerto = 'Un puerto entre 1 y 65535.';
    if (!f.usuario.trim()) e.usuario = 'Falta el usuario.';
    if (!f.password) e.password = 'Falta la contraseña.';
    if (!f.remitente.trim()) e.remitente = 'Falta el nombre que va a ver quien recibe.';
    if (!EMAIL_RE.test(f.emailFrom.trim())) e.emailFrom = 'Escribí un email válido.';
    return e;
}

function EstadoPrueba({ resultado }) {
    if (resultado === 'ok') return <StatusChip label="Conexión probada" tono="ok" />;
    if (resultado === 'error') return <StatusChip label="Falló la prueba" tono="error" />;
    return <StatusChip label="Sin probar" tono="neutro" />;
}

export default function CuentasSMTP() {
    const feedback = useFeedback();
    const [cuentas, setCuentas] = useState([]);
    const [estado, setEstado] = useState('cargando');
    const [validaciones, setValidaciones] = useState({});
    const [verificando, setVerificando] = useState({});
    const [pruebas, setPruebas] = useState(leerPruebas);
    const [probandoId, setProbandoId] = useState(null);
    const [detalle, setDetalle] = useState(null); // { cuenta, datos }
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(FORM_VACIO);
    const [errores, setErrores] = useState({});
    const [errorGuardar, setErrorGuardar] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [verPassword, setVerPassword] = useState(false);
    const [porEliminar, setPorEliminar] = useState(null);
    const [eliminando, setEliminando] = useState(false);

    const verificarDominio = useCallback(async (id) => {
        setVerificando((p) => ({ ...p, [id]: true }));
        try {
            const res = await api.get(`/email/cuentas/${id}/verificar-dominio`);
            setValidaciones((p) => ({ ...p, [id]: res.data }));
        } catch {
            setValidaciones((p) => ({ ...p, [id]: { error: 'No se pudo consultar el DNS del dominio.' } }));
        } finally {
            setVerificando((p) => ({ ...p, [id]: false }));
        }
    }, []);

    const fetchCuentas = useCallback(async () => {
        setEstado((e) => (e === 'listo' ? e : 'cargando'));
        try {
            const res = await api.get('/email/cuentas');
            const lista = Array.isArray(res.data) ? res.data : [];
            setCuentas(lista);
            setEstado('listo');
            lista.forEach((c) => verificarDominio(c.id));
        } catch {
            setEstado('error');
        }
    }, [verificarDominio]);

    useEffect(() => {
        fetchCuentas();
    }, [fetchCuentas]);

    const actualizarPrueba = (id, resultado) => {
        setPruebas((prev) => {
            const nuevo = { ...prev };
            if (resultado) nuevo[id] = resultado;
            else delete nuevo[id];
            guardarPruebas(nuevo);
            return nuevo;
        });
    };

    const probar = async (cuenta) => {
        setProbandoId(cuenta.id);
        actualizarPrueba(cuenta.id, null);
        try {
            await api.get(`/email/cuentas/${cuenta.id}/test`);
            actualizarPrueba(cuenta.id, 'ok');
            feedback.exito(`La conexión de "${cuenta.nombre}" funciona.`);
        } catch (err) {
            actualizarPrueba(cuenta.id, 'error');
            feedback.error(mensajeDeError(err, 'No se pudo conectar con el servidor de correo.'));
        } finally {
            setProbandoId(null);
        }
    };

    const abrirCrear = () => {
        setForm(FORM_VACIO);
        setErrores({});
        setErrorGuardar('');
        setVerPassword(false);
        setModalOpen(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((p) => ({ ...p, [name]: value }));
        setErrores((p) => (p[name] ? { ...p, [name]: undefined } : p));
    };

    const handleSubmit = async () => {
        const e = validar(form);
        setErrores(e);
        if (Object.keys(e).length > 0) return;
        setErrorGuardar('');
        setGuardando(true);
        try {
            await api.post('/email/cuentas', { ...form, puerto: Number(form.puerto), emailFrom: form.emailFrom.trim() });
            setModalOpen(false);
            feedback.exito('Cuenta de email creada.');
            fetchCuentas();
        } catch (err) {
            setErrorGuardar(mensajeDeError(err, 'No se pudo crear la cuenta de email.'));
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async () => {
        setEliminando(true);
        try {
            await api.delete(`/email/cuentas/${porEliminar.id}`);
            setCuentas((prev) => prev.filter((c) => c.id !== porEliminar.id));
            actualizarPrueba(porEliminar.id, null);
            feedback.exito('Cuenta de email eliminada.');
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo eliminar la cuenta.'));
        } finally {
            setEliminando(false);
            setPorEliminar(null);
        }
    };

    const sucio = JSON.stringify(form) !== JSON.stringify(FORM_VACIO);

    return (
        <PageContainer>
            <PageHeader
                title="Cuentas de email"
                subtitle="Las cuentas SMTP desde las que salen las campañas y los envíos manuales."
                breadcrumbs={migasDe('/email/cuentas')}
                actions={
                    <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={abrirCrear}>
                        Nueva cuenta
                    </Button>
                }
            />

            {estado === 'error' && <BloqueEstado estado="error" mensaje="No se pudieron cargar las cuentas." onReintentar={fetchCuentas} />}

            {estado === 'cargando' && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
                    {[0, 1, 2].map((i) => (
                        <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: '14px' }}>
                            <Skeleton width="50%" height={28} />
                            <Skeleton width="85%" />
                            <Skeleton width="70%" />
                            <Skeleton variant="rounded" width={140} height={36} sx={{ mt: 2 }} />
                        </Paper>
                    ))}
                </Box>
            )}

            {estado === 'listo' && cuentas.length === 0 && (
                <SectionCard>
                    <EmptyState
                        icon={Mail}
                        title="Todavía no hay cuentas de email"
                        description="Agregá una cuenta SMTP para empezar a enviar campañas por correo electrónico."
                        action={{ label: 'Nueva cuenta', onClick: abrirCrear }}
                    />
                </SectionCard>
            )}

            {estado === 'listo' && cuentas.length > 0 && (
                <Box
                    component="ul"
                    sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}
                >
                    {cuentas.map((cuenta) => {
                        const dns = validaciones[cuenta.id];
                        return (
                            <Paper
                                component="li"
                                key={cuenta.id}
                                variant="outlined"
                                sx={{ borderRadius: '14px', p: 2, display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}
                            >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                                    <Typography component="h2" sx={{ fontWeight: 650, fontSize: 16, overflowWrap: 'anywhere' }}>
                                        {cuenta.nombre}
                                    </Typography>
                                    <EstadoPrueba resultado={pruebas[cuenta.id]} />
                                </Box>

                                <Box component="dl" sx={{ m: 0, display: 'grid', gap: 0.75, fontSize: 13.5 }}>
                                    <Box>
                                        <Box component="dt" sx={{ fontSize: 12, color: 'text.secondary' }}>Servidor</Box>
                                        <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>{cuenta.host}:{cuenta.puerto}</Box>
                                    </Box>
                                    <Box>
                                        <Box component="dt" sx={{ fontSize: 12, color: 'text.secondary' }}>Usuario</Box>
                                        <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>{cuenta.usuario}</Box>
                                    </Box>
                                    <Box>
                                        <Box component="dt" sx={{ fontSize: 12, color: 'text.secondary' }}>Remitente</Box>
                                        <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>{cuenta.remitente} ({cuenta.emailFrom})</Box>
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', minHeight: 28 }}>
                                    {verificando[cuenta.id] ? (
                                        <>
                                            <CircularProgress size={14} />
                                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>Verificando dominio…</Typography>
                                        </>
                                    ) : dns?.error && !dns.spf ? (
                                        <StatusChip label="No se pudo verificar el dominio" tono="aviso" />
                                    ) : dns ? (
                                        ['spf', 'dkim', 'dmarc'].map((t) => (
                                            <StatusChip
                                                key={t}
                                                label={`${t.toUpperCase()} ${dns[t]?.valido === true ? 'ok' : 'falta'}`}
                                                tono={dns[t]?.valido === true ? 'ok' : 'aviso'}
                                            />
                                        ))
                                    ) : null}
                                </Box>

                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, mt: 'auto', pt: 1, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
                                    {dns && !verificando[cuenta.id] && (
                                        <Button onClick={() => setDetalle({ cuenta, datos: dns })} sx={{ minHeight: { xs: 44, md: 36 } }}>
                                            Ver detalle DNS
                                        </Button>
                                    )}
                                    <Button
                                        variant="outlined"
                                        onClick={() => probar(cuenta)}
                                        disabled={probandoId === cuenta.id}
                                        startIcon={probandoId === cuenta.id ? <CircularProgress size={16} /> : null}
                                        sx={{ minHeight: { xs: 44, md: 36 } }}
                                    >
                                        {probandoId === cuenta.id ? 'Probando…' : 'Probar conexión'}
                                    </Button>
                                    <MenuMas items={[{ label: 'Eliminar', icon: Trash2, peligro: true, onClick: () => setPorEliminar(cuenta) }]} />
                                </Box>
                            </Paper>
                        );
                    })}
                </Box>
            )}

            <ResponsiveDialog
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                sucio={sucio && !guardando}
                title="Nueva cuenta de email"
                actions={
                    <>
                        <Button onClick={() => setModalOpen(false)} disabled={guardando}>Cancelar</Button>
                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={guardando}
                            startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : null}
                        >
                            {guardando ? 'Guardando…' : 'Guardar cuenta'}
                        </Button>
                    </>
                }
            >
                <Box component="form" noValidate autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
                    {errorGuardar && <Alert severity="error" role="alert">{errorGuardar}</Alert>}
                    <TextField fullWidth label="Nombre" name="nombre" value={form.nombre} onChange={handleChange} required
                        error={!!errores.nombre} helperText={errores.nombre ?? 'Para reconocerla en las campañas. Ej: Cobranzas'} />
                    {/* Host y puerto: una columna en el celular, dos desde sm. */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2 }}>
                        <TextField fullWidth label="Host" name="host" value={form.host} onChange={handleChange} required
                            error={!!errores.host} helperText={errores.host ?? 'Ej: smtp.empresa.com'} />
                        <TextField fullWidth label="Puerto" name="puerto" type="number" value={form.puerto} onChange={handleChange} required
                            error={!!errores.puerto} helperText={errores.puerto} slotProps={{ htmlInput: { inputMode: 'numeric', min: 1, max: 65535 } }} />
                    </Box>
                    <TextField fullWidth label="Usuario" name="usuario" value={form.usuario} onChange={handleChange} required
                        error={!!errores.usuario} helperText={errores.usuario} slotProps={{ htmlInput: { autoCapitalize: 'off', autoCorrect: 'off' } }} />
                    <TextField
                        fullWidth
                        label="Contraseña"
                        name="password"
                        type={verPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={handleChange}
                        required
                        error={!!errores.password}
                        helperText={errores.password}
                        slotProps={{
                            input: {
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setVerPassword((p) => !p)} edge="end" aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} sx={{ width: 44, height: 44 }}>
                                            {verPassword ? <EyeOff size={18} strokeWidth={1.75} aria-hidden /> : <Eye size={18} strokeWidth={1.75} aria-hidden />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />
                    <TextField fullWidth label="Nombre del remitente" name="remitente" value={form.remitente} onChange={handleChange} required
                        error={!!errores.remitente} helperText={errores.remitente ?? 'Lo que ve quien recibe el correo como remitente.'} />
                    <TextField fullWidth label="Email del remitente" name="emailFrom" type="email" value={form.emailFrom} onChange={handleChange} required
                        error={!!errores.emailFrom} helperText={errores.emailFrom} slotProps={{ htmlInput: { inputMode: 'email', autoCapitalize: 'off' } }} />
                </Box>
            </ResponsiveDialog>

            <ResponsiveDialog
                open={!!detalle}
                onClose={() => setDetalle(null)}
                cerrarConFondo
                title={`Dominio de ${detalle?.cuenta?.nombre ?? ''}`}
                actions={<Button onClick={() => setDetalle(null)}>Cerrar</Button>}
            >
                {detalle?.datos?.error && !detalle.datos.spf ? (
                    <Alert severity="error">{detalle.datos.error}</Alert>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {detalle?.datos?.dominio && (
                            <Typography variant="body2"><b>Dominio:</b> {detalle.datos.dominio}</Typography>
                        )}
                        {['spf', 'dkim', 'dmarc'].map((key) => {
                            const val = detalle?.datos?.[key];
                            if (!val) return null;
                            return (
                                <Paper key={key} variant="outlined" sx={{ p: 2, borderRadius: '14px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                                        <Typography sx={{ fontWeight: 650, fontSize: 14 }}>{NOMBRES_DNS[key]}</Typography>
                                        <StatusChip label={val.valido ? 'Configurado' : 'Falta configurar'} tono={val.valido ? 'ok' : 'aviso'} />
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                        {val.valor || val.sugerencia || 'Sin información'}
                                    </Typography>
                                </Paper>
                            );
                        })}
                    </Box>
                )}
            </ResponsiveDialog>

            <ConfirmDialog
                open={!!porEliminar}
                titulo="¿Eliminar la cuenta de email?"
                mensaje={`Se elimina "${porEliminar?.nombre ?? ''}" (${porEliminar?.usuario ?? ''}). Las campañas que la usan van a necesitar otra cuenta. No se puede deshacer.`}
                confirmarTexto="Eliminar"
                peligro
                cargando={eliminando}
                onConfirmar={eliminar}
                onCancelar={() => setPorEliminar(null)}
            />
        </PageContainer>
    );
}
