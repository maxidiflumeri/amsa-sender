import { useState, useEffect, useRef } from 'react';
import {
    Box, Paper, Typography, Button, IconButton, Tooltip,
    Table, TableHead, TableRow, TableCell, TableBody, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    CircularProgress, Alert, Snackbar, Stack, Divider, Switch,
    FormControlLabel, ToggleButton, ToggleButtonGroup, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import CodeIcon from '@mui/icons-material/Code';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CloseIcon from '@mui/icons-material/Close';
import api from '../../api/axios';

// Renderiza markdown de WhatsApp a HTML para el preview
function renderWaMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/```([\s\S]*?)```/g, '<code style="font-family:monospace;background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:3px">$1</code>')
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/~(.*?)~/g, '<del>$1</del>')
        .replace(/\n/g, '<br/>');
}

const EMPTY_FORM = { titulo: '', contenido: '', tags: [], activo: true };

export default function WapiRespuestasRapidas() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md')); // tabla → cards
    const isSmall = useMediaQuery(theme.breakpoints.down('sm'));  // dialogs fullscreen
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [snack, setSnack] = useState('');

    const [dialog, setDialog] = useState(false);
    const [editando, setEditando] = useState(null); // null = nuevo
    const [form, setForm] = useState(EMPTY_FORM);
    const [tagInput, setTagInput] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [confirmarEliminar, setConfirmarEliminar] = useState(null);
    const [eliminando, setEliminando] = useState(false);
    const [vistaEditor, setVistaEditor] = useState('editar'); // 'editar' | 'preview'

    const textareaRef = useRef(null);

    // Tags únicos de todos los items para filtro
    const todosLosTags = [...new Set(items.flatMap(i => i.tags ?? []))].sort();
    const [filtroTag, setFiltroTag] = useState('');

    const cargar = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/wapi/respuestas-rapidas/todas');
            setItems(data);
        } catch {
            setError('Error cargando plantillas rápidas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    const abrirCrear = () => {
        setEditando(null);
        setForm(EMPTY_FORM);
        setTagInput('');
        setVistaEditor('editar');
        setDialog(true);
    };

    const abrirEditar = (item) => {
        setEditando(item);
        setForm({ titulo: item.titulo, contenido: item.contenido, tags: item.tags ?? [], activo: item.activo });
        setTagInput('');
        setVistaEditor('editar');
        setDialog(true);
    };

    const cerrarDialog = () => {
        setDialog(false);
        setEditando(null);
    };

    // Insertar formato en el textarea
    const insertarFormato = (tipo) => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const sel = form.contenido.substring(start, end) || 'texto';
        const envoltura = {
            bold: `*${sel}*`,
            italic: `_${sel}_`,
            strike: `~${sel}~`,
            mono: `\`\`\`${sel}\`\`\``,
        }[tipo];
        const nuevo = form.contenido.substring(0, start) + envoltura + form.contenido.substring(end);
        setForm(f => ({ ...f, contenido: nuevo }));
        // Reposicionar cursor
        setTimeout(() => {
            el.focus();
            const pos = start + envoltura.length;
            el.setSelectionRange(pos, pos);
        }, 0);
    };

    const agregarTag = (e) => {
        if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
            e.preventDefault();
            const tag = tagInput.trim().toLowerCase();
            if (!form.tags.includes(tag)) {
                setForm(f => ({ ...f, tags: [...f.tags, tag] }));
            }
            setTagInput('');
        }
    };

    const quitarTag = (tag) => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));

    const guardar = async () => {
        if (!form.titulo.trim() || !form.contenido.trim()) return;
        setGuardando(true);
        try {
            if (editando) {
                await api.put(`/wapi/respuestas-rapidas/${editando.id}`, form);
                setSnack('Plantilla actualizada.');
            } else {
                await api.post('/wapi/respuestas-rapidas', form);
                setSnack('Plantilla creada.');
            }
            cerrarDialog();
            cargar();
        } catch {
            setError('Error al guardar la plantilla.');
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async () => {
        if (!confirmarEliminar) return;
        setEliminando(true);
        try {
            await api.delete(`/wapi/respuestas-rapidas/${confirmarEliminar.id}`);
            setSnack('Plantilla eliminada.');
            setConfirmarEliminar(null);
            cargar();
        } catch {
            setError('Error al eliminar.');
        } finally {
            setEliminando(false);
        }
    };

    const itemsFiltrados = filtroTag
        ? items.filter(i => (i.tags ?? []).includes(filtroTag))
        : items;

    return (
        <Box py={3}>
            <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
                    <Box>
                        <Typography variant="h5" fontWeight={700}>Plantillas rápidas</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Respuestas predefinidas para acelerar la atención en el inbox. Usá <strong>/</strong> en el chat para invocarlas.
                        </Typography>
                    </Box>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={abrirCrear}>
                        Nueva plantilla
                    </Button>
                </Box>

                {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

                {/* Filtro por tags */}
                {todosLosTags.length > 0 && (
                    <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Filtrar:</Typography>
                        <Chip
                            label="Todos"
                            size="small"
                            color={!filtroTag ? 'primary' : 'default'}
                            onClick={() => setFiltroTag('')}
                            sx={{ cursor: 'pointer' }}
                        />
                        {todosLosTags.map(tag => (
                            <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                color={filtroTag === tag ? 'primary' : 'default'}
                                onClick={() => setFiltroTag(filtroTag === tag ? '' : tag)}
                                sx={{ cursor: 'pointer' }}
                            />
                        ))}
                    </Box>
                )}

                {loading ? (
                    <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
                ) : itemsFiltrados.length === 0 ? (
                    <Box textAlign="center" py={6} color="text.secondary">
                        <Typography>No hay plantillas{filtroTag ? ` con tag "${filtroTag}"` : ''}.</Typography>
                    </Box>
                ) : isMobile ? (
                    /* Vista mobile: cards */
                    <Stack spacing={1.5}>
                        {itemsFiltrados.map(item => (
                            <Paper
                                key={item.id}
                                variant="outlined"
                                sx={{ p: 1.5, borderRadius: 2 }}
                            >
                                <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
                                    <Box flex={1} minWidth={0}>
                                        <Box display="flex" alignItems="center" gap={1} mb={0.5} flexWrap="wrap">
                                            <Typography variant="body2" fontWeight={600} noWrap>
                                                {item.titulo}
                                            </Typography>
                                            <Chip
                                                label={item.activo ? 'Activa' : 'Inactiva'}
                                                size="small"
                                                color={item.activo ? 'success' : 'default'}
                                                sx={{ height: 18, fontSize: 10 }}
                                            />
                                        </Box>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            {item.contenido}
                                        </Typography>
                                        {(item.tags ?? []).length > 0 && (
                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
                                                {(item.tags ?? []).map(tag => (
                                                    <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: 10 }} />
                                                ))}
                                            </Box>
                                        )}
                                    </Box>
                                    <Box display="flex" flexDirection="column" alignItems="flex-end" flexShrink={0}>
                                        <Tooltip title="Editar">
                                            <IconButton size="small" onClick={() => abrirEditar(item)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Eliminar">
                                            <IconButton size="small" color="error" onClick={() => setConfirmarEliminar(item)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>
                            </Paper>
                        ))}
                    </Stack>
                ) : (
                    /* Vista desktop: tabla */
                    <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell width={200}><strong>Título</strong></TableCell>
                                <TableCell><strong>Contenido</strong></TableCell>
                                <TableCell width={180}><strong>Tags</strong></TableCell>
                                <TableCell width={80} align="center"><strong>Activa</strong></TableCell>
                                <TableCell width={90} align="right"></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {itemsFiltrados.map(item => (
                                <TableRow key={item.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{item.titulo}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            {item.contenido}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {(item.tags ?? []).map(tag => (
                                                <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: 10 }} />
                                            ))}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={item.activo ? 'Activa' : 'Inactiva'}
                                            size="small"
                                            color={item.activo ? 'success' : 'default'}
                                            sx={{ height: 18, fontSize: 10 }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Editar">
                                            <IconButton size="small" onClick={() => abrirEditar(item)}><EditIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                        <Tooltip title="Eliminar">
                                            <IconButton size="small" color="error" onClick={() => setConfirmarEliminar(item)}><DeleteIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </Box>
                )}
            </Paper>

            {/* Dialog crear/editar */}
            <Dialog open={dialog} onClose={cerrarDialog} maxWidth="md" fullWidth fullScreen={isSmall}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {editando ? 'Editar plantilla' : 'Nueva plantilla'}
                    <IconButton size="small" onClick={cerrarDialog}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2.5}>
                        <TextField
                            label="Título"
                            fullWidth
                            size="small"
                            value={form.titulo}
                            onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                            placeholder="Ej: Medios de pago, Horarios de atención..."
                            helperText="Nombre que verá el agente al buscar en el inbox"
                        />

                        {/* Tags */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                Tags / Categorías
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                                {form.tags.map(tag => (
                                    <Chip
                                        key={tag}
                                        label={tag}
                                        size="small"
                                        onDelete={() => quitarTag(tag)}
                                    />
                                ))}
                            </Box>
                            <TextField
                                size="small"
                                placeholder="Escribí un tag y presioná Enter (ej: peugeot, pagos...)"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={agregarTag}
                                fullWidth
                            />
                        </Box>

                        {/* Editor con toolbar */}
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">Contenido</Typography>
                                <ToggleButtonGroup
                                    value={vistaEditor}
                                    exclusive
                                    onChange={(_, v) => v && setVistaEditor(v)}
                                    size="small"
                                >
                                    <ToggleButton value="editar" sx={{ py: 0.25, px: 1, fontSize: 11 }}>
                                        <EditNoteIcon sx={{ fontSize: 14, mr: 0.5 }} /> Editar
                                    </ToggleButton>
                                    <ToggleButton value="preview" sx={{ py: 0.25, px: 1, fontSize: 11 }}>
                                        <VisibilityIcon sx={{ fontSize: 14, mr: 0.5 }} /> Preview
                                    </ToggleButton>
                                </ToggleButtonGroup>
                            </Box>

                            {vistaEditor === 'editar' ? (
                                <>
                                    {/* Toolbar de formato */}
                                    <Paper variant="outlined" sx={{ p: 0.5, mb: 0.5, display: 'flex', gap: 0.5, borderBottom: 'none', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                                        <Tooltip title="Negrita — *texto*">
                                            <IconButton size="small" onClick={() => insertarFormato('bold')}><FormatBoldIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                        <Tooltip title="Cursiva — _texto_">
                                            <IconButton size="small" onClick={() => insertarFormato('italic')}><FormatItalicIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                        <Tooltip title="Tachado — ~texto~">
                                            <IconButton size="small" onClick={() => insertarFormato('strike')}><StrikethroughSIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                        <Tooltip title="Monoespaciado — ```texto```">
                                            <IconButton size="small" onClick={() => insertarFormato('mono')}><CodeIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                                        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', fontSize: 10, display: { xs: 'none', sm: 'block' } }}>
                                            *negrita* · _cursiva_ · ~tachado~ · ```mono```
                                        </Typography>
                                    </Paper>
                                    <TextField
                                        inputRef={textareaRef}
                                        multiline
                                        minRows={5}
                                        maxRows={12}
                                        fullWidth
                                        value={form.contenido}
                                        onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                                        placeholder={'Ej: Podés abonar tu cuota por los siguientes medios:\n\n*Transferencia bancaria:* CBU 000000000000\n*App Mi Personal:* personal.com.ar/pagos\n*Personal Pay*'}
                                        sx={{ '& .MuiOutlinedInput-root': { borderTopLeftRadius: 0, borderTopRightRadius: 0 } }}
                                    />
                                </>
                            ) : (
                                /* Preview */
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 2,
                                        minHeight: 120,
                                        bgcolor: theme.palette.mode === 'dark' ? '#1a2e1a' : '#e7f3e7',
                                        borderRadius: 2,
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                        Vista previa (estilo WhatsApp)
                                    </Typography>
                                    <Box
                                        sx={{ fontSize: 14, lineHeight: 1.6, wordBreak: 'break-word' }}
                                        dangerouslySetInnerHTML={{ __html: renderWaMarkdown(form.contenido) || '<span style="opacity:0.4">Sin contenido</span>' }}
                                    />
                                </Paper>
                            )}
                        </Box>

                        <FormControlLabel
                            control={<Switch checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />}
                            label="Plantilla activa (visible para agentes)"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={cerrarDialog}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={guardar}
                        disabled={!form.titulo.trim() || !form.contenido.trim() || guardando}
                    >
                        {guardando ? <CircularProgress size={20} /> : editando ? 'Guardar cambios' : 'Crear plantilla'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirmar eliminar */}
            <Dialog open={!!confirmarEliminar} onClose={() => setConfirmarEliminar(null)} maxWidth="xs" fullWidth fullScreen={isSmall}>
                <DialogTitle>Eliminar plantilla</DialogTitle>
                <DialogContent>
                    <Typography>¿Eliminás <strong>{confirmarEliminar?.titulo}</strong>? Esta acción no se puede deshacer.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmarEliminar(null)}>Cancelar</Button>
                    <Button variant="contained" color="error" onClick={eliminar} disabled={eliminando}>
                        {eliminando ? <CircularProgress size={20} /> : 'Eliminar'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
                <Alert severity="success" onClose={() => setSnack('')}>{snack}</Alert>
            </Snackbar>
        </Box>
    );
}
