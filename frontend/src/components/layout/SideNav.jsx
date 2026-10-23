import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Collapse,
    Divider,
    Drawer,
    List,
    ListItemButton,
    ListSubheader,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import { keyframes } from '@emotion/react';
import { ChevronDown, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import IconoNav from './IconoNav';
import LogoSender from './LogoSender';
import { filtrarItemsPorPermisos, navConfig, rutaActiva, SECCIONES, TITULOS_SECCION } from './navConfig';

// El menú lateral, igual al de AMSA Gestión (components/layout/AppShell/SideNav.tsx): bloques con título, la
// pantalla abierta como píldora, el grupo de la pantalla abierta desplegado, achicado con el menú al costado y, en el
// cajón del celular, renglones de 44 px.

export const DRAWER_WIDTH_EXPANDED = 256;
export const DRAWER_WIDTH_COLLAPSED = 72;

const latido = keyframes`
    0% { box-shadow: 0 0 0 0 var(--latido); }
    70% { box-shadow: 0 0 0 6px transparent; }
    100% { box-shadow: 0 0 0 0 transparent; }
`;

function PuntoVivo({ colapsado, texto }) {
    return (
        <>
            <Box
                aria-hidden
                sx={(theme) => ({
                    '--latido': alpha(theme.palette.primary.main, 0.35),
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    flex: 'none',
                    bgcolor: 'primary.main',
                    animation: `${latido} 2s infinite`,
                    ...(colapsado && { position: 'absolute', top: 9, right: 9 }),
                })}
            />
            <Box component="span" sx={visuallyHidden}>{texto}</Box>
        </>
    );
}

/** El contador de Conversaciones: pendientes de responder o de tomar. Solo él se redibuja con cada mensaje. */
function ContadorConversaciones({ colapsado }) {
    const { unreadCount, unassignedCount } = useNotifications();
    const total = unreadCount + unassignedCount;
    if (total === 0) return null;
    if (colapsado) {
        return (
            <>
                <Box aria-hidden sx={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', boxShadow: (t) => `0 0 0 2px ${t.palette.background.marco}` }} />
                <Box component="span" sx={visuallyHidden}>{`${total} pendientes`}</Box>
            </>
        );
    }
    return (
        <Box
            component="span"
            aria-label={`${total} pendientes`}
            sx={{ minWidth: 22, height: 20, px: 0.75, boxSizing: 'border-box', borderRadius: 99, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums', flex: 'none' }}
        >
            {total > 99 ? '99+' : total}
        </Box>
    );
}

function estiloItem(theme, o) {
    const oscuro = theme.palette.mode === 'dark';
    const fondoPildora = alpha(theme.palette.primary.main, oscuro ? 0.16 : 0.1);
    const textoPildora = oscuro ? theme.palette.primary.light : theme.palette.primary.main;
    return {
        m: 0,
        width: o.colapsado ? 44 : '100%',
        height: o.colapsado || o.tactil ? 44 : o.hijo ? 34 : 40,
        minHeight: 0,
        mx: o.colapsado ? 'auto' : 0,
        px: o.colapsado ? 0 : 1.25,
        gap: 1.5,
        justifyContent: o.colapsado ? 'center' : 'flex-start',
        borderRadius: o.colapsado ? '12px' : o.hijo ? '8px' : '10px',
        fontSize: o.tactil ? (o.hijo ? '0.90625rem' : '0.9375rem') : o.hijo ? '0.84375rem' : '0.875rem',
        fontWeight: o.pildora ? 600 : 500,
        letterSpacing: '-0.005em',
        color: o.pildora ? textoPildora : o.resaltado ? 'text.primary' : 'text.secondary',
        bgcolor: o.pildora ? fondoPildora : 'transparent',
        transition: theme.transitions.create(['background-color', 'color'], { duration: theme.transitions.duration.shortest }),
        '& svg': { color: o.pildora ? 'primary.main' : 'inherit' },
        '&:hover': { bgcolor: o.pildora ? fondoPildora : 'action.hover', color: o.pildora ? textoPildora : 'text.primary' },
        '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2, bgcolor: o.pildora ? fondoPildora : 'action.hover' },
    };
}

const textoItem = { flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' };

function ItemNav({ item, activa, colapsado, tactil, abierto, onAlternar, onIr, campaniasEnCurso }) {
    const theme = useTheme();
    const hijos = item.children ?? [];
    const esGrupo = hijos.length > 0;
    const activo = !esGrupo && item.path === activa;
    const conHijoActivo = esGrupo && hijos.some((c) => c.path === activa);

    const boton = (
        <ListItemButton
            onClick={(e) => (esGrupo ? onAlternar(item, e.currentTarget) : item.path && onIr(item.path))}
            aria-current={activo ? 'page' : undefined}
            aria-expanded={esGrupo ? abierto : undefined}
            aria-haspopup={esGrupo && colapsado ? 'menu' : undefined}
            sx={estiloItem(theme, { pildora: activo || (colapsado && conHijoActivo), resaltado: conHijoActivo, colapsado, tactil })}
        >
            <IconoNav nombre={item.icon} size={tactil ? 22 : 20} />
            <Box component="span" sx={colapsado ? visuallyHidden : textoItem}>{item.label}</Box>
            {item.indicador === 'conversaciones' && <ContadorConversaciones colapsado={colapsado} />}
            {item.indicador === 'campanias' && campaniasEnCurso && <PuntoVivo colapsado={colapsado} texto="Hay una campaña enviando" />}
            {esGrupo && !colapsado && (
                <ChevronDown
                    size={16}
                    aria-hidden
                    style={{ flex: 'none', opacity: 0.7, transform: abierto ? 'rotate(180deg)' : 'none', transition: theme.transitions.create('transform', { duration: theme.transitions.duration.shorter }) }}
                />
            )}
        </ListItemButton>
    );

    return (
        <Box component="li" sx={{ listStyle: 'none', position: 'relative' }}>
            {colapsado ? (
                <Tooltip title={esGrupo && abierto ? '' : item.label} placement="right" describeChild={!!item.indicador}>
                    {boton}
                </Tooltip>
            ) : boton}
            {esGrupo && !colapsado && (
                <Collapse in={abierto} timeout="auto" unmountOnExit>
                    <Box component="ul" sx={{ m: 0, mt: 0.25, mb: 0.75, ml: 2.5, pl: 1.25, borderLeft: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        {hijos.map((hijo) => {
                            const hijoActivo = hijo.path === activa;
                            return (
                                <Box component="li" key={hijo.path ?? hijo.label} sx={{ listStyle: 'none' }}>
                                    <ListItemButton
                                        onClick={() => hijo.path && onIr(hijo.path)}
                                        aria-current={hijoActivo ? 'page' : undefined}
                                        sx={estiloItem(theme, { pildora: hijoActivo, resaltado: false, colapsado: false, hijo: true, tactil })}
                                    >
                                        <Box component="span" sx={textoItem}>{hijo.label}</Box>
                                    </ListItemButton>
                                </Box>
                            );
                        })}
                    </Box>
                </Collapse>
            )}
        </Box>
    );
}

const tituloSeccion = {
    px: 1.25,
    pt: 0.5,
    pb: 0.75,
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'text.secondary',
};

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {'permanent'|'temporary'} props.variant
 * @param {boolean} [props.collapsed]
 * @param {boolean} [props.campaniasEnCurso] Hay una campaña de WhatsApp API enviando.
 */
export default function SideNav({ open, onClose, variant, collapsed = false, campaniasEnCurso = false }) {
    const theme = useTheme();
    const { hasPermiso } = useAuth();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const isCollapsed = variant === 'permanent' && collapsed;
    const tactil = variant === 'temporary';
    const width = isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED;

    const items = useMemo(() => filtrarItemsPorPermisos(navConfig, hasPermiso), [hasPermiso]);
    const activa = rutaActiva(pathname, items);
    const grupoDeLaActiva = items.find((i) => i.children?.some((c) => c.path === activa))?.label ?? null;

    const [abiertos, setAbiertos] = useState(() => (grupoDeLaActiva ? [grupoDeLaActiva] : []));
    useEffect(() => {
        if (grupoDeLaActiva) setAbiertos((prev) => (prev.includes(grupoDeLaActiva) ? prev : [...prev, grupoDeLaActiva]));
    }, [grupoDeLaActiva]);

    const [desplegado, setDesplegado] = useState(null);
    useEffect(() => {
        if (!isCollapsed) setDesplegado(null);
    }, [isCollapsed]);

    const ir = (path) => {
        setDesplegado(null);
        navigate(path);
        if (variant === 'temporary') onClose();
    };
    const alternar = (grupo, ancla) => {
        if (isCollapsed) {
            setDesplegado((d) => (d?.grupo.label === grupo.label ? null : { grupo, ancla }));
            return;
        }
        setAbiertos((prev) => (prev.includes(grupo.label) ? prev.filter((g) => g !== grupo.label) : [...prev, grupo.label]));
    };

    const secciones = SECCIONES.map((s) => ({ seccion: s, items: items.filter((i) => (i.seccion ?? 'operacion') === s) })).filter((s) => s.items.length > 0);

    const contenido = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {tactil ? (
                <Box sx={{ height: 64, flex: 'none', display: 'flex', alignItems: 'center', gap: 1.25, pl: 2, pr: 1, mt: 'env(safe-area-inset-top)' }}>
                    <LogoSender size={32} />
                    <Box component="span" sx={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: '1rem', letterSpacing: '-0.015em' }}>
                        <Box component="span" sx={{ fontWeight: 700 }}>AMSA</Box>
                        <Box component="span" sx={{ fontWeight: 500, color: 'text.secondary' }}>Sender</Box>
                    </Box>
                    <Box
                        component="button"
                        type="button"
                        aria-label="Cerrar menú"
                        onClick={onClose}
                        sx={{ appearance: 'none', border: 0, bgcolor: 'transparent', color: 'text.secondary', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    >
                        <X size={22} strokeWidth={1.75} aria-hidden />
                    </Box>
                </Box>
            ) : (
                <Box sx={{ height: { xs: 56, sm: 64 }, flex: 'none' }} />
            )}

            <Box
                component="nav"
                aria-label="Menú principal"
                sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', px: isCollapsed ? 1.75 : 1.5, pt: 0.5, pb: 'calc(16px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 1.75 }}
            >
                {secciones.map(({ seccion, items: deLaSeccion }, i) => (
                    <Box key={seccion}>
                        {isCollapsed ? (
                            i > 0 && <Divider sx={{ mx: 1, mb: 1.5 }} />
                        ) : (
                            <Typography component="div" id={`menu-seccion-${seccion}-${variant}`} sx={tituloSeccion}>
                                {TITULOS_SECCION[seccion]}
                            </Typography>
                        )}
                        <List
                            disablePadding
                            aria-labelledby={isCollapsed ? undefined : `menu-seccion-${seccion}-${variant}`}
                            aria-label={isCollapsed ? TITULOS_SECCION[seccion] : undefined}
                            sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}
                        >
                            {deLaSeccion.map((item) => (
                                <ItemNav
                                    key={item.path ?? item.label}
                                    item={item}
                                    activa={activa}
                                    colapsado={isCollapsed}
                                    tactil={tactil}
                                    abierto={isCollapsed ? desplegado?.grupo.label === item.label : abiertos.includes(item.label)}
                                    onAlternar={alternar}
                                    onIr={ir}
                                    campaniasEnCurso={campaniasEnCurso}
                                />
                            ))}
                        </List>
                    </Box>
                ))}
            </Box>

            <Menu
                anchorEl={desplegado?.ancla ?? null}
                open={!!desplegado}
                onClose={() => setDesplegado(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{ paper: { sx: { ml: 1, minWidth: 220, borderRadius: '14px' } }, list: { 'aria-label': desplegado?.grupo.label, dense: true } }}
            >
                <ListSubheader aria-hidden sx={{ ...tituloSeccion, lineHeight: 2.5, bgcolor: 'transparent' }}>{desplegado?.grupo.label}</ListSubheader>
                {(desplegado?.grupo.children ?? []).map((hijo) => (
                    <MenuItem
                        key={hijo.path ?? hijo.label}
                        selected={hijo.path === activa}
                        aria-current={hijo.path === activa ? 'page' : undefined}
                        onClick={() => hijo.path && ir(hijo.path)}
                        sx={{ mx: 0.75, borderRadius: '8px', fontSize: '0.84375rem' }}
                    >
                        {hijo.label}
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );

    const papel = { boxSizing: 'border-box', bgcolor: 'background.marco', border: 'none', overflowX: 'hidden' };
    const transicion = theme.transitions.create('width', { easing: theme.transitions.easing.sharp, duration: theme.transitions.duration.enteringScreen });

    if (variant === 'permanent') {
        return (
            <Drawer variant="permanent" open sx={{ width, flexShrink: 0, transition: transicion, '& .MuiDrawer-paper': { ...papel, width, transition: transicion, pl: 'env(safe-area-inset-left)' } }}>
                {contenido}
            </Drawer>
        );
    }

    return (
        <Drawer
            variant="temporary"
            open={open}
            onClose={onClose}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { ...papel, width: `min(304px, calc(100vw - 56px))`, pl: 'env(safe-area-inset-left)' } }}
        >
            {contenido}
        </Drawer>
    );
}
