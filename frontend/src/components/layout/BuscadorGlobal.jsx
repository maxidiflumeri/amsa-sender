import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    ButtonBase,
    CircularProgress,
    Dialog,
    DialogTitle,
    IconButton,
    InputBase,
    Tooltip,
    Typography,
    useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import { CornerDownLeft, MessagesSquare, Search, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import IconoNav from './IconoNav';
import { filtrarItemsPorPermisos, navConfig, pantallasDelMenu } from './navConfig';

// El buscador de la barra, el mismo de AMSA Gestión (components/layout/AppShell/BuscadorGlobal.tsx): misma ventana,
// mismo orden y mismas teclas. Lo propio de Sender es qué busca además de las pantallas: deudores
// (`GET /deudores/buscar`) y conversaciones (`GET /wapi/inbox/buscar`), según los permisos.

/**
 * Pantallas que no están en el menú pero se buscan igual. Mi perfil se abre desde la foto; acá también se encuentra por
 * lo que tiene adentro ("tema", "notificaciones", "atajos").
 */
const PANTALLAS_FUERA_DEL_MENU = [
    {
        item: { label: 'Mi perfil', path: '/perfil', icon: 'UserRound' },
        grupo: null,
        detalle: 'Tus datos, el tema y las notificaciones',
        palabras: ['cuenta', 'tema', 'oscuro', 'claro', 'notificaciones', 'atajos', 'sesion'],
    },
];

/** Desde cuántas letras se buscan deudores y conversaciones (las pantallas se filtran desde la primera). */
const MIN_LETRAS = 2;
const POR_BUSQUEDA = 6;
const ESPERA_MS = 300;

const ES_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const ATAJO = `${ES_MAC ? '⌘' : 'Ctrl'} K`;

/** Sin tildes ni mayúsculas: "campanas" encuentra "Campañas". */
const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Una pantalla coincide si lo escrito empieza una de sus palabras ("camp" → Campañas, "monitor en" → Monitor en vivo).
 * Por el medio no: un apellido como "Ríos" encontraría otras cosas, quedaría primero y Enter llevaría ahí.
 */
const empiezaPalabra = (texto, q) => ` ${normalizar(texto)}`.includes(` ${q}`);

const ID_LISTA = 'buscador-global-lista';
const idOpcion = (i) => `buscador-global-opcion-${i}`;

/** El diálogo en sí. Se monta al abrirse, así cada vez arranca vacío. */
function DialogoBuscador({ onCerrar }) {
    const theme = useTheme();
    const navigate = useNavigate();
    const { hasPermiso } = useAuth();
    const puedeDeudores = hasPermiso('deudores.ver');
    const puedeConversaciones = hasPermiso('wapi.inbox');
    const buscaAlgoMas = puedeDeudores || puedeConversaciones;
    const [texto, setTexto] = useState('');
    const [activo, setActivo] = useState(0);
    const [remoto, setRemoto] = useState({ estado: 'inactivo' });
    const [intento, setIntento] = useState(0);
    const entradaRef = useRef(null);

    // El foco va al campo cuando el diálogo ya se montó: `autoFocus` solo no alcanza en modo estricto (el FocusTrap de
    // MUI se lo devuelve a lo que estaba enfocado). Con letra de 16 px, iOS no hace zoom al enfocarlo.
    useEffect(() => {
        const id = window.setTimeout(() => entradaRef.current?.focus(), 0);
        return () => window.clearTimeout(id);
    }, []);

    // Con el buscador abierto, Ctrl+K vuelve al campo (si no, el navegador manda el foco a su barra de direcciones).
    useEffect(() => {
        const alTeclear = (e) => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return;
            e.preventDefault();
            entradaRef.current?.focus();
            entradaRef.current?.select();
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, []);

    const termino = texto.trim();
    const buscaRemoto = buscaAlgoMas && termino.length >= MIN_LETRAS;

    useEffect(() => {
        if (!buscaRemoto) {
            setRemoto({ estado: 'inactivo' });
            return undefined;
        }
        setRemoto({ estado: 'cargando' });
        const control = new AbortController();
        const espera = setTimeout(async () => {
            const [d, c] = await Promise.allSettled([
                puedeDeudores
                    ? api.get('/deudores/buscar', { params: { q: termino, page: 0, size: POR_BUSQUEDA }, signal: control.signal })
                    : Promise.resolve({ data: { data: [], total: 0 } }),
                puedeConversaciones
                    ? api.get('/wapi/inbox/buscar', { params: { q: termino }, signal: control.signal })
                    : Promise.resolve({ data: { items: [], total: 0 } }),
            ]);
            if (control.signal.aborted) return;
            if ((!puedeDeudores || d.status === 'rejected') && (!puedeConversaciones || c.status === 'rejected')) {
                setRemoto({ estado: 'error' });
                return;
            }
            const deudores = d.status === 'fulfilled' && Array.isArray(d.value.data?.data) ? d.value.data.data : [];
            const conversaciones = c.status === 'fulfilled' && Array.isArray(c.value.data?.items) ? c.value.data.items : [];
            setRemoto({
                estado: 'listo',
                deudores: deudores.slice(0, POR_BUSQUEDA),
                totalDeudores: Number(d.status === 'fulfilled' ? d.value.data?.total ?? deudores.length : 0),
                conversaciones: conversaciones.slice(0, POR_BUSQUEDA),
                totalConversaciones: Number(c.status === 'fulfilled' ? c.value.data?.total ?? conversaciones.length : 0),
                fallo: d.status === 'rejected' || c.status === 'rejected',
            });
        }, ESPERA_MS);
        return () => {
            clearTimeout(espera);
            control.abort();
        };
    }, [buscaRemoto, termino, intento, puedeDeudores, puedeConversaciones]);

    const pantallas = useMemo(
        () => [...pantallasDelMenu(filtrarItemsPorPermisos(navConfig, hasPermiso)), ...PANTALLAS_FUERA_DEL_MENU],
        [hasPermiso],
    );
    const q = normalizar(texto);
    const pantallasQueCoinciden = useMemo(() => {
        if (!q) return pantallas;
        const coinciden = pantallas.filter(({ item, grupo, palabras }) =>
            empiezaPalabra(item.label, q) || (!!grupo && empiezaPalabra(grupo.label, q)) || (palabras ?? []).some((pal) => empiezaPalabra(pal, q)));
        // Primero las que empiezan con lo escrito.
        return [...coinciden].sort((a, b) => Number(!normalizar(a.item.label).startsWith(q)) - Number(!normalizar(b.item.label).startsWith(q)));
    }, [pantallas, q]);

    const dePantallas = pantallasQueCoinciden.map(({ item, grupo, detalle }) => ({
        tipo: 'pantalla',
        clave: `p:${item.path}`,
        titulo: item.label,
        detalle: detalle ?? grupo?.label ?? null,
        icono: (grupo ?? item).icon,
        path: item.path,
    }));
    const deDeudores = remoto.estado === 'listo'
        ? remoto.deudores.map((x) => ({
            tipo: 'deudor',
            clave: `d:${x.id}`,
            titulo: x.nombre || `Deudor ${x.id}`,
            detalle: [x.documento ? `Doc. ${x.documento}` : 'Sin documento', x.empresa ? `Empresa ${x.empresa}` : null, x.remesa ? `Remesa ${x.remesa}` : null].filter(Boolean).join(' · '),
            path: `/deudores/${x.id}`,
        }))
        : [];
    const deConversaciones = remoto.estado === 'listo'
        ? remoto.conversaciones.map((x) => ({
            tipo: 'conversacion',
            clave: `c:${x.id}`,
            titulo: x.nombre || x.numero,
            detalle: [x.nombre ? x.numero : null, `#${x.id}`, x.config?.nombre].filter(Boolean).join(' · '),
            path: `/wapi/inbox?c=${x.id}`,
        }))
        : [];
    // Las pantallas van primero porque salen al instante: si lo del servidor llegara arriba, lo marcado se correría.
    const grupos = [
        { id: 'pantallas', titulo: 'Pantallas', opciones: dePantallas },
        { id: 'deudores', titulo: 'Deudores', opciones: deDeudores },
        { id: 'conversaciones', titulo: 'Conversaciones', opciones: deConversaciones },
    ].filter((g) => g.opciones.length > 0);
    const opciones = grupos.flatMap((g) => g.opciones);
    const indice = opciones.length === 0 ? -1 : Math.min(activo, opciones.length - 1);

    useEffect(() => {
        if (indice < 0) return;
        const el = document.getElementById(idOpcion(indice));
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
    }, [indice]);

    const elegir = (op) => {
        onCerrar();
        navigate(op.path);
    };

    const alTeclear = (e) => {
        const n = opciones.length;
        if (e.key === 'ArrowDown' && n > 0) {
            e.preventDefault();
            setActivo((indice + 1) % n);
        } else if (e.key === 'ArrowUp' && n > 0) {
            e.preventDefault();
            setActivo((indice - 1 + n) % n);
        } else if (e.key === 'Enter' && indice >= 0) {
            e.preventDefault();
            elegir(opciones[indice]);
        }
    };

    const queBusca = [puedeDeudores && 'un deudor (nombre o documento)', puedeConversaciones && 'una conversación (nombre, teléfono o #id)'].filter(Boolean);
    let estado = null;
    if (!termino) {
        estado = queBusca.length ? `Escribí ${queBusca.join(', ')} o el nombre de una pantalla.` : 'Escribí el nombre de una pantalla.';
    } else if (buscaAlgoMas && termino.length < MIN_LETRAS) {
        estado = puedeDeudores ? 'Seguí escribiendo para buscar deudores.' : 'Seguí escribiendo para buscar conversaciones.';
    } else if (remoto.estado === 'cargando') {
        estado = (
            <>
                <CircularProgress size={12} sx={{ mr: 1, verticalAlign: 'middle' }} />
                Buscando…
            </>
        );
    } else if (remoto.estado === 'error' || (remoto.estado === 'listo' && remoto.fallo)) {
        estado = (
            <>
                {remoto.estado === 'error' ? 'No se pudo buscar.' : 'Parte de la búsqueda no respondió.'}
                <Button size="small" onClick={() => setIntento((n) => n + 1)} sx={{ ml: 1, py: 0, minWidth: 0 }}>
                    Reintentar
                </Button>
            </>
        );
    } else if (remoto.estado === 'listo' && deDeudores.length === 0 && deConversaciones.length === 0) {
        estado = dePantallas.length ? 'Ningún deudor ni conversación coincide.' : `Nada coincide con «${termino}».`;
    } else if (remoto.estado === 'listo' && (remoto.totalDeudores > deDeudores.length || remoto.totalConversaciones > deConversaciones.length)) {
        estado = 'Hay más resultados: seguí escribiendo para afinar.';
    } else if (opciones.length === 0) {
        estado = `Ninguna pantalla coincide con «${termino}».`;
    }

    const marcado = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.1);
    let n = -1;

    return (
        <Dialog
            open
            onClose={onCerrar}
            fullWidth
            maxWidth="sm"
            aria-labelledby="buscador-global-titulo"
            sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
            PaperProps={{
                sx: {
                    mt: { xs: 'calc(12px + env(safe-area-inset-top))', sm: '12vh' },
                    mx: { xs: 1.5, sm: 4 },
                    width: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
                    // Desde `md`, el mismo ancho que el campo de la barra (centrado en la pantalla, como esta ventana):
                    // los bordes de los dos coinciden.
                    maxWidth: { md: 560 },
                    borderRadius: '16px',
                    overflow: 'hidden',
                },
            }}
        >
            <DialogTitle id="buscador-global-titulo" sx={visuallyHidden}>
                Buscar en AMSA Sender
            </DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, borderBottom: 1, borderColor: 'divider', color: 'text.secondary' }}>
                <Search size={20} strokeWidth={1.75} aria-hidden />
                <InputBase
                    inputRef={entradaRef}
                    autoFocus
                    fullWidth
                    value={texto}
                    onChange={(e) => {
                        setTexto(e.target.value);
                        setActivo(0);
                    }}
                    onKeyDown={alTeclear}
                    placeholder={buscaAlgoMas ? 'Buscar un deudor, una conversación o una pantalla' : 'Buscar una pantalla'}
                    inputProps={{
                        role: 'combobox',
                        'aria-label': buscaAlgoMas ? 'Buscar un deudor, una conversación o una pantalla' : 'Buscar una pantalla',
                        'aria-expanded': opciones.length > 0,
                        'aria-controls': ID_LISTA,
                        'aria-autocomplete': 'list',
                        'aria-activedescendant': indice >= 0 ? idOpcion(indice) : undefined,
                        autoComplete: 'off',
                        spellCheck: false,
                        enterKeyHint: 'search',
                    }}
                    sx={{ py: 1.75, fontSize: '1rem', color: 'text.primary' }}
                />
            </Box>

            <Typography
                role="status"
                variant="caption"
                component="div"
                color="text.secondary"
                sx={{ px: 2.5, pt: 1.25, pb: estado ? 0.5 : 0, minHeight: estado ? undefined : 0 }}
            >
                {estado}
            </Typography>

            <Box id={ID_LISTA} role="listbox" aria-label="Resultados" sx={{ maxHeight: { xs: '60vh', sm: '50vh' }, overflowY: 'auto', py: 1 }}>
                {grupos.map((g) => (
                    <Box key={g.id} role="group" aria-labelledby={`buscador-global-grupo-${g.id}`} sx={{ mb: 0.5 }}>
                        <Typography
                            id={`buscador-global-grupo-${g.id}`}
                            role="presentation"
                            component="div"
                            sx={{ px: 2.5, pt: 1, pb: 0.5, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}
                        >
                            {g.titulo}
                        </Typography>
                        {g.opciones.map((op) => {
                            n += 1;
                            const i = n;
                            const sel = i === indice;
                            return (
                                <Box
                                    key={op.clave}
                                    id={idOpcion(i)}
                                    role="option"
                                    aria-selected={sel}
                                    data-tipo={op.tipo}
                                    onMouseMove={() => i !== indice && setActivo(i)}
                                    onClick={() => elegir(op)}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        mx: 1,
                                        px: 1.5,
                                        py: 0.875,
                                        minHeight: { xs: 48, md: 0 },
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        bgcolor: sel ? marcado : 'transparent',
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            flex: 'none',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            bgcolor: 'action.hover',
                                            color: sel ? 'primary.main' : 'text.secondary',
                                        }}
                                    >
                                        {op.tipo === 'pantalla' && <IconoNav nombre={op.icono} size={18} />}
                                        {op.tipo === 'deudor' && <UserRound size={18} strokeWidth={1.75} aria-hidden />}
                                        {op.tipo === 'conversacion' && <MessagesSquare size={18} strokeWidth={1.75} aria-hidden />}
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="body2" fontWeight={500} noWrap>
                                            {op.titulo}
                                        </Typography>
                                        {op.detalle && (
                                            <Typography variant="caption" component="div" color="text.secondary" noWrap>
                                                {op.detalle}
                                            </Typography>
                                        )}
                                    </Box>
                                    {sel && (
                                        <Box sx={{ color: 'text.secondary', display: { xs: 'none', md: 'flex' } }}>
                                            <CornerDownLeft size={16} strokeWidth={1.75} aria-hidden />
                                        </Box>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                ))}
            </Box>

            <Box
                aria-hidden
                sx={{ display: { xs: 'none', sm: 'flex' }, gap: 2, px: 2.5, py: 1, borderTop: 1, borderColor: 'divider', color: 'text.secondary', fontSize: '0.75rem' }}
            >
                <span>↑ ↓ para moverte</span>
                <span>Enter para abrir</span>
                <span>Esc para cerrar</span>
            </Box>
        </Dialog>
    );
}

/**
 * Hay algo modal abierto (un diálogo, un menú, un Select desplegado): el atajo no le abre el buscador encima. Los cajones
 * que quedan montados cerrados (`keepMounted`, como el menú del celular) llevan `MuiModal-hidden`.
 */
const hayOtroModal = () =>
    Array.from(document.querySelectorAll('.MuiModal-root, [role="dialog"]')).some((m) => {
        const raiz = m.closest('.MuiModal-root') ?? m;
        return !raiz.classList.contains('MuiModal-hidden') && raiz.style.visibility !== 'hidden';
    });

/**
 * El buscador de la barra superior: pantallas del menú (según los permisos), deudores y conversaciones. Se abre con un
 * clic o con Ctrl+K / Cmd+K desde cualquier pantalla.
 */
export default function BuscadorGlobal() {
    const theme = useTheme();
    // Debajo de `md` va solo el ícono: en el celular y en la tablet la barra no tiene lugar para el campo.
    const chico = useMediaQuery(theme.breakpoints.down('md'));
    const { hasPermiso } = useAuth();
    const buscaAlgoMas = hasPermiso('deudores.ver') || hasPermiso('wapi.inbox');
    const [abierto, setAbierto] = useState(false);
    const etiqueta = buscaAlgoMas ? 'Buscar deudor, conversación o pantalla' : 'Buscar una pantalla';

    useEffect(() => {
        if (abierto) return undefined;
        const alTeclear = (e) => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return;
            if (hayOtroModal()) return;
            e.preventDefault();
            setAbierto(true);
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [abierto]);

    const abrir = () => setAbierto(true);

    return (
        <>
            {chico ? (
                <Tooltip title="Buscar">
                    <IconButton onClick={abrir} aria-label={etiqueta} aria-keyshortcuts="Control+K Meta+K" sx={{ color: 'text.secondary', width: 44, height: 44 }}>
                        <Search size={20} strokeWidth={1.75} aria-hidden />
                    </IconButton>
                </Tooltip>
            ) : (
                <ButtonBase
                    onClick={abrir}
                    aria-label={etiqueta}
                    aria-keyshortcuts="Control+K Meta+K"
                    sx={{
                        width: '100%',
                        maxWidth: { md: 560 },
                        height: 40,
                        justifyContent: 'flex-start',
                        gap: 1.25,
                        px: 1.5,
                        borderRadius: '12px',
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        color: 'text.secondary',
                        transition: theme.transitions.create('border-color', { duration: theme.transitions.duration.shortest }),
                        '&:hover': { borderColor: 'primary.main' },
                        '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                    }}
                >
                    <Search size={18} strokeWidth={1.75} aria-hidden />
                    <Typography variant="body2" color="inherit" noWrap sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        {etiqueta}
                    </Typography>
                    <Box
                        component="kbd"
                        aria-hidden
                        sx={{
                            flex: 'none',
                            fontFamily: 'inherit',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            lineHeight: 1,
                            px: 0.875,
                            py: 0.625,
                            borderRadius: '6px',
                            border: 1,
                            borderColor: 'divider',
                            bgcolor: 'background.default',
                            color: 'text.secondary',
                        }}
                    >
                        {ATAJO}
                    </Box>
                </ButtonBase>
            )}

            {abierto && <DialogoBuscador onCerrar={() => setAbierto(false)} />}
        </>
    );
}
