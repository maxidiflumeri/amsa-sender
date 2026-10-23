import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import api from '../api/axios';
import { mensajeDeError, useFeedback } from '../context/FeedbackContext';
import { renderTemplate } from '../utils/renderTemplate';
import { ResponsiveDialog, WaBurbuja, formatoWhatsApp } from './ui';

const FORMATOS = [
    { id: 'negrita', label: 'Negrita', marca: '*' },
    { id: 'cursiva', label: 'Cursiva', marca: '_' },
    { id: 'tachado', label: 'Tachado', marca: '~' },
    { id: 'mono', label: 'Monoespaciado', marca: '`' },
];

/**
 * Crear o editar una plantilla de WhatsApp Web. La campaña de referencia es opcional: solo sirve para ofrecer las
 * variables de esa campaña y para ver la vista previa con los datos de su primer contacto. Antes era obligatoria para
 * guardar, y no se podía corregir un error de tipeo sin elegir una.
 *
 * `onSave` tiene que tirar si falla: el diálogo queda abierto y muestra el error en vez de cerrarse como si hubiera
 * guardado.
 */
export default function TemplateModal({ open, onClose, onSave, templateToEdit }) {
    const feedback = useFeedback();
    const textareaRef = useRef(null);
    const [nombre, setNombre] = useState('');
    const [contenido, setContenido] = useState('');
    const [inicial, setInicial] = useState({ nombre: '', contenido: '' });
    const [datosEjemplo, setDatosEjemplo] = useState({});
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);

    const [campañas, setCampañas] = useState([]);
    const [campañaReferenciaId, setCampañaReferenciaId] = useState('');
    const [variablesDisponibles, setVariablesDisponibles] = useState([]);
    const [cargandoReferencia, setCargandoReferencia] = useState(false);

    useEffect(() => {
        if (!open) return;
        setError('');
        setCampañaReferenciaId('');
        setVariablesDisponibles([]);
        setDatosEjemplo({});
        const n = templateToEdit?.nombre || '';
        const c = templateToEdit?.contenido || '';
        setNombre(n);
        setContenido(c);
        setInicial({ nombre: n, contenido: c });

        api.get('/whatsapp/campanias')
            .then((res) => setCampañas([...res.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))))
            .catch((err) => feedback.error(mensajeDeError(err, 'No se pudieron cargar las campañas de referencia.')));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, templateToEdit]);

    const sucio = nombre !== inicial.nombre || contenido !== inicial.contenido;

    // Con la ref y no con querySelector('textarea'): si hubiera otro textarea en la pantalla, escribía en ese.
    const escribirEnCursor = (antes, seleccionado, despues, cursorFinal) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart ?? contenido.length;
        const end = ta.selectionEnd ?? contenido.length;
        const sel = seleccionado ? contenido.substring(start, end) : '';
        const nuevo = contenido.substring(0, start) + antes + sel + despues + contenido.substring(end);
        setContenido(nuevo);
        setTimeout(() => {
            ta.focus();
            const pos = cursorFinal === 'dentro' ? start + antes.length + sel.length : start + antes.length + sel.length + despues.length;
            ta.setSelectionRange(pos, pos);
        }, 0);
    };

    const insertarVariable = (variable) => escribirEnCursor(`{{${variable}}}`, false, '', 'fuera');
    const aplicarFormato = (marca) => escribirEnCursor(marca, true, marca, 'fuera');
    const insertarSalto = () => escribirEnCursor('\n', false, '', 'fuera');

    const elegirReferencia = async (campaña) => {
        if (!campaña) {
            setCampañaReferenciaId('');
            setVariablesDisponibles([]);
            setDatosEjemplo({});
            return;
        }
        setCampañaReferenciaId(campaña.id);
        setCargandoReferencia(true);
        try {
            const [varsRes, contactoRes] = await Promise.all([
                api.get(`/whatsapp/campanias/${campaña.id}/variables`),
                api.get(`/whatsapp/campanias/${campaña.id}/primer-contacto`),
            ]);
            setVariablesDisponibles(varsRes.data);
            setDatosEjemplo(contactoRes.data?.datos || {});
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudieron cargar los datos de esa campaña.'));
        } finally {
            setCargandoReferencia(false);
        }
    };

    const vistaPrevia = useMemo(() => renderTemplate(contenido, datosEjemplo, { conservarFaltantes: true }), [contenido, datosEjemplo]);

    const guardar = async () => {
        if (!nombre.trim() || !contenido.trim()) {
            setError('Completá el nombre y el contenido.');
            return;
        }
        setGuardando(true);
        setError('');
        try {
            await onSave({ nombre, contenido });
            onClose();
        } catch (err) {
            setError(mensajeDeError(err, 'No se pudo guardar la plantilla.'));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ResponsiveDialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            sucio={sucio && !guardando}
            title={templateToEdit ? 'Editar plantilla' : 'Nueva plantilla'}
            actions={
                <>
                    <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={guardar}
                        disabled={guardando || !nombre.trim() || !contenido.trim()}
                        startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : undefined}
                    >
                        Guardar
                    </Button>
                </>
            }
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {error && <Alert severity="error">{error}</Alert>}

                <TextField label="Nombre de la plantilla" fullWidth value={nombre} onChange={(e) => setNombre(e.target.value)} />

                <Autocomplete
                    fullWidth
                    options={campañas.slice(0, 15)}
                    getOptionLabel={(o) => o.nombre}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    value={campañas.find((c) => c.id === campañaReferenciaId) || null}
                    onChange={(_, nueva) => elegirReferencia(nueva)}
                    noOptionsText="No hay campañas"
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Campaña de referencia (opcional)"
                            helperText="Sirve para ver las variables de esa campaña y probar la plantilla con sus datos. No hace falta para guardar."
                        />
                    )}
                />

                {cargandoReferencia && <Typography variant="caption" color="text.secondary">Cargando datos de la campaña…</Typography>}

                {variablesDisponibles.length > 0 && (
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>Tocá una variable para insertarla donde está el cursor</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {variablesDisponibles.map((v) => (
                                <Button key={v} variant="outlined" size="small" onClick={() => insertarVariable(v)} sx={{ minHeight: { xs: 44, sm: 30 } }}>
                                    {`{{${v}}}`}
                                </Button>
                            ))}
                        </Box>
                    </Box>
                )}

                <Box>
                    <Typography sx={{ fontWeight: 650, fontSize: 14, mb: 1 }}>Contenido del mensaje</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                        {FORMATOS.map((f) => (
                            <Button key={f.id} size="small" variant="outlined" onClick={() => aplicarFormato(f.marca)} sx={{ minHeight: { xs: 44, sm: 30 } }}>{f.label}</Button>
                        ))}
                        <Button size="small" variant="outlined" onClick={insertarSalto} sx={{ minHeight: { xs: 44, sm: 30 } }}>Salto de línea</Button>
                    </Box>
                    <TextField
                        multiline
                        minRows={6}
                        maxRows={14}
                        fullWidth
                        value={contenido}
                        onChange={(e) => setContenido(e.target.value)}
                        inputRef={textareaRef}
                        inputProps={{ 'aria-label': 'Contenido del mensaje' }}
                    />
                </Box>

                <Box>
                    <Typography sx={{ fontWeight: 650, fontSize: 14, mb: 1 }}>
                        Vista previa{campañaReferenciaId ? ' con los datos del primer contacto' : ''}
                    </Typography>
                    <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2, display: 'flex', flexDirection: 'column', minHeight: 80 }}>
                        {contenido.trim() ? (
                            <WaBurbuja direccion="saliente">{formatoWhatsApp(vistaPrevia)}</WaBurbuja>
                        ) : (
                            <Typography variant="body2" color="text.secondary">Escribí el mensaje para verlo acá.</Typography>
                        )}
                    </Box>
                    {!campañaReferenciaId && /{{\s*\w+\s*}}/.test(contenido) && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            Elegí una campaña de referencia para reemplazar las variables con datos de ejemplo.
                        </Typography>
                    )}
                </Box>
            </Box>
        </ResponsiveDialog>
    );
}
