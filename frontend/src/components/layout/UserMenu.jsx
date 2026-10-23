import { useState } from 'react';
import { Box, ButtonBase, Divider, MenuItem, Popover, Typography } from '@mui/material';
import { LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AvatarUsuario from '../ui/AvatarUsuario';
import SelectorTema from '../ui/SelectorTema';

/**
 * El menú de la cuenta, igual que en AMSA Gestión: foto, nombre, email y rol; Mi perfil; Apariencia (Claro, Oscuro,
 * Sistema) y Cerrar sesión. Es un Popover con `role="dialog"` y no un Menu: adentro de un `role="menu"` el selector
 * de tema no se alcanza con el teclado.
 */
export default function UserMenu() {
    const { usuario, user, nombre, cerrarSesion } = useAuth();
    const navigate = useNavigate();
    const [ancla, setAncla] = useState(null);
    const abierto = !!ancla;
    const rol = usuario?.rolObj?.nombre ?? usuario?.rol ?? user?.rol ?? '';

    return (
        <>
            <ButtonBase
                onClick={(e) => setAncla(e.currentTarget)}
                aria-label={`Tu cuenta: ${nombre}`}
                aria-haspopup="dialog"
                aria-expanded={abierto}
                sx={(t) => ({
                    borderRadius: '50%',
                    p: '3px',
                    ml: 0.5,
                    flex: 'none',
                    boxShadow: abierto ? `0 0 0 2px ${t.palette.primary.main}` : 'none',
                    '&.Mui-focusVisible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
                })}
            >
                <AvatarUsuario nombre={nombre} foto={usuario?.foto} size={34} />
            </ButtonBase>
            <Popover
                open={abierto}
                anchorEl={ancla}
                onClose={() => setAncla(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{ paper: { role: 'dialog', 'aria-label': 'Tu cuenta', sx: { width: 'min(304px, calc(100vw - 24px))', borderRadius: '14px', p: 1, mt: 0.5 } } }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.25, pt: 1.25, pb: 1.5 }}>
                    <AvatarUsuario nombre={nombre} foto={usuario?.foto} size={44} />
                    <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={600} noWrap>{nombre}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>{usuario?.email ?? user?.email}</Typography>
                        {rol && <Typography variant="caption" color="text.secondary" fontWeight={600}>{String(rol).toUpperCase()}</Typography>}
                    </Box>
                </Box>
                <Divider sx={{ mx: 0.5, mb: 0.5 }} />
                <MenuItem
                    onClick={() => {
                        setAncla(null);
                        navigate('/perfil');
                    }}
                    sx={{ borderRadius: '8px', gap: 1.25, minHeight: 44 }}
                >
                    <UserRound size={18} strokeWidth={1.75} aria-hidden />
                    Mi perfil
                </MenuItem>
                <Box sx={{ px: 1.25, pt: 1, pb: 0.5 }}>
                    <Typography component="div" sx={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', mb: 0.75 }}>
                        Apariencia
                    </Typography>
                    <SelectorTema />
                </Box>
                <Divider sx={{ mx: 0.5, my: 0.75 }} />
                <MenuItem onClick={cerrarSesion} sx={{ borderRadius: '8px', gap: 1.25, minHeight: 44, color: 'error.main' }}>
                    <LogOut size={18} strokeWidth={1.75} aria-hidden />
                    Cerrar sesión
                </MenuItem>
            </Popover>
        </>
    );
}
