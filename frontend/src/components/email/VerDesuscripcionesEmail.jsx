import { useCallback, useEffect, useState } from 'react';
import {
    Box, Button, CircularProgress, FormControl, FormControlLabel, FormLabel, IconButton, InputAdornment, Radio, RadioGroup,
    TablePagination, TextField,
} from '@mui/material';
import { MailX, Plus, Search, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import {
    BloqueEstado, ConfirmDialog, DataTableResponsive, EmptyState, PageContainer, PageHeader, ResponsiveDialog, SectionCard, StatusChip,
} from '../ui';
import { REGEX_EMAIL } from '../plantillas/variablesEmail';

// Los motivos y las fuentes que guarda el backend, en castellano. Lo que no está acá se muestra tal cual.
const MOTIVO = { admin_add: 'Agregada por un operador', unsubscribe_link: 'Tocó el link de baja', user_request: 'Lo pidió el destinatario' };
const FUENTE = { manual: 'Carga manual', link: 'Link del mail', webhook: 'Aviso del proveedor' };

const fecha = (f) => (f ? new Date(f).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function VerDesuscripcionesEmail({ tenantId, pageSizeDefault = 25 }) {
    const feedback = useFeedback();
    const [params, setParams] = useSearchParams();
    const busquedaUrl = params.get('q') ?? '';

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(pageSizeDefault);
    const [texto, setTexto] = useState(busquedaUrl);
    const [loading, setLoading] = useState(true);
    const [errorCarga, setErrorCarga] = useState(null);

    const [aEliminar, setAEliminar] = useState(null);
    const [eliminando, setEliminando] = useState(false);
    const [limpiarAbierto, setLimpiarAbierto] = useState(false);
    const [totalGlobal, setTotalGlobal] = useState(null);
    const [limpiando, setLimpiando] = useState(false);

    const [agregarAbierto, setAgregarAbierto] = useState(false);
    const [addEmail, setAddEmail] = useState('');
    const [addAlcance, setAddAlcance] = useState('global');
    const [addCampania, setAddCampania] = useState('');
    const [errorAgregar, setErrorAgregar] = useState('');
    const [guardando, setGuardando] = useState(false);

    const opcionesTenant = tenantId ? { tenantId } : undefined;

    // La búsqueda va a la URL con un retraso: no se pide al servidor en cada tecla.
    useEffect(() => {
        const t = setTimeout(() => {
            const q = texto.trim();
            if (q === busquedaUrl) return;
            const nuevo = new URLSearchParams(params);
            if (q) nuevo.set('q', q);
            else nuevo.delete('q');
            setParams(nuevo, { replace: true });
            setPage(0);
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [texto]);

    const cargar = useCallback(async () => {
        setLoading(true);
        setErrorCarga(null);
        try {
            const query = { page, size: rowsPerPage };
            if (busquedaUrl) query.q = busquedaUrl;
            if (tenantId) query.tenantId = tenantId;
            const { data } = await api.get('/email/desuscripciones/unsubscribes', { params: query });
            setRows(data.items || []);
            setTotal(data.total ?? 0);
        } catch (err) {
            setErrorCarga(mensajeDeError(err, 'No se pudieron cargar las desuscripciones.'));
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, busquedaUrl, tenantId]);

    useEffect(() => { cargar(); }, [cargar]);

    const eliminar = async () => {
        setEliminando(true);
        try {
            await api.delete(`/email/desuscripciones/unsubscribes/${aEliminar.id}`, { params: opcionesTenant });
            feedback.exito(`Se quitó la baja de ${aEliminar.email}.`);
            const ultimaPagina = Math.max(0, Math.ceil((total - 1) / rowsPerPage) - 1);
            if (page > ultimaPagina) setPage(ultimaPagina);
            setAEliminar(null);
            await cargar();
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo quitar la baja.'));
        } finally {
            setEliminando(false);
        }
    };

    // "Limpiar todas" vuelve a habilitar el envío a toda esa gente: se cuenta cuántas son antes de pedir confirmación
    // (el total de la lista puede estar filtrado por la búsqueda).
    const abrirLimpiar = async () => {
        setTotalGlobal(null);
        setLimpiarAbierto(true);
        try {
            const { data } = await api.get('/email/desuscripciones/unsubscribes', { params: { page: 0, size: 1, ...(tenantId ? { tenantId } : {}) } });
            setTotalGlobal(data.total ?? 0);
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo contar las desuscripciones.'));
            setLimpiarAbierto(false);
        }
    };

    const limpiarTodas = async () => {
        setLimpiando(true);
        try {
            await api.delete('/email/desuscripciones/unsubscribes', { params: opcionesTenant });
            feedback.exito('Se quitaron todas las bajas.');
            setLimpiarAbierto(false);
            setPage(0);
            await cargar();
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudieron quitar las bajas.'));
        } finally {
            setLimpiando(false);
        }
    };

    const cerrarAgregar = () => {
        setAgregarAbierto(false);
        setAddEmail('');
        setAddAlcance('global');
        setAddCampania('');
        setErrorAgregar('');
    };

    const agregar = async () => {
        const email = addEmail.trim();
        if (!REGEX_EMAIL.test(email)) {
            setErrorAgregar('Escribí un email válido, por ejemplo usuario@dominio.com.');
            return;
        }
        if (addAlcance === 'campaign' && !addCampania.trim()) {
            setErrorAgregar('Escribí el número de la campaña.');
            return;
        }
        setGuardando(true);
        setErrorAgregar('');
        try {
            await api.post(
                '/email/desuscripciones/unsubscribes',
                { email, scope: addAlcance, reason: 'admin_add', source: 'manual', campaignId: addAlcance === 'campaign' ? addCampania.trim() : '' },
                { params: opcionesTenant },
            );
            feedback.exito(`${email} ya no va a recibir mails.`);
            cerrarAgregar();
            setPage(0);
            await cargar();
        } catch (err) {
            setErrorAgregar(mensajeDeError(err, 'No se pudo agregar la baja.'));
        } finally {
            setGuardando(false);
        }
    };

    const columnas = [
        { key: 'email', label: 'Email', primary: true, render: (r) => <Box sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{r.email}</Box> },
        {
            key: 'alcance',
            label: 'Alcance',
            secondary: true,
            render: (r) => (r.scope === 'campaign'
                ? <StatusChip tono="info" label={`Campaña ${r.campaignId || '—'}`} />
                : <StatusChip tono="neutro" label="Global" />),
        },
        { key: 'reason', label: 'Motivo', render: (r) => MOTIVO[r.reason] ?? r.reason ?? '—' },
        { key: 'source', label: 'Origen', hideBelow: 'lg', render: (r) => FUENTE[r.source] ?? r.source ?? '—' },
        { key: 'createdAt', label: 'Fecha', render: (r) => fecha(r.createdAt) },
    ];

    return (
        <PageContainer>
            <PageHeader
                title="Desuscripciones"
                subtitle="Las direcciones que no reciben más mails, de todas las campañas o de una sola."
                breadcrumbs={migasDe('/email/desuscripciones')}
                actions={
                    <>
                        <Button variant="outlined" color="error" startIcon={<Trash2 size={18} strokeWidth={1.75} aria-hidden />} onClick={abrirLimpiar} disabled={total === 0 && !busquedaUrl}>
                            Limpiar todas
                        </Button>
                        <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={() => setAgregarAbierto(true)}>
                            Agregar
                        </Button>
                    </>
                }
            />

            <TextField
                size="small"
                fullWidth
                placeholder="Buscar por email"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                inputProps={{ 'aria-label': 'Buscar desuscripciones por email' }}
                InputProps={{
                    startAdornment: <InputAdornment position="start"><Search size={18} strokeWidth={1.75} aria-hidden /></InputAdornment>,
                    endAdornment: texto ? (
                        <InputAdornment position="end">
                            <IconButton aria-label="Borrar la búsqueda" onClick={() => setTexto('')} sx={{ width: 44, height: 44, mr: -1 }}>
                                <X size={18} strokeWidth={1.75} aria-hidden />
                            </IconButton>
                        </InputAdornment>
                    ) : null,
                }}
                sx={{ mb: 2, maxWidth: { sm: 400 } }}
            />

            {errorCarga ? (
                <BloqueEstado estado="error" mensaje={errorCarga} onReintentar={cargar} />
            ) : (
                <SectionCard noPadding>
                    <DataTableResponsive
                        ariaLabel="Desuscripciones"
                        columns={columnas}
                        rows={rows}
                        loading={loading}
                        acciones={(r) => (
                            <Button color="error" size="small" startIcon={<Trash2 size={16} strokeWidth={1.75} aria-hidden />} onClick={() => setAEliminar(r)} sx={{ minHeight: { xs: 44, md: 32 } }}>
                                Quitar baja
                            </Button>
                        )}
                        empty={
                            <EmptyState
                                compact
                                icon={MailX}
                                title={busquedaUrl ? 'No hay bajas con ese email' : 'Nadie se dio de baja'}
                                description={busquedaUrl ? 'Probá con otra búsqueda.' : 'Cuando alguien toque «Desuscribirme» en un mail, aparece acá.'}
                            />
                        }
                    />
                    {total > 0 && (
                        <TablePagination
                            component="div"
                            count={total}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(e) => {
                                setRowsPerPage(parseInt(e.target.value, 10));
                                setPage(0);
                            }}
                            rowsPerPageOptions={[10, 25, 50, 100]}
                            labelRowsPerPage="Filas"
                            sx={{ borderTop: 1, borderColor: 'divider', '.MuiTablePagination-toolbar': { px: { xs: 0.5, sm: 2 } } }}
                        />
                    )}
                </SectionCard>
            )}

            <ConfirmDialog
                open={!!aEliminar}
                peligro
                cargando={eliminando}
                titulo="¿Quitar la baja?"
                mensaje={<><strong>{aEliminar?.email}</strong> va a volver a recibir mails{aEliminar?.scope === 'campaign' ? ` de la campaña ${aEliminar?.campaignId ?? ''}` : ' de todas las campañas'}.</>}
                confirmarTexto="Quitar baja"
                onConfirmar={eliminar}
                onCancelar={() => setAEliminar(null)}
            />

            <ConfirmDialog
                open={limpiarAbierto}
                peligro
                cargando={limpiando}
                titulo="¿Quitar todas las bajas?"
                mensaje={
                    totalGlobal === null
                        ? 'Contando…'
                        : <>Se van a quitar <strong>{totalGlobal.toLocaleString('es-AR')}</strong> {totalGlobal === 1 ? 'baja' : 'bajas'}. Esas personas pidieron no recibir más mails y <strong>van a volver a recibirlos</strong> en la próxima campaña. No se puede deshacer.</>
                }
                textoATipear="limpiar"
                confirmarTexto="Quitar todas"
                onConfirmar={limpiarTodas}
                onCancelar={() => setLimpiarAbierto(false)}
            />

            <ResponsiveDialog
                open={agregarAbierto}
                onClose={cerrarAgregar}
                maxWidth="xs"
                sucio={!!addEmail.trim() && !guardando}
                title="Agregar una baja"
                actions={
                    <>
                        <Button onClick={cerrarAgregar} disabled={guardando}>Cancelar</Button>
                        <Button variant="contained" onClick={agregar} disabled={guardando} startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : undefined}>
                            Guardar
                        </Button>
                    </>
                }
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        fullWidth
                        autoFocus
                        label="Email"
                        type="email"
                        value={addEmail}
                        onChange={(e) => {
                            setAddEmail(e.target.value);
                            setErrorAgregar('');
                        }}
                        placeholder="usuario@dominio.com"
                        inputProps={{ autoCapitalize: 'off', inputMode: 'email' }}
                        error={!!errorAgregar && !REGEX_EMAIL.test(addEmail.trim())}
                        helperText={errorAgregar && !REGEX_EMAIL.test(addEmail.trim()) ? errorAgregar : undefined}
                    />

                    <FormControl>
                        <FormLabel id="alcance-baja">Alcance</FormLabel>
                        <RadioGroup aria-labelledby="alcance-baja" value={addAlcance} onChange={(_, v) => setAddAlcance(v)}>
                            <FormControlLabel value="global" control={<Radio />} label="Global: no recibe mails de ninguna campaña" sx={{ minHeight: 44 }} />
                            <FormControlLabel value="campaign" control={<Radio />} label="Una campaña" sx={{ minHeight: 44 }} />
                        </RadioGroup>
                    </FormControl>

                    {addAlcance === 'campaign' && (
                        <TextField
                            fullWidth
                            label="Número de campaña"
                            value={addCampania}
                            onChange={(e) => setAddCampania(e.target.value)}
                            inputProps={{ inputMode: 'numeric' }}
                        />
                    )}

                    {errorAgregar && REGEX_EMAIL.test(addEmail.trim()) && (
                        <Box role="alert" sx={{ color: 'error.main', fontSize: 14 }}>{errorAgregar}</Box>
                    )}
                </Box>
            </ResponsiveDialog>
        </PageContainer>
    );
}
