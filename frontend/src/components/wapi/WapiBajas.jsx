import { useCallback, useEffect, useState } from 'react';
import {
    Alert, Box, Button, CircularProgress, IconButton, InputAdornment, TablePagination, TextField, Typography,
} from '@mui/material';
import { Plus, Search, ShieldOff, Trash2, X } from 'lucide-react';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import {
    ConfirmDialog, DataTableResponsive, EmptyState, PageContainer, PageHeader, ResponsiveDialog, SectionCard, StatusChip,
} from '../ui';
import BloqueEstado from '../ui/BloqueEstado';

const formatFecha = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Formato internacional sin "+": sólo dígitos. El rango deja pasar números de cualquier país.
const NUMERO_RE = /^\d{8,15}$/;

export default function WapiBajas() {
    const feedback = useFeedback();
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [busqueda, setBusqueda] = useState('');
    const [busquedaActiva, setBusquedaActiva] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [nuevoNumero, setNuevoNumero] = useState('');
    const [errorNumero, setErrorNumero] = useState('');
    const [errorAgregar, setErrorAgregar] = useState('');
    const [agregando, setAgregando] = useState(false);

    const [dialogEliminar, setDialogEliminar] = useState(null);
    const [eliminando, setEliminando] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/wapi/bajas', {
                params: { page: page + 1, size: rowsPerPage, q: busquedaActiva || undefined },
            });
            const items = data.items ?? data;
            setRows(items);
            setTotal(data.total ?? items.length);
        } catch (err) {
            setError(mensajeDeError(err, 'No se pudo cargar la lista de bajas.'));
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, busquedaActiva]);

    useEffect(() => { cargar(); }, [cargar]);

    // Busca al tipear con una pequeña espera (o al instante con Enter): no se pide en cada tecla.
    useEffect(() => {
        const t = setTimeout(() => {
            const q = busqueda.trim();
            setBusquedaActiva((prev) => {
                if (prev === q) return prev;
                setPage(0);
                return q;
            });
        }, 400);
        return () => clearTimeout(t);
    }, [busqueda]);

    const buscarYa = () => {
        setPage(0);
        setBusquedaActiva(busqueda.trim());
    };

    const limpiar = () => {
        setBusqueda('');
        setBusquedaActiva('');
        setPage(0);
    };

    const abrirAgregar = () => {
        setNuevoNumero('');
        setErrorNumero('');
        setErrorAgregar('');
        setDialogOpen(true);
    };

    const agregarManual = async () => {
        const numero = nuevoNumero.trim();
        if (!NUMERO_RE.test(numero)) {
            setErrorNumero('Escribí solo dígitos, con código de país y sin "+" (de 8 a 15). Ej: 5491112345678');
            return;
        }
        setErrorNumero('');
        setErrorAgregar('');
        setAgregando(true);
        try {
            await api.post('/wapi/bajas', { numero });
            feedback.exito(`${numero} se agregó a la lista de bajas.`);
            setDialogOpen(false);
            cargar();
        } catch (e) {
            // Dentro del diálogo: es lo que la persona está mirando.
            setErrorAgregar(mensajeDeError(e, 'No se pudo agregar el número a bajas.'));
        } finally {
            setAgregando(false);
        }
    };

    const eliminar = async () => {
        if (!dialogEliminar) return;
        setEliminando(true);
        try {
            await api.delete(`/wapi/bajas/${encodeURIComponent(dialogEliminar)}`);
            feedback.exito(`${dialogEliminar} salió de la lista de bajas.`);
            setDialogEliminar(null);
            cargar();
        } catch (e) {
            feedback.error(mensajeDeError(e, 'No se pudo quitar el número de bajas.'));
            setDialogEliminar(null);
        } finally {
            setEliminando(false);
        }
    };

    const columns = [
        { key: 'numero', label: 'Número', primary: true, render: (r) => <Box component="span" sx={{ fontWeight: 600 }}>{r.numero}</Box> },
        { key: 'creadoAt', label: 'Fecha', secondary: true, render: (r) => formatFecha(r.creadoAt) },
        { key: 'campañaNombre', label: 'Campaña', render: (r) => r.campañaNombre ?? '—' },
        { key: 'templateNombre', label: 'Plantilla', hideBelow: 'lg', render: (r) => r.templateNombre ?? '—' },
        {
            key: 'buttonPayload',
            label: 'Botón tocado',
            hideBelow: 'lg',
            render: (r) => (r.buttonPayload ? <StatusChip label={r.buttonPayload} tono="neutro" /> : <Typography variant="body2" color="text.secondary" component="span">Carga manual</Typography>),
        },
        {
            key: 'confirmacionEnviada',
            label: 'Confirmación',
            render: (r) => <StatusChip label={r.confirmacionEnviada ? 'Enviada' : 'No enviada'} tono={r.confirmacionEnviada ? 'ok' : 'neutro'} />,
        },
    ];

    const hayBusqueda = !!busquedaActiva;

    return (
        <PageContainer>
            <PageHeader
                title="Bajas de WhatsApp"
                subtitle="Los números que pidieron no recibir más mensajes. No se les envía ninguna campaña."
                breadcrumbs={migasDe('/wapi/bajas')}
                actions={
                    <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={abrirAgregar}>
                        Agregar número
                    </Button>
                }
            />

            <Box sx={{ mb: 2, maxWidth: { sm: 420 } }}>
                <TextField
                    fullWidth
                    placeholder="Buscar por número"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscarYa()}
                    slotProps={{
                        htmlInput: { 'aria-label': 'Buscar por número', inputMode: 'search' },
                        input: {
                            startAdornment: <InputAdornment position="start"><Search size={18} strokeWidth={1.75} aria-hidden /></InputAdornment>,
                            endAdornment: busqueda ? (
                                <InputAdornment position="end">
                                    <IconButton aria-label="Limpiar la búsqueda" onClick={limpiar} edge="end" sx={{ width: 44, height: 44 }}>
                                        <X size={18} strokeWidth={1.75} aria-hidden />
                                    </IconButton>
                                </InputAdornment>
                            ) : undefined,
                        },
                    }}
                />
            </Box>

            {error ? (
                <BloqueEstado estado="error" mensaje={error} onReintentar={cargar} />
            ) : (
                <SectionCard noPadding>
                    <DataTableResponsive
                        ariaLabel="Números dados de baja"
                        columns={columns}
                        rows={rows}
                        rowKey={(r) => r.id}
                        loading={loading}
                        acciones={(row) => (
                            <Button
                                color="error"
                                startIcon={<Trash2 size={16} strokeWidth={1.75} aria-hidden />}
                                onClick={() => setDialogEliminar(row.numero)}
                            >
                                Quitar de bajas
                            </Button>
                        )}
                        empty={
                            hayBusqueda ? (
                                <EmptyState
                                    compact
                                    icon={Search}
                                    title="Sin resultados"
                                    description={`No hay ningún número de baja que coincida con "${busquedaActiva}".`}
                                    action={{ label: 'Limpiar la búsqueda', onClick: limpiar }}
                                />
                            ) : (
                                <EmptyState
                                    compact
                                    icon={ShieldOff}
                                    title="No hay bajas"
                                    description="Cuando alguien pida no recibir más mensajes, su número va a aparecer acá. También podés cargar uno a mano."
                                />
                            )
                        }
                    />
                    {!loading && total > 0 && (
                        <TablePagination
                            component="div"
                            count={total}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
                            rowsPerPageOptions={[25, 50, 100]}
                            labelRowsPerPage="Filas:"
                            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                        />
                    )}
                </SectionCard>
            )}

            <ResponsiveDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                maxWidth="xs"
                sucio={!!nuevoNumero && !agregando}
                title="Agregar número a bajas"
                actions={
                    <>
                        <Button onClick={() => setDialogOpen(false)} disabled={agregando}>Cancelar</Button>
                        <Button
                            variant="contained"
                            onClick={agregarManual}
                            disabled={agregando}
                            startIcon={agregando ? <CircularProgress size={16} color="inherit" /> : null}
                        >
                            {agregando ? 'Agregando…' : 'Agregar'}
                        </Button>
                    </>
                }
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
                    {errorAgregar && <Alert severity="error" role="alert">{errorAgregar}</Alert>}
                    <TextField
                        autoFocus
                        fullWidth
                        label="Número"
                        value={nuevoNumero}
                        onChange={(e) => { setNuevoNumero(e.target.value); setErrorNumero(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && agregarManual()}
                        error={!!errorNumero}
                        helperText={errorNumero || 'Formato internacional sin "+". Ej: 5491112345678'}
                        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                    />
                    <Typography variant="body2" color="text.secondary">
                        Desde ese momento no va a recibir más campañas de WhatsApp.
                    </Typography>
                </Box>
            </ResponsiveDialog>

            <ConfirmDialog
                open={!!dialogEliminar}
                titulo="¿Quitar de la lista de bajas?"
                mensaje={<>El número <strong>{dialogEliminar}</strong> va a poder recibir mensajes nuevamente en las próximas campañas.</>}
                confirmarTexto="Quitar de bajas"
                peligro
                cargando={eliminando}
                onConfirmar={eliminar}
                onCancelar={() => setDialogEliminar(null)}
            />
        </PageContainer>
    );
}
