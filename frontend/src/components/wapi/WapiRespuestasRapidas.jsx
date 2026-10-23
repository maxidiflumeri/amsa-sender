import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert, Autocomplete, Box, Button, Chip, CircularProgress, FormControlLabel, IconButton, InputAdornment, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import { Bold, Code, Italic, MessageSquareText, Pencil, Plus, Search, Strikethrough, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import {
    BloqueEstado, ConfirmDialog, DataTableResponsive, EmptyState, PageContainer, PageHeader, ResponsiveDialog, SectionCard, StatusChip,
    WaBurbuja, formatoWhatsApp,
} from '../ui';
import MenuMas from '../plantillas/MenuMas';

const FORMULARIO_VACIO = { titulo: '', contenido: '', tags: [], activo: true };

const FORMATOS = [
    { id: 'bold', Icono: Bold, etiqueta: 'Negrita (*texto*)', envolver: (t) => `*${t}*` },
    { id: 'italic', Icono: Italic, etiqueta: 'Cursiva (_texto_)', envolver: (t) => `_${t}_` },
    { id: 'strike', Icono: Strikethrough, etiqueta: 'Tachado (~texto~)', envolver: (t) => `~${t}~` },
    { id: 'mono', Icono: Code, etiqueta: 'Monoespaciado (```texto```)', envolver: (t) => `\`\`\`${t}\`\`\`` },
];

export default function WapiRespuestasRapidas() {
    const feedback = useFeedback();
    const [params, setParams] = useSearchParams();
    const busqueda = params.get('q') ?? '';
    const filtroTag = params.get('tag') ?? '';

    const [items, setItems] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState(null);

    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState(FORMULARIO_VACIO);
    const [formInicial, setFormInicial] = useState(FORMULARIO_VACIO);
    const [tagTexto, setTagTexto] = useState('');
    const [guardando, setGuardando] = useState(false);
    // Dentro del diálogo: antes el error de guardado quedaba detrás, en la página.
    const [errorDialogo, setErrorDialogo] = useState('');
    const [aEliminar, setAEliminar] = useState(null);
    const [eliminando, setEliminando] = useState(false);

    const textareaRef = useRef(null);

    const todosLosTags = useMemo(() => [...new Set(items.flatMap((i) => i.tags ?? []))].sort(), [items]);

    const cargar = useCallback(async () => {
        setCargando(true);
        setErrorCarga(null);
        try {
            const { data } = await api.get('/wapi/respuestas-rapidas/todas');
            setItems(Array.isArray(data) ? data : []);
        } catch (err) {
            setErrorCarga(mensajeDeError(err, 'No se pudieron cargar las respuestas rápidas.'));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const cambiarParam = (clave, valor) => {
        const nuevo = new URLSearchParams(params);
        if (valor) nuevo.set(clave, valor);
        else nuevo.delete(clave);
        setParams(nuevo, { replace: true });
    };

    const abrir = (item) => {
        const base = item
            ? { titulo: item.titulo, contenido: item.contenido, tags: item.tags ?? [], activo: item.activo }
            : FORMULARIO_VACIO;
        setEditando(item);
        setForm(base);
        setFormInicial(base);
        setTagTexto('');
        setErrorDialogo('');
        setAbierto(true);
    };

    const cerrar = () => {
        setAbierto(false);
        setEditando(null);
    };

    const sucio = JSON.stringify(form) !== JSON.stringify(formInicial) || tagTexto.trim() !== '';

    const aplicarFormato = (envolver) => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart ?? form.contenido.length;
        const end = el.selectionEnd ?? form.contenido.length;
        const sel = form.contenido.substring(start, end) || 'texto';
        const envuelto = envolver(sel);
        setForm((f) => ({ ...f, contenido: f.contenido.substring(0, start) + envuelto + f.contenido.substring(end) }));
        setTimeout(() => {
            el.focus();
            el.setSelectionRange(start + envuelto.length, start + envuelto.length);
        }, 0);
    };

    // Los tags se agregan con Enter, con coma o con el botón: en algunos teclados de Android Enter y la coma no llegan
    // como tecla, así que el botón es el camino que siempre anda.
    const agregarTags = (texto) => {
        const nuevos = String(texto).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
        if (nuevos.length === 0) return;
        setForm((f) => ({ ...f, tags: [...new Set([...f.tags, ...nuevos])] }));
        setTagTexto('');
    };

    const guardar = async () => {
        if (!form.titulo.trim() || !form.contenido.trim()) return;
        // Un tag escrito y no agregado se agrega solo, para que no se pierda al guardar.
        const tags = [...new Set([...form.tags, ...tagTexto.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)])];
        const payload = { ...form, tags };
        setGuardando(true);
        setErrorDialogo('');
        try {
            if (editando) {
                await api.put(`/wapi/respuestas-rapidas/${editando.id}`, payload);
                feedback.exito('Respuesta rápida actualizada.');
            } else {
                await api.post('/wapi/respuestas-rapidas', payload);
                feedback.exito('Respuesta rápida creada.');
            }
            cerrar();
            cargar();
        } catch (err) {
            setErrorDialogo(mensajeDeError(err, 'No se pudo guardar la respuesta rápida.'));
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async () => {
        setEliminando(true);
        try {
            await api.delete(`/wapi/respuestas-rapidas/${aEliminar.id}`);
            feedback.exito(`Se eliminó «${aEliminar.titulo}».`);
            setAEliminar(null);
            cargar();
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo eliminar la respuesta rápida.'));
        } finally {
            setEliminando(false);
        }
    };

    const visibles = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return items.filter((i) => {
            if (filtroTag && !(i.tags ?? []).includes(filtroTag)) return false;
            if (!q) return true;
            return i.titulo?.toLowerCase().includes(q) || i.contenido?.toLowerCase().includes(q) || (i.tags ?? []).some((t) => t.includes(q));
        });
    }, [items, busqueda, filtroTag]);

    const chipsTags = (tags) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {(tags ?? []).map((t) => <Chip key={t} label={t} size="small" sx={{ fontSize: 12 }} />)}
        </Box>
    );

    const columnas = [
        { key: 'titulo', label: 'Título', primary: true, width: 220, render: (i) => <Box sx={{ fontWeight: 600 }}>{i.titulo}</Box> },
        {
            key: 'contenido',
            label: 'Contenido',
            secondary: true,
            render: (i) => (
                <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-line' }}>
                    {i.contenido}
                </Typography>
            ),
        },
        { key: 'tags', label: 'Tags', width: 200, render: (i) => (i.tags?.length ? chipsTags(i.tags) : '—') },
        { key: 'activo', label: 'Estado', width: 110, render: (i) => <StatusChip label={i.activo ? 'Activa' : 'Inactiva'} tono={i.activo ? 'ok' : 'neutro'} /> },
    ];

    return (
        <PageContainer>
            <PageHeader
                title="Respuestas rápidas"
                subtitle={<>Mensajes listos para contestar más rápido en Conversaciones. Escribí <strong>/</strong> en el chat para elegir una.</>}
                breadcrumbs={migasDe('/config/respuestas-rapidas')}
                actions={
                    <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={() => abrir(null)}>
                        Nueva respuesta
                    </Button>
                }
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Buscar por título, texto o tag"
                    value={busqueda}
                    onChange={(e) => cambiarParam('q', e.target.value)}
                    inputProps={{ 'aria-label': 'Buscar respuestas rápidas' }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} strokeWidth={1.75} aria-hidden /></InputAdornment> }}
                    sx={{ maxWidth: { sm: 400 } }}
                />
                {todosLosTags.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip label="Todas" color={!filtroTag ? 'primary' : 'default'} onClick={() => cambiarParam('tag', '')} sx={{ fontSize: 13, height: { xs: 36, md: 28 } }} />
                        {todosLosTags.map((t) => (
                            <Chip
                                key={t}
                                label={t}
                                color={filtroTag === t ? 'primary' : 'default'}
                                onClick={() => cambiarParam('tag', filtroTag === t ? '' : t)}
                                sx={{ fontSize: 13, height: { xs: 36, md: 28 } }}
                            />
                        ))}
                    </Box>
                )}
            </Box>

            {errorCarga ? (
                <BloqueEstado estado="error" mensaje={errorCarga} onReintentar={cargar} />
            ) : (
                <SectionCard noPadding>
                    <DataTableResponsive
                        ariaLabel="Respuestas rápidas"
                        columns={columnas}
                        rows={visibles}
                        loading={cargando}
                        acciones={(i) => (
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                <Button size="small" variant="outlined" startIcon={<Pencil size={16} strokeWidth={1.75} aria-hidden />} onClick={() => abrir(i)} sx={{ minHeight: { xs: 44, md: 32 } }}>
                                    Editar
                                </Button>
                                <MenuMas etiqueta={`Más acciones de ${i.titulo}`} items={[{ label: 'Eliminar', icono: Trash2, onClick: () => setAEliminar(i), peligro: true }]} />
                            </Box>
                        )}
                        empty={
                            <EmptyState
                                compact
                                icon={MessageSquareText}
                                title={busqueda || filtroTag ? 'No hay respuestas con ese filtro' : 'Todavía no hay respuestas rápidas'}
                                description={busqueda || filtroTag ? 'Probá con otra búsqueda o sacá el filtro.' : 'Creá la primera para contestar más rápido en Conversaciones.'}
                                action={busqueda || filtroTag ? undefined : { label: 'Nueva respuesta', onClick: () => abrir(null) }}
                            />
                        }
                    />
                </SectionCard>
            )}

            <ResponsiveDialog
                open={abierto}
                onClose={cerrar}
                maxWidth="md"
                sucio={sucio && !guardando}
                title={editando ? 'Editar respuesta rápida' : 'Nueva respuesta rápida'}
                actions={
                    <>
                        <Button onClick={cerrar} disabled={guardando}>Cancelar</Button>
                        <Button
                            variant="contained"
                            onClick={guardar}
                            disabled={!form.titulo.trim() || !form.contenido.trim() || guardando}
                            startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : undefined}
                        >
                            {editando ? 'Guardar cambios' : 'Crear respuesta'}
                        </Button>
                    </>
                }
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {errorDialogo && <Alert severity="error">{errorDialogo}</Alert>}

                    <TextField
                        label="Título"
                        fullWidth
                        value={form.titulo}
                        onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                        placeholder="Ej: Medios de pago, Horarios de atención"
                        helperText="El nombre con el que el asesor la busca en Conversaciones."
                    />

                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>Tags</Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <Autocomplete
                                freeSolo
                                fullWidth
                                options={todosLosTags.filter((t) => !form.tags.includes(t))}
                                inputValue={tagTexto}
                                onInputChange={(_, v, motivo) => {
                                    if (motivo === 'input' && v.includes(',')) {
                                        agregarTags(v);
                                        return;
                                    }
                                    setTagTexto(v);
                                }}
                                onChange={(_, v) => {
                                    if (typeof v === 'string' && v.trim()) agregarTags(v);
                                }}
                                value={null}
                                blurOnSelect
                                clearOnBlur={false}
                                renderInput={(p) => <TextField {...p} placeholder="Escribí un tag o elegí uno que ya existe" helperText="Sirven para filtrar la lista." />}
                            />
                            <Button variant="outlined" onClick={() => agregarTags(tagTexto)} disabled={!tagTexto.trim()} sx={{ minHeight: 44, flex: 'none' }}>
                                Agregar
                            </Button>
                        </Box>
                        {form.tags.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                                {form.tags.map((t) => (
                                    <Chip key={t} label={t} onDelete={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))} sx={{ fontSize: 13, height: { xs: 32, md: 26 } }} />
                                ))}
                            </Box>
                        )}
                    </Box>

                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>Contenido</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                            {FORMATOS.map(({ id, Icono, etiqueta, envolver }) => (
                                <Tooltip key={id} title={etiqueta}>
                                    <IconButton aria-label={etiqueta} onClick={() => aplicarFormato(envolver)} sx={{ width: 44, height: 44, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                                        <Icono size={18} strokeWidth={1.75} aria-hidden />
                                    </IconButton>
                                </Tooltip>
                            ))}
                        </Box>
                        <TextField
                            inputRef={textareaRef}
                            multiline
                            minRows={5}
                            maxRows={12}
                            fullWidth
                            value={form.contenido}
                            onChange={(e) => setForm((f) => ({ ...f, contenido: e.target.value }))}
                            placeholder={'Ej: Podés abonar tu cuota por estos medios:\n\n*Transferencia:* CBU 000000000000\n*App Mi Personal*'}
                            inputProps={{ 'aria-label': 'Contenido de la respuesta' }}
                        />
                    </Box>

                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>Así se ve en WhatsApp</Typography>
                        <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2, display: 'flex', flexDirection: 'column', minHeight: 80 }}>
                            {form.contenido.trim() ? (
                                <WaBurbuja direccion="saliente">{formatoWhatsApp(form.contenido)}</WaBurbuja>
                            ) : (
                                <Typography variant="body2" color="text.secondary">Escribí el contenido para verlo acá.</Typography>
                            )}
                        </Box>
                    </Box>

                    <FormControlLabel
                        sx={{ minHeight: 44 }}
                        control={<Switch checked={form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} />}
                        label="Activa (la ven los asesores)"
                    />
                </Box>
            </ResponsiveDialog>

            <ConfirmDialog
                open={!!aEliminar}
                peligro
                cargando={eliminando}
                titulo="¿Eliminar la respuesta rápida?"
                mensaje={<>Se va a eliminar <strong>{aEliminar?.titulo}</strong>. Los asesores dejan de verla en Conversaciones. No se puede deshacer.</>}
                confirmarTexto="Eliminar"
                onConfirmar={eliminar}
                onCancelar={() => setAEliminar(null)}
            />
        </PageContainer>
    );
}
