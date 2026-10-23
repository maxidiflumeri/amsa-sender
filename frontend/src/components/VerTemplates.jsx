import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, InputAdornment, Paper, TextField, Typography } from '@mui/material';
import { Eye, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { mensajeDeError, useFeedback } from '../context/FeedbackContext';
import { migasDe } from './layout/navConfig';
import { BloqueEstado, ConfirmDialog, EmptyState, PageContainer, PageHeader, WaBurbuja, formatoWhatsApp } from './ui';
import MenuMas from './plantillas/MenuMas';
import TemplateModal from './TemplateModal';
import PreviewTemplateReal from './PreviewTemplateReal';

const LINEAS_RESUMEN = 6;

/** Una plantilla de WhatsApp Web: la burbuja como la ve el deudor, con "Ver más" si es larga. */
function TarjetaPlantilla({ plantilla, onEditar, onPreview, onEliminar }) {
    const [expandida, setExpandida] = useState(false);
    const lineas = plantilla.contenido?.split('\n') ?? [];
    const larga = lineas.length > LINEAS_RESUMEN;
    const texto = larga && !expandida ? `${lineas.slice(0, LINEAS_RESUMEN).join('\n')}…` : plantilla.contenido;

    return (
        <Paper variant="outlined" sx={{ borderRadius: '14px', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography sx={{ fontWeight: 650, fontSize: 15, overflowWrap: 'anywhere' }}>{plantilla.nombre}</Typography>
                <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1.5, display: 'flex', flexDirection: 'column' }}>
                    <WaBurbuja direccion="saliente" sx={{ maxWidth: '100%', alignSelf: 'flex-start' }}>{formatoWhatsApp(texto)}</WaBurbuja>
                </Box>
                {larga && (
                    <Button size="small" onClick={() => setExpandida((v) => !v)} sx={{ alignSelf: 'flex-start', minHeight: { xs: 44, sm: 30 } }}>
                        {expandida ? 'Ver menos' : 'Ver más'}
                    </Button>
                )}
            </Box>
            <Box sx={{ borderTop: 1, borderColor: 'divider', px: 1.5, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                <Button size="small" variant="outlined" startIcon={<Pencil size={16} strokeWidth={1.75} aria-hidden />} onClick={onEditar} sx={{ minHeight: { xs: 44, sm: 32 } }}>
                    Editar
                </Button>
                <MenuMas
                    etiqueta={`Más acciones de ${plantilla.nombre}`}
                    items={[
                        { label: 'Ver con datos reales', icono: Eye, onClick: onPreview },
                        { label: 'Eliminar', icono: Trash2, onClick: onEliminar, peligro: true },
                    ]}
                />
            </Box>
        </Paper>
    );
}

export default function VerTemplates() {
    const feedback = useFeedback();
    const [params, setParams] = useSearchParams();
    const busqueda = params.get('q') ?? '';

    const [plantillas, setPlantillas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState(null);
    const [editando, setEditando] = useState(null);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [previewId, setPreviewId] = useState(null);
    const [aEliminar, setAEliminar] = useState(null);
    const [eliminando, setEliminando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setErrorCarga(null);
        try {
            const res = await api.get('/whatsapp/templates');
            setPlantillas(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setErrorCarga(mensajeDeError(err, 'No se pudieron cargar las plantillas.'));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const visibles = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return q ? plantillas.filter((t) => t.nombre?.toLowerCase().includes(q)) : plantillas;
    }, [plantillas, busqueda]);

    const cambiarBusqueda = (valor) => {
        const nuevo = new URLSearchParams(params);
        if (valor) nuevo.set('q', valor);
        else nuevo.delete('q');
        setParams(nuevo, { replace: true });
    };

    const abrirNueva = () => {
        setEditando(null);
        setModalAbierto(true);
    };

    // Si falla, tira: el modal se queda abierto y muestra el error (antes se cerraba como si hubiera guardado).
    const guardar = async (data) => {
        if (editando) {
            await api.put(`/whatsapp/templates/${editando.id}`, data);
            feedback.exito('Plantilla actualizada.');
        } else {
            await api.post('/whatsapp/templates', data);
            feedback.exito('Plantilla creada.');
        }
        await cargar();
    };

    const eliminar = async () => {
        setEliminando(true);
        try {
            await api.delete(`/whatsapp/templates/${aEliminar.id}`);
            feedback.exito(`Se eliminó la plantilla «${aEliminar.nombre}».`);
            setAEliminar(null);
            await cargar();
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo eliminar la plantilla.'));
        } finally {
            setEliminando(false);
        }
    };

    return (
        <PageContainer>
            <PageHeader
                title="Plantillas de WhatsApp Web"
                subtitle="Los mensajes que se mandan desde las sesiones de WhatsApp Web, con variables que se completan con los datos de cada contacto."
                breadcrumbs={migasDe('/templates')}
                actions={
                    <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={abrirNueva}>
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
                sx={{ mb: 2.5, maxWidth: { sm: 400 } }}
            />

            {errorCarga && <BloqueEstado estado="error" mensaje={errorCarga} onReintentar={cargar} />}
            {cargando && !errorCarga && <BloqueEstado estado="cargando" mensaje="Cargando plantillas…" />}

            {!cargando && !errorCarga && visibles.length === 0 && (
                <EmptyState
                    icon={FileText}
                    title={busqueda ? 'No hay plantillas con ese nombre' : 'Todavía no hay plantillas'}
                    description={busqueda ? 'Probá con otra búsqueda.' : 'Creá la primera para usarla en tus campañas de WhatsApp Web.'}
                    action={busqueda ? undefined : { label: 'Nueva plantilla', onClick: abrirNueva }}
                />
            )}

            {!cargando && !errorCarga && visibles.length > 0 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
                    {visibles.map((t) => (
                        <TarjetaPlantilla
                            key={t.id}
                            plantilla={t}
                            onEditar={() => {
                                setEditando(t);
                                setModalAbierto(true);
                            }}
                            onPreview={() => setPreviewId(t.id)}
                            onEliminar={() => setAEliminar(t)}
                        />
                    ))}
                </Box>
            )}

            <TemplateModal open={modalAbierto} onClose={() => setModalAbierto(false)} templateToEdit={editando} onSave={guardar} />

            <PreviewTemplateReal open={previewId !== null} onClose={() => setPreviewId(null)} templateId={previewId} />

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
        </PageContainer>
    );
}
