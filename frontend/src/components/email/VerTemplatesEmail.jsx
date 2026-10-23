import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, InputAdornment, TextField } from '@mui/material';
import { Copy, Eye, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import { BloqueEstado, ConfirmDialog, DataTableResponsive, EmptyState, PageContainer, PageHeader, ResponsiveDialog, SectionCard } from '../ui';
import MenuMas from '../plantillas/MenuMas';

const fechaCorta = (f) => (f ? new Date(f).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha');

export default function VerTemplatesEmail() {
    const feedback = useFeedback();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const busqueda = params.get('q') ?? '';

    const [plantillas, setPlantillas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState(null);

    const [aEliminar, setAEliminar] = useState(null);
    const [eliminando, setEliminando] = useState(false);

    const [aDuplicar, setADuplicar] = useState(null);
    const [nombreCopia, setNombreCopia] = useState('');
    const [duplicando, setDuplicando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setErrorCarga(null);
        try {
            const { data } = await api.get('/email/templates');
            setPlantillas(Array.isArray(data) ? data : []);
        } catch (err) {
            setErrorCarga(mensajeDeError(err, 'No se pudieron cargar las plantillas.'));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const cambiarBusqueda = (valor) => {
        const nuevo = new URLSearchParams(params);
        if (valor) nuevo.set('q', valor);
        else nuevo.delete('q');
        setParams(nuevo, { replace: true });
    };

    const eliminar = async () => {
        setEliminando(true);
        try {
            await api.delete(`email/templates/${aEliminar.id}`);
            setPlantillas((prev) => prev.filter((t) => t.id !== aEliminar.id));
            feedback.exito(`Se eliminó la plantilla «${aEliminar.nombre}».`);
            setAEliminar(null);
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo eliminar la plantilla.'));
        } finally {
            setEliminando(false);
        }
    };

    const abrirDuplicar = (t) => {
        setADuplicar(t);
        setNombreCopia(`${t.nombre} (copia)`);
    };

    const duplicar = async () => {
        if (!aDuplicar) return;
        setDuplicando(true);
        try {
            let nueva;
            try {
                ({ data: nueva } = await api.post(`/email/templates/${aDuplicar.id}/duplicate`, { nombre: nombreCopia }));
            } catch {
                // Si el backend no tiene el endpoint de duplicar, se crea una nueva copiando los campos de la original.
                const copia = { ...aDuplicar, nombre: nombreCopia };
                ['id', 'creadoAt', 'actualizadoAt', 'createdAt', 'updatedAt'].forEach((k) => delete copia[k]);
                ({ data: nueva } = await api.post('/email/templates', copia));
            }
            setPlantillas((prev) => [nueva, ...prev]);
            feedback.exito('Plantilla duplicada.');
            setADuplicar(null);
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo duplicar la plantilla.'));
        } finally {
            setDuplicando(false);
        }
    };

    const visibles = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return q ? plantillas.filter((t) => (t.nombre ?? '').toLowerCase().includes(q)) : plantillas;
    }, [plantillas, busqueda]);

    const columnas = [
        { key: 'nombre', label: 'Nombre', primary: true },
        { key: 'asunto', label: 'Asunto', secondary: true, render: (t) => t.asunto || 'Sin asunto' },
        {
            key: 'remitente',
            label: 'Remitente',
            render: (t) => (t.cuentaSmtp
                ? <Chip label={t.cuentaSmtp.nombre} size="small" color="primary" variant="outlined" />
                : <Chip label="Global" size="small" variant="outlined" />),
        },
        { key: 'creadoAt', label: 'Creada', render: (t) => fechaCorta(t.creadoAt) },
    ];

    return (
        <PageContainer>
            <PageHeader
                title="Plantillas de email"
                subtitle="El diseño y el asunto de los mails de tus campañas y de los envíos manuales."
                breadcrumbs={migasDe('/email/templates')}
                actions={
                    <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={() => navigate('/email/crearTemplate')}>
                        Nueva plantilla
                    </Button>
                }
            />

            <TextField
                size="small"
                fullWidth
                placeholder="Buscar por nombre"
                value={busqueda}
                onChange={(e) => cambiarBusqueda(e.target.value)}
                inputProps={{ 'aria-label': 'Buscar plantillas por nombre' }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} strokeWidth={1.75} aria-hidden /></InputAdornment> }}
                sx={{ mb: 2, maxWidth: { sm: 400 } }}
            />

            {errorCarga ? (
                <BloqueEstado estado="error" mensaje={errorCarga} onReintentar={cargar} />
            ) : (
                <SectionCard noPadding>
                    <DataTableResponsive
                        ariaLabel="Plantillas de email"
                        columns={columnas}
                        rows={visibles}
                        loading={cargando}
                        onRowClick={(t) => navigate(`/email/crearTemplate?id=${t.id}`)}
                        acciones={(t) => (
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<Pencil size={16} strokeWidth={1.75} aria-hidden />}
                                    onClick={() => navigate(`/email/crearTemplate?id=${t.id}`)}
                                    sx={{ minHeight: { xs: 44, md: 32 } }}
                                >
                                    Editar
                                </Button>
                                <MenuMas
                                    etiqueta={`Más acciones de ${t.nombre}`}
                                    items={[
                                        { label: 'Ver', icono: Eye, onClick: () => navigate(`/preview-template/${t.id}`) },
                                        { label: 'Duplicar', icono: Copy, onClick: () => abrirDuplicar(t) },
                                        { label: 'Eliminar', icono: Trash2, onClick: () => setAEliminar(t), peligro: true },
                                    ]}
                                />
                            </Box>
                        )}
                        empty={
                            <EmptyState
                                icon={FileText}
                                compact
                                title={busqueda ? 'No hay plantillas con ese nombre' : 'Todavía no hay plantillas de email'}
                                description={busqueda ? 'Probá con otra búsqueda.' : 'Creá la primera para usarla en tus campañas.'}
                                action={busqueda ? undefined : { label: 'Nueva plantilla', onClick: () => navigate('/email/crearTemplate') }}
                            />
                        }
                    />
                </SectionCard>
            )}

            <ConfirmDialog
                open={!!aEliminar}
                peligro
                cargando={eliminando}
                titulo="¿Eliminar la plantilla?"
                mensaje={<>Se va a eliminar <strong>{aEliminar?.nombre}</strong>. No se puede deshacer.</>}
                confirmarTexto="Eliminar"
                onConfirmar={eliminar}
                onCancelar={() => setAEliminar(null)}
            />

            <ResponsiveDialog
                open={!!aDuplicar}
                onClose={() => !duplicando && setADuplicar(null)}
                maxWidth="xs"
                title="Duplicar plantilla"
                actions={
                    <>
                        <Button onClick={() => setADuplicar(null)} disabled={duplicando}>Cancelar</Button>
                        <Button variant="contained" onClick={duplicar} disabled={duplicando || !nombreCopia.trim()}>
                            {duplicando ? 'Duplicando…' : 'Duplicar'}
                        </Button>
                    </>
                }
            >
                <TextField
                    fullWidth
                    autoFocus
                    label="Nombre de la copia"
                    value={nombreCopia}
                    onChange={(e) => setNombreCopia(e.target.value)}
                    disabled={duplicando}
                    sx={{ mt: 0.5 }}
                />
            </ResponsiveDialog>
        </PageContainer>
    );
}
