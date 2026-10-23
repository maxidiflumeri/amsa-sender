import { useEffect, useRef, useState } from 'react';
import {
    Box, Chip, CircularProgress, IconButton, InputAdornment, InputBase, ListItemIcon, Menu, MenuItem,
    Select, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ChevronDown, ChevronUp, Clock, CircleAlert, MailOpen, Megaphone, RefreshCw, Search, Smartphone, User, X } from 'lucide-react';
import { AvatarUsuario, BloqueEstado, EmptyState } from '../../ui';
import { formatFechaLista, urgenciaDe, vistaPrevia } from './utils';

// La lista de conversaciones: título, línea, buscador, filtros y las secciones con sus contadores. Maneja su propio
// scroll (el marco le da todo el alto). Los filtros y la búsqueda viven en el padre porque van a la URL y al servidor.

const COLOR_AVATAR = { resuelta: 'text.disabled', sin_asignar: 'warning.main', asignada: 'primary.main' };

function Urgencia({ conv }) {
    const u = urgenciaDe(conv);
    if (!u) return null;
    const Icono = u.nivel === 'error' ? CircleAlert : Clock;
    return (
        // Texto además del color: el daltonismo y el sol en la calle no distinguen ámbar de rojo.
        <Box component="span" title={u.detalle} aria-label={u.detalle} role="img" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, flex: 'none', fontSize: 12, fontWeight: 700, color: u.nivel === 'error' ? 'error.main' : 'warning.dark' }}>
            <Icono size={13} strokeWidth={2} aria-hidden />
            {u.texto}
        </Box>
    );
}

function FilaConversacion({ conv, activa, escribiendo, borrador, mostrarLinea, onSelect, onMenu }) {
    const sinLeer = (conv.unreadCount ?? 0) > 0;
    const preview = vistaPrevia(conv);
    const nombre = conv.nombre ?? conv.numero;
    return (
        <Box
            component="button"
            type="button"
            onClick={() => onSelect(conv)}
            onContextMenu={(e) => {
                // El click derecho queda como atajo; la misma acción está en el menú "Más" del chat.
                e.preventDefault();
                onMenu?.(e, conv);
            }}
            aria-current={activa ? 'true' : undefined}
            sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%', minHeight: 64, px: 2, py: 1.25,
                border: 0, borderBottom: 1, borderColor: 'divider', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'text.primary',
                bgcolor: activa ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: activa ? 'action.selected' : 'action.hover' },
                '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
            }}
        >
            <AvatarUsuario nombre={nombre} size={40} sx={{ bgcolor: COLOR_AVATAR[conv.estado] ?? 'primary.main', flex: 'none', mt: 0.25 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography noWrap sx={{ flex: 1, fontSize: 15, fontWeight: sinLeer ? 700 : 600 }}>{nombre}</Typography>
                    <Typography sx={{ flex: 'none', fontSize: 12, color: sinLeer ? 'success.main' : 'text.secondary', fontWeight: sinLeer ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
                        {formatFechaLista(conv.ultimoMensajeAt)}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25, minHeight: 20 }}>
                    {escribiendo ? (
                        <Typography noWrap sx={{ flex: 1, fontSize: 13, color: 'success.main', fontStyle: 'italic' }}>escribiendo…</Typography>
                    ) : borrador ? (
                        <Typography noWrap sx={{ flex: 1, fontSize: 13, color: 'text.secondary' }}>
                            <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>Borrador: </Box>
                            {borrador}
                        </Typography>
                    ) : (
                        <Typography noWrap sx={{ flex: 1, fontSize: 13, color: 'text.secondary', fontWeight: sinLeer ? 600 : 400 }}>{preview}</Typography>
                    )}
                    <Urgencia conv={conv} />
                    {sinLeer && (
                        <Box aria-label={`${conv.unreadCount} sin leer`} sx={{ flex: 'none', minWidth: 20, height: 20, px: 0.75, borderRadius: '10px', bgcolor: 'success.main', color: 'common.white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </Box>
                    )}
                </Box>
                {(conv.asignadoA || conv.campañaNombre || mostrarLinea) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mt: 0.5, color: 'text.secondary', fontSize: 12 }}>
                        {conv.asignadoA && (
                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'info.main', fontWeight: 500, minWidth: 0 }}>
                                <User size={13} strokeWidth={1.75} aria-hidden />
                                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{conv.asignadoA.nombre}</Box>
                            </Box>
                        )}
                        {conv.campañaNombre && (
                            <Box component="span" title={conv.campañaNombre} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                <Megaphone size={13} strokeWidth={1.75} aria-hidden />
                                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{conv.campañaNombre}</Box>
                            </Box>
                        )}
                        {mostrarLinea && (
                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                <Smartphone size={13} strokeWidth={1.75} aria-hidden />
                                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{conv.config?.nombre ?? `Línea ${conv.configId}`}</Box>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}

/**
 * Una sección (Mis activas, Sin asignar…) con su contador. Con `onLoadMore` es de carga diferida: no pide nada hasta
 * abrirla y después pagina con el scroll.
 */
function SeccionLista({ titulo, convs, tono, abiertaInicial = true, forzarAbierta = false, onSelect, onMenu, typingNums, borradores, mostrarLinea, convActivaId, lazy }) {
    const [abierta, setAbierta] = useState(abiertaInicial);
    const centinela = useRef(null);
    const visible = abierta || forzarAbierta;
    const total = lazy ? lazy.total : convs.length;
    const hayMas = lazy ? convs.length < lazy.total : false;

    useEffect(() => {
        if (!lazy || !visible || !centinela.current) return undefined;
        const obs = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !lazy.cargando && hayMas) lazy.onMas(Math.floor(convs.length / 25));
        }, { threshold: 0.1 });
        obs.observe(centinela.current);
        return () => obs.disconnect();
    }, [lazy, visible, hayMas, convs.length]);

    const alternar = () => {
        const siguiente = !abierta;
        setAbierta(siguiente);
        if (siguiente && lazy && !lazy.cargadas) lazy.onMas(0);
    };

    if (!lazy && !convs.length) return null;
    const contador = lazy && !lazy.cargadas ? '…' : total;
    const resalta = tono === 'aviso' && total > 0;

    return (
        <Box>
            <Box
                component="button"
                type="button"
                onClick={alternar}
                aria-expanded={visible}
                disabled={forzarAbierta}
                sx={{
                    display: 'flex', alignItems: 'center', gap: 1, width: '100%', minHeight: 44, px: 2, border: 0, borderBottom: 1, borderColor: 'divider',
                    bgcolor: 'background.default', cursor: forzarAbierta ? 'default' : 'pointer', font: 'inherit', textAlign: 'left',
                    color: resalta ? 'warning.dark' : 'text.secondary',
                    '&:hover': { bgcolor: forzarAbierta ? 'background.default' : 'action.hover' },
                }}
            >
                <Typography sx={{ flex: 1, fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'inherit' }}>{titulo}</Typography>
                <Chip
                    label={contador}
                    size="small"
                    sx={(theme) => ({ height: 22, fontSize: 12, fontWeight: 700, bgcolor: resalta ? alpha(theme.palette.warning.main, 0.18) : 'action.hover', color: 'inherit' })}
                />
                {!forzarAbierta && (visible ? <ChevronUp size={16} strokeWidth={1.75} aria-hidden /> : <ChevronDown size={16} strokeWidth={1.75} aria-hidden />)}
            </Box>
            {visible && (
                <>
                    {lazy && lazy.cargando && convs.length === 0 ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
                    ) : (
                        convs.map((c) => (
                            <FilaConversacion
                                key={c.id}
                                conv={c}
                                activa={convActivaId === c.id}
                                escribiendo={typingNums.has(c.numero)}
                                borrador={borradores[c.id]}
                                mostrarLinea={mostrarLinea}
                                onSelect={onSelect}
                                onMenu={onMenu}
                            />
                        ))
                    )}
                    {lazy && lazy.cargadas && convs.length === 0 && (
                        <Typography sx={{ px: 2, py: 2, fontSize: 13, color: 'text.secondary' }}>No hay conversaciones resueltas.</Typography>
                    )}
                    {lazy && (hayMas || (lazy.cargando && convs.length > 0)) && (
                        <Box ref={centinela} sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
                            {lazy.cargando && <CircularProgress size={16} />}
                        </Box>
                    )}
                </>
            )}
        </Box>
    );
}

const CHIPS_FILTRO = [
    { valor: 'mias', etiqueta: 'Mías' },
    { valor: 'sin_asignar', etiqueta: 'Sin asignar' },
    { valor: 'otros', etiqueta: 'De otros', soloAdmin: true },
    { valor: 'resueltas', etiqueta: 'Resueltas' },
];

/**
 * @param {object} props
 * @param {object[]} props.configs Las líneas.
 * @param {number|null} props.lineaId
 * @param {string} props.filtro `mias | sin_asignar | otros | resueltas` o ''.
 * @param {{mias: object[], sinAsignar: object[], otras: object[]}} props.secciones
 * @param {object} props.resueltas `{ items, total, cargando, cargadas, onMas }`.
 * @param {object[]} props.resultados Resultados de la búsqueda en el servidor.
 */
export default function ListaConversaciones({
    configs, lineaId, onLinea, busqueda, onBusqueda, filtro, onFiltro, esAdmin, cargando, error, onReintentar, onRefrescar,
    secciones, resueltas, resultados, buscando, convActivaId, onSelect, onMarcarNoLeida, typingNums, borradores, sx,
}) {
    const [menu, setMenu] = useState(null); // { x, y, conv }
    const termino = busqueda.trim();
    const buscandoEnServidor = termino.length >= 2;
    const mostrarLinea = lineaId === null && configs.length > 1;
    const hayAlgo = secciones.mias.length || secciones.sinAsignar.length || secciones.otras.length || resueltas.total;

    const conteo = { mias: secciones.mias.length, sin_asignar: secciones.sinAsignar.length, otros: secciones.otras.length, resueltas: null };
    const seccionProps = { onSelect, onMenu: (e, conv) => setMenu({ x: e.clientX, y: e.clientY, conv }), typingNums, borradores, mostrarLinea, convActivaId };
    const ver = (clave) => !filtro || filtro === clave;
    const etiquetaFiltro = CHIPS_FILTRO.find((c) => c.valor === filtro)?.etiqueta;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, bgcolor: 'background.paper', ...sx }}>
            <Box sx={{ px: 2, pt: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography component="h1" sx={{ flex: 1, fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>Conversaciones</Typography>
                    <IconButton aria-label="Actualizar la lista" onClick={onRefrescar} sx={{ width: 44, height: 44, mr: -1 }}>
                        <RefreshCw size={18} strokeWidth={1.75} aria-hidden />
                    </IconButton>
                </Box>

                {configs.length > 1 && (
                    <Select
                        value={lineaId ?? ''}
                        onChange={(e) => onLinea(e.target.value === '' ? null : Number(e.target.value))}
                        displayEmpty
                        size="small"
                        inputProps={{ 'aria-label': 'Línea' }}
                        renderValue={(v) => (
                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                <Smartphone size={16} strokeWidth={1.75} aria-hidden />
                                {v === '' ? 'Todas las líneas' : (configs.find((c) => c.id === v)?.nombre ?? `Línea ${v}`)}
                            </Box>
                        )}
                        sx={{ '& .MuiSelect-select': { minHeight: { xs: 44, md: 40 }, py: 0, display: 'flex', alignItems: 'center' } }}
                    >
                        <MenuItem value="" sx={{ minHeight: 44 }}>Todas las líneas</MenuItem>
                        {configs.map((c) => (
                            <MenuItem key={c.id} value={c.id} sx={{ minHeight: 44 }}>{c.nombre ?? `Línea ${c.id}`}</MenuItem>
                        ))}
                    </Select>
                )}

                <InputBase
                    value={busqueda}
                    onChange={(e) => onBusqueda(e.target.value)}
                    placeholder="Buscar por número o nombre"
                    inputProps={{ 'aria-label': 'Buscar conversaciones', enterKeyHint: 'search' }}
                    startAdornment={<InputAdornment position="start" sx={{ color: 'text.secondary', ml: 0.5 }}><Search size={18} strokeWidth={1.75} aria-hidden /></InputAdornment>}
                    endAdornment={busqueda ? (
                        <IconButton aria-label="Borrar la búsqueda" onClick={() => onBusqueda('')} sx={{ width: { xs: 44, md: 36 }, height: { xs: 44, md: 36 }, mr: 0 }}>
                            <X size={16} strokeWidth={1.75} aria-hidden />
                        </IconButton>
                    ) : null}
                    sx={{
                        // 16 px en el celular: con menos, iOS hace zoom al enfocar.
                        fontSize: { xs: 16, md: 14 }, minHeight: { xs: 44, md: 40 }, px: 1, borderRadius: '10px', border: 1, borderColor: 'divider',
                        bgcolor: 'background.default', '&:focus-within': { borderColor: 'primary.main' },
                    }}
                />

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }} role="group" aria-label="Filtros">
                    {CHIPS_FILTRO.filter((c) => !c.soloAdmin || esAdmin).map((c) => {
                        const activo = filtro === c.valor;
                        const n = conteo[c.valor];
                        return (
                            <Chip
                                key={c.valor}
                                label={n === null || n === undefined ? c.etiqueta : `${c.etiqueta} ${n}`}
                                onClick={() => onFiltro(activo ? '' : c.valor)}
                                color={activo ? 'primary' : 'default'}
                                variant={activo ? 'filled' : 'outlined'}
                                aria-pressed={activo}
                                sx={{ height: { xs: 44, md: 32 }, borderRadius: '22px', fontSize: 14, fontWeight: 600, '& .MuiChip-label': { px: 1.75 } }}
                            />
                        );
                    })}
                </Box>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
                {cargando ? (
                    <BloqueEstado estado="cargando" mensaje="Cargando conversaciones…" />
                ) : error ? (
                    <Box sx={{ p: 2 }}><BloqueEstado estado="error" mensaje="No se pudieron cargar las conversaciones." onReintentar={onReintentar} /></Box>
                ) : buscandoEnServidor ? (
                    buscando ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
                    ) : resultados.length ? (
                        <SeccionLista titulo={`Resultados (${resultados.length})`} convs={resultados} {...seccionProps} />
                    ) : (
                        <EmptyState compact icon={Search} title="Sin resultados" description={`No hay conversaciones para "${termino}".`} />
                    )
                ) : (
                    <>
                        {ver('mias') && <SeccionLista titulo="Mis activas" convs={secciones.mias} forzarAbierta={!!filtro} {...seccionProps} />}
                        {ver('sin_asignar') && <SeccionLista titulo="Sin asignar" tono="aviso" convs={secciones.sinAsignar} forzarAbierta={!!filtro} {...seccionProps} />}
                        {esAdmin && ver('otros') && <SeccionLista titulo="Asignadas a otros" convs={secciones.otras} abiertaInicial={false} forzarAbierta={!!filtro} {...seccionProps} />}
                        {ver('resueltas') && (
                            <SeccionLista
                                key={`resueltas-${lineaId ?? 'todas'}`}
                                titulo="Resueltas"
                                convs={resueltas.items}
                                abiertaInicial={false}
                                forzarAbierta={filtro === 'resueltas'}
                                lazy={resueltas}
                                {...seccionProps}
                            />
                        )}
                        {!hayAlgo && !filtro && <EmptyState compact icon={MailOpen} title="Sin conversaciones" description="Cuando un cliente escriba, va a aparecer acá." />}
                        {filtro && filtro !== 'resueltas' && !conteo[filtro] && (
                            <EmptyState compact icon={MailOpen} title={`Nada en "${etiquetaFiltro}"`} description="Sacá el filtro para ver todas las conversaciones." action={{ label: 'Ver todas', onClick: () => onFiltro('') }} />
                        )}
                    </>
                )}
            </Box>

            <Menu
                open={!!menu}
                onClose={() => setMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
            >
                <MenuItem
                    disabled={(menu?.conv?.unreadCount ?? 0) > 0}
                    onClick={() => {
                        const conv = menu?.conv;
                        setMenu(null);
                        if (conv) onMarcarNoLeida(conv);
                    }}
                    sx={{ minHeight: 44 }}
                >
                    <ListItemIcon><MailOpen size={18} strokeWidth={1.75} aria-hidden /></ListItemIcon>
                    Marcar como no leída
                </MenuItem>
            </Menu>
        </Box>
    );
}
