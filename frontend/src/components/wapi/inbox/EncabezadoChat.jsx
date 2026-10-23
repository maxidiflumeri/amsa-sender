import { useState } from 'react';
import { Box, Button, CircularProgress, IconButton, ListItemIcon, Menu, MenuItem, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { ArrowLeft, CircleCheck, Clock, Copy, Hash, Lock, MailOpen, Megaphone, MoreVertical, NotebookPen, PanelRight, Smartphone, Sparkles, User, UserPlus } from 'lucide-react';
import { AvatarUsuario, StatusChip } from '../../ui';
import { ETIQUETA_ESTADO, TONO_ESTADO, ventanaInfo } from './utils';

// El encabezado del chat. En el celular son dos filas: arriba atrás, avatar, nombre con el teléfono siempre a la vista,
// IA y "Más"; abajo los chips (de quién es, ventana de 24 h) y el botón principal. En la computadora las acciones
// van con texto al costado.

function BotonIA({ onClick, deshabilitado, cargando, movil }) {
    const comun = {
        color: 'ia.main', borderColor: 'ia.main',
        '&:hover': (theme) => ({ borderColor: theme.palette.ia.main, bgcolor: alpha(theme.palette.ia.main, 0.08) }),
    };
    if (movil) {
        return (
            <IconButton aria-label="Resumir con IA" onClick={onClick} disabled={deshabilitado} sx={{ width: 44, height: 44, border: 1, ...comun }}>
                {cargando ? <CircularProgress size={18} color="inherit" /> : <Sparkles size={20} strokeWidth={1.75} aria-hidden />}
            </IconButton>
        );
    }
    return (
        <Button variant="outlined" onClick={onClick} disabled={deshabilitado} startIcon={cargando ? <CircularProgress size={16} color="inherit" /> : <Sparkles size={18} strokeWidth={1.75} aria-hidden />} sx={{ ...comun, whiteSpace: 'nowrap' }}>
            Resumir
        </Button>
    );
}

/**
 * @param {object} props
 * @param {object} props.conv
 * @param {string|null} props.campañaNombre
 * @param {number} props.cantidadLineas Si hay más de una, se muestra la línea de la conversación.
 * @param {string|null} props.ocupado Qué acción está corriendo ('tomar', 'resolver', 'asignar'): se deshabilitan todas.
 */
export default function EncabezadoChat({
    conv, campañaNombre, cantidadLineas, esAdmin, esLg, ocupado, cierresAbiertos, onToggleCierres, resumiendo,
    onVolver, onTomar, onResolver, onAsignar, onResumir, onMarcarNoLeida, onCopiarNumero, onCopiarId, onVerFicha,
}) {
    const theme = useTheme();
    const movil = useMediaQuery(theme.breakpoints.down('md'));
    const [anchor, setAnchor] = useState(null);
    const ventana = ventanaInfo(conv);
    const nombre = conv.nombre ?? conv.numero;
    const cierres = conv.cierres?.length ?? 0;
    const ocupadoAlgo = !!ocupado;

    const principal = conv.estado === 'sin_asignar' ? (
        <Button variant="contained" onClick={onTomar} disabled={ocupadoAlgo} startIcon={ocupado === 'tomar' ? <CircularProgress size={16} color="inherit" /> : <User size={18} strokeWidth={1.75} aria-hidden />} sx={{ whiteSpace: 'nowrap', flex: 'none' }}>
            Tomar
        </Button>
    ) : conv.estado === 'asignada' ? (
        <Button variant="contained" onClick={onResolver} disabled={ocupadoAlgo} startIcon={ocupado === 'resolver' ? <CircularProgress size={16} color="inherit" /> : <CircleCheck size={18} strokeWidth={1.75} aria-hidden />} sx={{ whiteSpace: 'nowrap', flex: 'none' }}>
            Resolver
        </Button>
    ) : null;

    const cierraPanel = (cierres > 0) && (
        <Button
            size="small"
            color="inherit"
            onClick={onToggleCierres}
            aria-expanded={cierresAbiertos}
            startIcon={<NotebookPen size={16} strokeWidth={1.75} aria-hidden />}
            sx={(t) => ({ minHeight: { xs: 44, md: 32 }, flex: 'none', color: cierresAbiertos ? 'warning.dark' : 'text.secondary', bgcolor: cierresAbiertos ? alpha(t.palette.warning.main, 0.14) : 'transparent', textTransform: 'none', fontSize: 13 })}
        >
            {cierres} {cierres === 1 ? 'nota de cierre' : 'notas de cierre'}
        </Button>
    );

    const chips = (
        <>
            <StatusChip label={ETIQUETA_ESTADO[conv.estado] ?? conv.estado} tono={TONO_ESTADO[conv.estado] ?? 'neutro'} />
            {conv.asignadoA && (
                <StatusChip label={String(conv.asignadoA.nombre)} tono="info" icon={<User size={13} strokeWidth={2} aria-hidden />} sx={{ maxWidth: 160, '& .MuiChip-icon': { color: 'inherit', ml: 0.75 } }} />
            )}
            {conv.estado !== 'sin_asignar' && (
                ventana.abierta ? (
                    <StatusChip
                        label={ventana.restante ? `Ventana de 24 h · quedan ${ventana.restante}` : 'Ventana de 24 h abierta'}
                        tono={ventana.poco ? 'aviso' : 'ok'}
                        icon={<Clock size={13} strokeWidth={2} aria-hidden />}
                        sx={{ '& .MuiChip-icon': { color: 'inherit', ml: 0.75 } }}
                    />
                ) : (
                    <StatusChip label="Ventana de 24 h cerrada" tono="error" icon={<Lock size={13} strokeWidth={2} aria-hidden />} sx={{ '& .MuiChip-icon': { color: 'inherit', ml: 0.75 } }} />
                )
            )}
            {campañaNombre && (
                <StatusChip label={campañaNombre} tono="ia" icon={<Megaphone size={13} strokeWidth={2} aria-hidden />} title="Campaña de origen" sx={{ maxWidth: 200, display: { xs: 'none', sm: 'inline-flex' }, '& .MuiChip-icon': { color: 'inherit', ml: 0.75 } }} />
            )}
            {conv.config && cantidadLineas > 1 && (
                <StatusChip label={conv.config.nombre ?? `Línea ${conv.config.id}`} tono="neutro" icon={<Smartphone size={13} strokeWidth={2} aria-hidden />} sx={{ display: { xs: 'none', sm: 'inline-flex' }, '& .MuiChip-icon': { color: 'inherit', ml: 0.75 } }} />
            )}
        </>
    );

    const cerrarMenu = () => setAnchor(null);
    const item = (onClick, Icono, texto, extra) => (
        <MenuItem
            onClick={() => {
                cerrarMenu();
                onClick();
            }}
            sx={{ minHeight: 44 }}
            {...extra}
        >
            <ListItemIcon><Icono size={18} strokeWidth={1.75} aria-hidden /></ListItemIcon>
            {texto}
        </MenuItem>
    );

    return (
        <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', px: { xs: 0.5, md: 2 }, py: { xs: 0.5, md: 1.25 }, display: 'flex', flexDirection: 'column', gap: { xs: 0, md: 0.75 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1.5 }, minWidth: 0 }}>
                {movil && (
                    <IconButton aria-label="Volver a la lista" onClick={onVolver} sx={{ width: 44, height: 44, flex: 'none' }}>
                        <ArrowLeft size={22} strokeWidth={1.75} aria-hidden />
                    </IconButton>
                )}
                <AvatarUsuario nombre={nombre} size={movil ? 36 : 40} sx={{ flex: 'none', bgcolor: conv.estado === 'resuelta' ? 'text.disabled' : conv.estado === 'sin_asignar' ? 'warning.main' : 'primary.main' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap component="h2" sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{nombre}</Typography>
                    {/* El teléfono va siempre a la vista: con el nombre del deudor solo no se sabe a qué número se le escribe. */}
                    <Typography noWrap sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>
                        {conv.nombre ? conv.numero : `#${conv.id}`}
                    </Typography>
                </Box>

                {!movil && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 'none' }}>
                        {esAdmin && (
                            <Button variant="outlined" color="inherit" onClick={onAsignar} disabled={ocupadoAlgo} startIcon={<UserPlus size={18} strokeWidth={1.75} aria-hidden />} sx={{ borderColor: 'divider', whiteSpace: 'nowrap' }}>
                                Asignar
                            </Button>
                        )}
                        <BotonIA onClick={onResumir} deshabilitado={resumiendo} cargando={resumiendo} movil={false} />
                        {principal}
                    </Box>
                )}
                {movil && <BotonIA onClick={onResumir} deshabilitado={resumiendo} cargando={resumiendo} movil />}

                <IconButton aria-label="Más acciones" aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)} sx={{ width: 44, height: 44, flex: 'none' }}>
                    <MoreVertical size={20} strokeWidth={1.75} aria-hidden />
                </IconButton>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', px: { xs: 1, md: 0 }, pb: { xs: 0.75, md: 0 }, minWidth: 0 }}>
                {chips}
                {cierraPanel}
                {movil && principal && <Box sx={{ ml: 'auto' }}>{principal}</Box>}
            </Box>

            <Menu anchorEl={anchor} open={!!anchor} onClose={cerrarMenu} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                {movil && esAdmin && item(onAsignar, UserPlus, 'Asignar a un asesor', { disabled: ocupadoAlgo })}
                {item(onMarcarNoLeida, MailOpen, 'Marcar como no leída')}
                {item(onCopiarNumero, Copy, 'Copiar número')}
                {item(onCopiarId, Hash, `Copiar #${conv.id}`)}
                {!esLg && item(onVerFicha, PanelRight, 'Ver ficha')}
            </Menu>
        </Box>
    );
}
