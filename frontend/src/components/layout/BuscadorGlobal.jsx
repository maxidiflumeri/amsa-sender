import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    ButtonBase,
    CircularProgress,
    Dialog,
    IconButton,
    InputBase,
    Tooltip,
    Typography,
    useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowRight, MessagesSquare, Search, User, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { filtrarItemsPorPermisos, navConfig, pantallasDelMenu } from './navConfig';

// El buscador de la barra, como el de AMSA Gestión: Ctrl+K (Cmd+K) desde cualquier pantalla o un toque en la barra.
// Busca pantallas del menú (al instante), deudores (`GET /deudores/buscar`) y conversaciones
// (`GET /wapi/inbox/buscar`), según los permisos. Patrón combobox + listbox, flechas con vuelta, Enter abre, Esc cierra.

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Coincide si lo escrito es el comienzo de alguna palabra ("camp" encuentra "Campañas", "ñas" no). */
const empiezaPalabra = (texto, q) => sinTildes(texto).split(/[\s/·-]+/).some((p) => p.startsWith(q));

const EXTRAS = [
    { label: 'Mi perfil', path: '/perfil', claves: ['perfil', 'cuenta', 'tema', 'notificaciones'] },
    { label: 'Inicio', path: '/', claves: ['inicio'] },
];

function hayAlgoModalAbierto(propio) {
    return [...document.querySelectorAll('.MuiModal-root, .MuiPopover-root')].some(
        (el) => !el.classList.contains('MuiModal-hidden') && el !== propio && !propio?.contains(el),
    );
}

export default function BuscadorGlobal() {
    const theme = useTheme();
    const navigate = useNavigate();
    const { hasPermiso } = useAuth();
    const desdeMd = useMediaQuery(theme.breakpoints.up('md'));
    const [abierto, setAbierto] = useState(false);
    const [q, setQ] = useState('');
    const [marcado, setMarcado] = useState(0);
    const [remoto, setRemoto] = useState({ deudores: [], conversaciones: [], cargando: false, error: false });
    const [intento, setIntento] = useState(0);
    const campo = useRef(null);
    const dialogo = useRef(null);
    const verDeudores = hasPermiso('deudores.ver');
    const verConversaciones = hasPermiso('wapi.inbox');

    const abrir = useCallback(() => setAbierto(true), []);
    const cerrar = () => {
        setAbierto(false);
        setQ('');
        setRemoto({ deudores: [], conversaciones: [], cargando: false, error: false });
    };

    useEffect(() => {
        const alTeclear = (e) => {
            if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return;
            if (abierto) {
                e.preventDefault();
                campo.current?.focus();
                return;
            }
            if (hayAlgoModalAbierto(dialogo.current)) return;
            e.preventDefault();
            abrir();
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [abierto, abrir]);

    const pantallas = useMemo(() => {
        const items = filtrarItemsPorPermisos(navConfig, hasPermiso);
        const delMenu = pantallasDelMenu(items).map(({ item, grupo }) => ({
            label: item.label,
            detalle: grupo ? grupo.label : '',
            path: item.path,
            claves: [],
        }));
        return [...delMenu, ...EXTRAS.filter((x) => !delMenu.some((d) => d.path === x.path)).map((x) => ({ ...x, detalle: '' }))];
    }, [hasPermiso]);

    const termino = sinTildes(q.trim());
    const pantallasFiltradas = termino
        ? pantallas.filter((p) => empiezaPalabra(`${p.label} ${p.detalle}`, termino) || p.claves.some((c) => c.startsWith(termino))).slice(0, 6)
        : [];

    // Deudores y conversaciones: desde 2 letras, 300 ms después de dejar de escribir, cancelando el pedido anterior.
    useEffect(() => {
        if (!abierto || q.trim().length < 2 || (!verDeudores && !verConversaciones)) {
            setRemoto((r) => ({ ...r, deudores: [], conversaciones: [], cargando: false, error: false }));
            return undefined;
        }
        const ctrl = new AbortController();
        setRemoto((r) => ({ ...r, cargando: true, error: false }));
        const t = setTimeout(async () => {
            const texto = q.trim();
            const [d, c] = await Promise.allSettled([
                verDeudores ? api.get('/deudores/buscar', { params: { q: texto, page: 0, size: 5 }, signal: ctrl.signal }) : Promise.resolve({ data: { data: [] } }),
                verConversaciones ? api.get('/wapi/inbox/buscar', { params: { q: texto }, signal: ctrl.signal }) : Promise.resolve({ data: { items: [] } }),
            ]);
            if (ctrl.signal.aborted) return;
            setRemoto({
                deudores: d.status === 'fulfilled' ? (d.value.data?.data ?? []).slice(0, 5) : [],
                conversaciones: c.status === 'fulfilled' ? (c.value.data?.items ?? []).slice(0, 5) : [],
                cargando: false,
                error: (verDeudores && d.status === 'rejected') || (verConversaciones && c.status === 'rejected'),
            });
        }, 300);
        return () => {
            clearTimeout(t);
            ctrl.abort();
        };
    }, [q, abierto, verDeudores, verConversaciones, intento]);

    const resultados = [
        ...pantallasFiltradas.map((p) => ({ tipo: 'pantalla', id: `p-${p.path}`, titulo: p.label, detalle: p.detalle || 'Pantalla', ir: p.path })),
        ...remoto.deudores.map((d) => ({ tipo: 'deudor', id: `d-${d.id}`, titulo: d.nombre || 'Sin nombre', detalle: [d.documento ? `Doc. ${d.documento}` : null, d.empresa ? `Empresa ${d.empresa}` : null].filter(Boolean).join(' · '), ir: `/deudores/${d.id}` })),
        ...remoto.conversaciones.map((c) => ({ tipo: 'conversacion', id: `c-${c.id}`, titulo: c.nombre || c.numero, detalle: [c.nombre ? c.numero : null, `#${c.id}`, c.config?.nombre].filter(Boolean).join(' · '), ir: `/wapi/inbox?c=${c.id}` })),
    ];

    useEffect(() => setMarcado(0), [q]);
    useEffect(() => {
        if (marcado >= resultados.length) setMarcado(0);
    }, [resultados.length, marcado]);

    const elegir = (r) => {
        if (!r) return;
        cerrar();
        navigate(r.ir);
    };

    const alTeclear = (e) => {
        if (e.key === 'ArrowDown' && resultados.length) {
            e.preventDefault();
            setMarcado((m) => (m + 1) % resultados.length);
        } else if (e.key === 'ArrowUp' && resultados.length) {
            e.preventDefault();
            setMarcado((m) => (m - 1 + resultados.length) % resultados.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            elegir(resultados[marcado]);
        }
    };

    const placeholder = verDeudores ? 'Buscar deudor, conversación o pantalla' : verConversaciones ? 'Buscar conversación o pantalla' : 'Buscar una pantalla';
    const grupos = [
        { tipo: 'pantalla', titulo: 'Pantallas' },
        { tipo: 'deudor', titulo: 'Deudores' },
        { tipo: 'conversacion', titulo: 'Conversaciones' },
    ];
    const IconoTipo = { pantalla: ArrowRight, deudor: User, conversacion: MessagesSquare };

    return (
        <>
            {desdeMd ? (
                <ButtonBase
                    onClick={abrir}
                    aria-label={`${placeholder} (Ctrl K)`}
                    sx={(t) => ({
                        width: '100%',
                        maxWidth: 560,
                        height: 40,
                        borderRadius: '12px',
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        color: 'text.secondary',
                        justifyContent: 'flex-start',
                        gap: 1.25,
                        px: 1.5,
                        fontSize: '0.84375rem',
                        '&:hover': { borderColor: 'primary.main' },
                        '&.Mui-focusVisible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
                    })}
                >
                    <Search size={18} strokeWidth={1.75} aria-hidden />
                    <Box component="span" sx={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{placeholder}</Box>
                    <Box component="kbd" sx={{ fontFamily: 'inherit', fontSize: 11, fontWeight: 600, px: 0.875, py: 0.5, borderRadius: '6px', border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>Ctrl K</Box>
                </ButtonBase>
            ) : (
                <Tooltip title="Buscar">
                    <IconButton aria-label={placeholder} onClick={abrir} sx={{ color: 'text.secondary', width: 44, height: 44 }}>
                        <Search size={20} strokeWidth={1.75} aria-hidden />
                    </IconButton>
                </Tooltip>
            )}

            <Dialog
                ref={dialogo}
                open={abierto}
                onClose={cerrar}
                fullWidth
                maxWidth="sm"
                fullScreen={!desdeMd && window.innerWidth < 600}
                TransitionProps={{ onEntered: () => campo.current?.focus() }}
                slotProps={{ paper: { sx: { alignSelf: { sm: 'flex-start' }, mt: { sm: 10 }, borderRadius: { sm: '16px' } } } }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', pt: { xs: 'calc(8px + env(safe-area-inset-top))', sm: 1 } }}>
                    <Search size={20} strokeWidth={1.75} aria-hidden style={{ flex: 'none', opacity: 0.7 }} />
                    <InputBase
                        inputRef={campo}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={alTeclear}
                        placeholder={placeholder}
                        fullWidth
                        inputProps={{
                            role: 'combobox',
                            'aria-expanded': resultados.length > 0,
                            'aria-controls': 'buscador-resultados',
                            'aria-activedescendant': resultados[marcado] ? `buscador-${resultados[marcado].id}` : undefined,
                            'aria-label': placeholder,
                            autoComplete: 'off',
                            enterKeyHint: 'search',
                        }}
                        sx={{ fontSize: 16, minHeight: 44 }}
                    />
                    {remoto.cargando && <CircularProgress size={18} />}
                    <IconButton aria-label="Cerrar el buscador" onClick={cerrar} sx={{ width: 44, height: 44 }}>
                        <X size={20} strokeWidth={1.75} aria-hidden />
                    </IconButton>
                </Box>

                <Box id="buscador-resultados" role="listbox" aria-label="Resultados" sx={{ maxHeight: { sm: 440 }, overflowY: 'auto', py: 1 }}>
                    {!q.trim() && (
                        <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, py: 2 }}>
                            {verDeudores ? 'Escribí un nombre, un documento, un teléfono o el nombre de una pantalla.' : 'Escribí el nombre de una pantalla.'}
                        </Typography>
                    )}
                    {remoto.error && (
                        <Alert severity="error" variant="outlined" sx={{ mx: 2, my: 1 }} action={<Button color="inherit" size="small" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>}>
                            No se pudo buscar en el servidor.
                        </Alert>
                    )}
                    {q.trim() && !remoto.cargando && resultados.length === 0 && !remoto.error && (
                        <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, py: 2 }}>
                            No encontramos nada con «{q.trim()}».
                        </Typography>
                    )}
                    {grupos.map(({ tipo, titulo }) => {
                        const deEste = resultados.filter((r) => r.tipo === tipo);
                        if (deEste.length === 0) return null;
                        const Icono = IconoTipo[tipo];
                        return (
                            <Box key={tipo} role="group" aria-label={titulo}>
                                <Typography component="div" aria-hidden sx={{ px: 2.5, pt: 1, pb: 0.5, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
                                    {titulo}
                                </Typography>
                                {deEste.map((r) => {
                                    const i = resultados.indexOf(r);
                                    const on = i === marcado;
                                    return (
                                        <Box
                                            key={r.id}
                                            id={`buscador-${r.id}`}
                                            role="option"
                                            aria-selected={on}
                                            onMouseEnter={() => setMarcado(i)}
                                            onClick={() => elegir(r)}
                                            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mx: 1, px: 1.5, minHeight: 48, borderRadius: '10px', cursor: 'pointer', bgcolor: on ? 'action.selected' : 'transparent' }}
                                        >
                                            <Icono size={18} strokeWidth={1.75} aria-hidden style={{ flex: 'none', opacity: 0.7 }} />
                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                <Typography variant="body2" fontWeight={600} noWrap>{r.titulo}</Typography>
                                                {r.detalle && <Typography variant="caption" color="text.secondary" noWrap component="div">{r.detalle}</Typography>}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                        );
                    })}
                </Box>
            </Dialog>
        </>
    );
}
