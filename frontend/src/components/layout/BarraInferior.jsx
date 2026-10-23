import { useMemo } from 'react';
import { Box, ButtonBase, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { House, MessagesSquare, Send, Users } from 'lucide-react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

const RUTAS_CAMPANIAS = ['/wapi/campanias', '/wapi/live', '/email/campanias', '/campanias'];

/** Las pestañas de abajo que la persona puede usar, en orden. */
export function pestaniasDe(hasPermiso) {
    const campanias = hasPermiso('wapi.campanias') ? '/wapi/campanias' : hasPermiso('email.campanias') ? '/email/campanias' : hasPermiso('whatsapp.campanias') ? '/campanias' : null;
    return [
        { id: 'inicio', label: 'Inicio', to: '/', Icono: House, activa: (p) => p === '/' },
        hasPermiso('wapi.inbox') && { id: 'conversaciones', label: 'Conversaciones', to: '/wapi/inbox', Icono: MessagesSquare, activa: (p) => p.startsWith('/wapi/inbox') },
        campanias && { id: 'campanias', label: 'Campañas', to: campanias, Icono: Send, activa: (p) => RUTAS_CAMPANIAS.some((r) => p === r || p.startsWith(`${r}/`)) },
        hasPermiso('deudores.ver') && { id: 'deudores', label: 'Deudores', to: '/deudores', Icono: Users, activa: (p) => p === '/deudores' || (p.startsWith('/deudores/') && !p.startsWith('/deudores/reportes')) },
    ].filter(Boolean);
}

function Contador() {
    const { unreadCount, unassignedCount } = useNotifications();
    const total = unreadCount + unassignedCount;
    if (total === 0) return null;
    return (
        <Box
            component="span"
            sx={(t) => ({ position: 'absolute', top: -3, right: 6, minWidth: 18, height: 18, px: 0.625, boxSizing: 'border-box', borderRadius: 99, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 2px ${t.palette.background.paper}`, fontVariantNumeric: 'tabular-nums' })}
        >
            {total > 99 ? '99+' : total}
        </Box>
    );
}

/** La barra de abajo del celular (debajo de `md`), para usar Sender con el pulgar. Respeta la zona segura. */
export default function BarraInferior() {
    const { hasPermiso } = useAuth();
    const { pathname } = useLocation();
    const pestanias = useMemo(() => pestaniasDe(hasPermiso), [hasPermiso]);
    const { unreadCount, unassignedCount } = useNotifications();
    const pendientes = unreadCount + unassignedCount;

    return (
        <Paper
            component="nav"
            aria-label="Accesos"
            square
            elevation={0}
            sx={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: (t) => t.zIndex.appBar,
                display: { xs: 'flex', md: 'none' },
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                px: 0.5,
                pt: 0.5,
                pb: 'calc(6px + env(safe-area-inset-bottom))',
                pl: 'calc(4px + env(safe-area-inset-left))',
                pr: 'calc(4px + env(safe-area-inset-right))',
            }}
        >
            {pestanias.map(({ id, label, to, Icono, activa }) => {
                const on = activa(pathname);
                return (
                    <ButtonBase
                        key={id}
                        component={RouterLink}
                        to={to}
                        aria-current={on ? 'page' : undefined}
                        aria-label={id === 'conversaciones' && pendientes > 0 ? `${label}, ${pendientes} pendientes` : undefined}
                        sx={(t) => ({
                            flex: 1,
                            minWidth: 0,
                            minHeight: 56,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px',
                            borderRadius: 2,
                            color: on ? (t.palette.mode === 'dark' ? 'primary.light' : 'primary.main') : 'text.secondary',
                            fontSize: 11.5,
                            fontWeight: 600,
                            '&.Mui-focusVisible': { outline: `2px solid ${t.palette.primary.main}` },
                        })}
                    >
                        <Box
                            sx={(t) => ({
                                position: 'relative',
                                width: 56,
                                height: 30,
                                borderRadius: 99,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: on ? alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.1) : 'transparent',
                            })}
                        >
                            <Icono size={22} strokeWidth={1.75} aria-hidden />
                            {id === 'conversaciones' && <Contador />}
                        </Box>
                        <Box component="span" sx={{ maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>
                    </ButtonBase>
                );
            })}
        </Paper>
    );
}
