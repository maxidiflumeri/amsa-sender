import { useEffect, useRef } from 'react';
import { Box, Chip, Drawer, Fade, IconButton, InputBase, Link, Paper, Popper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Search, X } from 'lucide-react';

// Las respuestas rápidas: un Popper sobre el compositor en la computadora y un Drawer desde abajo en el celular
// (un popover de 380 px con el teclado abierto no entra). Lo elegido lo inserta el Compositor en el cursor.

function Contenido({ modo, movil, respuestas, filtradas, tags, tag, onTag, busqueda, onBusqueda, indice, onElegir, onCerrar, puedeAdministrar }) {
    const activa = useRef(null);
    // Con las flechas del teclado, la fila activa tiene que quedar a la vista.
    useEffect(() => {
        activa.current?.scrollIntoView?.({ block: 'nearest' });
    }, [indice]);

    // Con "/" el filtro es lo que se escribe en el mensaje; con el botón (y en el celular) hay un buscador propio.
    const conBuscador = modo === 'boton' || movil;
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
            <Box sx={{ px: 2, pt: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography component="h2" sx={{ fontSize: 16, fontWeight: 650 }}>Respuestas rápidas</Typography>
                    <IconButton aria-label="Cerrar las respuestas rápidas" onClick={onCerrar} sx={{ width: 44, height: 44, mr: -1 }}>
                        <X size={18} strokeWidth={1.75} aria-hidden />
                    </IconButton>
                </Box>
                {conBuscador && (
                    <InputBase
                        autoFocus={!movil}
                        value={busqueda}
                        onChange={(e) => onBusqueda(e.target.value)}
                        placeholder="Buscar una respuesta"
                        inputProps={{ 'aria-label': 'Buscar una respuesta rápida' }}
                        startAdornment={<Box sx={{ color: 'text.secondary', display: 'inline-flex', mr: 1 }}><Search size={18} strokeWidth={1.75} aria-hidden /></Box>}
                        sx={{ fontSize: { xs: 16, md: 14 }, minHeight: 44, px: 1.5, border: 1, borderColor: 'divider', borderRadius: '10px', '&:focus-within': { borderColor: 'primary.main' } }}
                    />
                )}
                {tags.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        <Chip label="Todas" color={!tag ? 'primary' : 'default'} variant={!tag ? 'filled' : 'outlined'} onClick={() => onTag('')} sx={{ height: 32, fontSize: 13 }} />
                        {tags.map((t) => (
                            <Chip key={t} label={t} color={tag === t ? 'primary' : 'default'} variant={tag === t ? 'filled' : 'outlined'} onClick={() => onTag(tag === t ? '' : t)} sx={{ height: 32, fontSize: 13 }} />
                        ))}
                    </Box>
                )}
            </Box>
            <Box role="listbox" aria-label="Respuestas rápidas" sx={{ overflowY: 'auto', flex: 1, minHeight: 0, borderTop: 1, borderColor: 'divider' }}>
                {filtradas.length === 0 ? (
                    <Box sx={{ p: 2.5, textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                            {respuestas.length === 0 ? 'Todavía no hay respuestas rápidas cargadas.' : 'Ninguna respuesta coincide con la búsqueda.'}
                        </Typography>
                        {respuestas.length === 0 && puedeAdministrar && (
                            <Link component={RouterLink} to="/config/respuestas-rapidas" sx={{ fontSize: 14, display: 'inline-block', mt: 0.5, minHeight: 44, lineHeight: '44px' }}>Cargar respuestas rápidas</Link>
                        )}
                    </Box>
                ) : (
                    filtradas.map((r, i) => (
                        <Box
                            key={r.id}
                            role="option"
                            aria-selected={i === indice}
                            ref={i === indice ? activa : undefined}
                            onClick={() => onElegir(r)}
                            sx={{ minHeight: 44, px: 2, py: 1, cursor: 'pointer', borderBottom: 1, borderColor: 'divider', bgcolor: i === indice ? 'action.selected' : 'transparent', '&:hover': { bgcolor: 'action.hover' } }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{r.titulo}</Typography>
                                {(r.tags ?? []).map((t) => <Chip key={t} label={t} size="small" sx={{ height: 20, fontSize: 12 }} />)}
                            </Box>
                            <Typography noWrap sx={{ fontSize: 13, color: 'text.secondary' }}>{r.contenido.replace(/\s+/g, ' ')}</Typography>
                        </Box>
                    ))
                )}
            </Box>
            {!movil && modo === 'slash' && (
                <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover' }}>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>↑↓ navegar · Enter insertar · Esc cerrar · seguí escribiendo para filtrar</Typography>
                </Box>
            )}
        </Box>
    );
}

/**
 * @param {object} props
 * @param {boolean} props.abierto
 * @param {'slash'|'boton'} props.modo
 * @param {boolean} props.movil Drawer desde abajo en lugar de Popper.
 * @param {HTMLElement|null} props.anchorEl Sobre qué se ancla el Popper.
 */
export default function RespuestasRapidas({ abierto, movil, anchorEl, onCerrar, ...resto }) {
    if (movil) {
        return (
            <Drawer
                anchor="bottom"
                open={abierto}
                onClose={onCerrar}
                PaperProps={{ sx: { maxHeight: '80dvh', height: '80dvh', borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: 'env(safe-area-inset-bottom)' } }}
            >
                <Contenido movil onCerrar={onCerrar} {...resto} />
            </Drawer>
        );
    }
    return (
        <Popper open={abierto && !!anchorEl} anchorEl={anchorEl} placement="top-start" transition style={{ zIndex: 1300, width: Math.min(anchorEl?.offsetWidth ?? 480, 640) }}>
            {({ TransitionProps }) => (
                <Fade {...TransitionProps} timeout={150}>
                    <Paper variant="outlined" sx={{ mb: 0.5, maxHeight: 400, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '14px' }}>
                        {/* Se cierra con Esc, con la X o al elegir: un toque en el chat no tiene que perder la búsqueda. */}
                        <Contenido movil={false} onCerrar={onCerrar} {...resto} />
                    </Paper>
                </Fade>
            )}
        </Popper>
    );
}
