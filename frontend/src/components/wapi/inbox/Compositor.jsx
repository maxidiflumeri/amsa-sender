import { useRef, useState } from 'react';
import { Alert, Box, CircularProgress, IconButton, InputBase, Link, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import { FileText, Paperclip, SendHorizontal, Sparkles, X, Zap } from 'lucide-react';
import RespuestasRapidas from './RespuestasRapidas';
import { filtrarRespuestas, tagsDe } from './utils';

// Donde se escribe. Botones de 44 px, el campo crece hasta 5 líneas y respeta la zona segura de abajo. En la
// computadora Enter envía; en una pantalla táctil Enter baja de línea (el teclado del celular no tiene Shift) y se
// envía con el botón.

function AvisoBloqueado({ conv, ventana, puedeVerCampanias }) {
    const sx = { m: 1.5, py: 0.5, alignItems: 'center' };
    if (conv.estado === 'sin_asignar') {
        return <Alert severity="warning" sx={sx}>Tomá o asigná esta conversación antes de responder.</Alert>;
    }
    // Resuelta primero: con la ventana cerrada, decir "ventana cerrada" ocultaba que la conversación ya estaba resuelta.
    if (conv.estado === 'resuelta') {
        return (
            <Alert severity="info" sx={sx}>
                {ventana.abierta
                    ? 'Conversación resuelta. Si el cliente escribe, se reabre sola.'
                    : 'Conversación resuelta, y la ventana de 24 h está cerrada. Solo se le puede escribir con una plantilla aprobada.'}
                {!ventana.abierta && puedeVerCampanias && <> Enviala desde <Link component={RouterLink} to="/wapi/campanias">Campañas</Link>.</>}
            </Alert>
        );
    }
    return (
        <Alert severity="warning" sx={sx}>
            Pasaron más de 24 h desde el último mensaje del cliente: WhatsApp solo deja escribirle con una plantilla aprobada.
            {puedeVerCampanias && <> Enviala desde <Link component={RouterLink} to="/wapi/campanias">Campañas</Link>.</>}
        </Alert>
    );
}

export default function Compositor({
    conv, ventana, puedeVerCampanias, puedeAdministrarRespuestas, texto, onTexto, adjunto, onAdjunto, onQuitarAdjunto, enviando, onEnviar,
    onSugerir, sugiriendo, respuestas,
}) {
    const theme = useTheme();
    const movil = useMediaQuery(theme.breakpoints.down('md'));
    const tactil = useMediaQuery('(pointer: coarse)');
    const raiz = useRef(null);
    const input = useRef(null);
    const archivo = useRef(null);
    const seleccion = useRef(null); // { start, end } del cursor, para insertar ahí

    const [rrAbierto, setRrAbierto] = useState(false);
    const [rrModo, setRrModo] = useState('boton'); // 'slash' | 'boton'
    const [rrBusqueda, setRrBusqueda] = useState('');
    const [rrTag, setRrTag] = useState('');
    const [rrIndice, setRrIndice] = useState(0);

    const bloqueado = conv.estado === 'sin_asignar' || conv.estado === 'resuelta' || !ventana.abierta;
    if (bloqueado) {
        return (
            <Box sx={{ bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider', pb: 'env(safe-area-inset-bottom)' }}>
                <AvisoBloqueado conv={conv} ventana={ventana} puedeVerCampanias={puedeVerCampanias} />
            </Box>
        );
    }

    const hayContenido = !!texto.trim() || !!adjunto;
    const filtradas = filtrarRespuestas(respuestas, rrBusqueda, rrTag);

    const guardarSeleccion = () => {
        const el = input.current;
        if (el) seleccion.current = { start: el.selectionStart, end: el.selectionEnd };
    };

    const cerrarRr = () => {
        setRrAbierto(false);
        setRrBusqueda('');
        setRrTag('');
        setRrIndice(0);
    };

    const abrirRr = (modo, busqueda = '') => {
        setRrModo(modo);
        setRrBusqueda(busqueda);
        setRrTag('');
        setRrIndice(0);
        setRrAbierto(true);
    };

    // Inserta en el cursor, no pisa todo el mensaje. Con "/" el texto escrito era solo el filtro: ese sí se reemplaza.
    const insertar = (fragmento, { reemplazarTodo = false } = {}) => {
        const sel = seleccion.current;
        const desde = reemplazarTodo ? 0 : Math.min(sel?.start ?? texto.length, texto.length);
        const hasta = reemplazarTodo ? texto.length : Math.min(sel?.end ?? desde, texto.length);
        onTexto(texto.slice(0, desde) + fragmento + texto.slice(hasta));
        const pos = desde + fragmento.length;
        seleccion.current = { start: pos, end: pos };
        requestAnimationFrame(() => {
            input.current?.focus();
            input.current?.setSelectionRange(pos, pos);
        });
    };

    const elegirRespuesta = (r) => {
        insertar(r.contenido, { reemplazarTodo: rrModo === 'slash' });
        cerrarRr();
    };

    const pedirSugerencia = async () => {
        const sugerencia = await onSugerir();
        if (!sugerencia) return;
        // Si ya hay algo escrito, la sugerencia va debajo: no se pisa lo que el asesor venía armando.
        const base = texto.replace(/\s+$/, '');
        const nuevo = base ? `${base}\n\n${sugerencia}` : sugerencia;
        onTexto(nuevo);
        requestAnimationFrame(() => {
            input.current?.focus();
            input.current?.setSelectionRange(nuevo.length, nuevo.length);
        });
    };

    const alCambiar = (e) => {
        const val = e.target.value;
        onTexto(val);
        guardarSeleccion();
        // "/" para las respuestas rápidas: solo con teclado físico. En el celular se abre con el botón (un Drawer
        // que aparece mientras se tipea le saca el teclado al asesor).
        if (!tactil && val.startsWith('/')) {
            if (!rrAbierto || rrModo !== 'slash') setRrModo('slash');
            setRrBusqueda(val);
            setRrIndice(0);
            setRrAbierto(true);
        } else if (rrAbierto && rrModo === 'slash') {
            cerrarRr();
        }
    };

    const alTeclear = (e) => {
        if (rrAbierto && rrModo === 'slash') {
            if (e.key === 'ArrowDown') { e.preventDefault(); setRrIndice((i) => Math.min(i + 1, Math.max(filtradas.length - 1, 0))); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setRrIndice((i) => Math.max(i - 1, 0)); return; }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (filtradas[rrIndice]) elegirRespuesta(filtradas[rrIndice]);
                return;
            }
            if (e.key === 'Escape') { cerrarRr(); return; }
        }
        // No enviar mientras un teclado con composición (IME) está armando una letra.
        if (e.key === 'Enter' && !e.shiftKey && !tactil && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (hayContenido && !enviando) onEnviar();
        }
    };

    const alElegirArchivo = (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) onAdjunto(f);
    };

    const botonHerramienta = { width: 44, height: 44, flex: 'none', color: 'text.secondary' };

    return (
        <Box
            ref={raiz}
            sx={{ bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider', px: { xs: 1, md: 2 }, pt: 1, pb: 'calc(8px + env(safe-area-inset-bottom))' }}
        >
            {adjunto && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, px: 0.5 }}>
                    {adjunto.tipo === 'image' && adjunto.preview ? (
                        <Box component="img" src={adjunto.preview} alt="Vista previa del adjunto" sx={{ height: 56, maxWidth: 120, objectFit: 'cover', borderRadius: '8px' }} />
                    ) : (
                        <Box sx={{ color: 'text.secondary', display: 'inline-flex' }}><FileText size={22} strokeWidth={1.75} aria-hidden /></Box>
                    )}
                    <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 13, color: 'text.secondary' }}>{adjunto.file.name}</Typography>
                    <IconButton aria-label="Quitar el adjunto" onClick={onQuitarAdjunto} sx={{ width: 44, height: 44 }}>
                        <X size={18} strokeWidth={1.75} aria-hidden />
                    </IconButton>
                </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', minHeight: 44, px: 1.75, py: 0.5, border: 1, borderColor: 'divider', borderRadius: '22px', bgcolor: 'background.default', '&:focus-within': { borderColor: 'primary.main' } }}>
                    <InputBase
                        multiline
                        minRows={1}
                        maxRows={5}
                        fullWidth
                        value={texto}
                        onChange={alCambiar}
                        onKeyDown={alTeclear}
                        onBlur={guardarSeleccion}
                        onSelect={guardarSeleccion}
                        placeholder={adjunto ? 'Agregá una descripción (opcional)' : 'Escribí un mensaje'}
                        inputRef={input}
                        inputProps={{ 'aria-label': 'Mensaje', spellCheck: true, lang: 'es', enterKeyHint: tactil ? 'enter' : 'send' }}
                        // 16 px en el celular: con menos, iOS hace zoom al enfocar el campo.
                        sx={{ fontSize: { xs: 16, md: 14.5 }, lineHeight: 1.45, py: 0.25 }}
                    />
                </Box>
                <Tooltip title="Enviar">
                    <span>
                        <IconButton
                            aria-label="Enviar"
                            onClick={onEnviar}
                            disabled={!hayContenido || enviando}
                            sx={{ width: 44, height: 44, flex: 'none', bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' } }}
                        >
                            {enviando ? <CircularProgress size={18} color="inherit" /> : <SendHorizontal size={20} strokeWidth={1.75} aria-hidden />}
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <input ref={archivo} type="file" hidden accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={alElegirArchivo} />
                <Tooltip title="Adjuntar un archivo">
                    <IconButton aria-label="Adjuntar un archivo" onClick={() => archivo.current?.click()} disabled={enviando} sx={botonHerramienta}>
                        <Paperclip size={20} strokeWidth={1.75} aria-hidden />
                    </IconButton>
                </Tooltip>
                <Tooltip title={tactil ? 'Respuestas rápidas' : 'Respuestas rápidas (/)'}>
                    <IconButton
                        aria-label="Respuestas rápidas"
                        aria-expanded={rrAbierto}
                        onClick={() => {
                            if (rrAbierto) { cerrarRr(); return; }
                            guardarSeleccion();
                            abrirRr('boton');
                        }}
                        sx={botonHerramienta}
                    >
                        <Zap size={20} strokeWidth={1.75} aria-hidden />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Sugerir una respuesta con IA">
                    <span>
                        <IconButton
                            aria-label="Sugerir una respuesta con IA"
                            onClick={pedirSugerencia}
                            disabled={sugiriendo}
                            sx={{ ...botonHerramienta, color: 'ia.main', border: 1, borderColor: 'ia.main', '&:hover': { bgcolor: alpha(theme.palette.ia.main, 0.08) } }}
                        >
                            {sugiriendo ? <CircularProgress size={18} color="inherit" /> : <Sparkles size={20} strokeWidth={1.75} aria-hidden />}
                        </IconButton>
                    </span>
                </Tooltip>
                {!tactil && (
                    <Typography sx={{ ml: 'auto', fontSize: 12, color: 'text.secondary', display: { xs: 'none', md: 'block' } }}>Enter envía · Shift+Enter baja de línea</Typography>
                )}
            </Box>

            <RespuestasRapidas
                abierto={rrAbierto}
                modo={rrModo}
                movil={movil}
                anchorEl={raiz.current}
                respuestas={respuestas}
                filtradas={filtradas}
                tags={tagsDe(respuestas)}
                tag={rrTag}
                onTag={(t) => { setRrTag(t); setRrIndice(0); }}
                busqueda={rrBusqueda}
                onBusqueda={(v) => { setRrBusqueda(v); setRrIndice(0); }}
                indice={rrIndice}
                onElegir={elegirRespuesta}
                onCerrar={() => { cerrarRr(); input.current?.focus(); }}
                puedeAdministrar={puedeAdministrarRespuestas}
            />
        </Box>
    );
}
