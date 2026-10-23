import { AppBar as MuiAppBar, Box, IconButton, Toolbar, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Menu, PanelLeft } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import BuscadorGlobal from './BuscadorGlobal';
import ConexionIndicador from './ConexionIndicador';
import LogoSender from './LogoSender';
import PendientesBell from './PendientesBell';
import UserMenu from './UserMenu';

/**
 * La barra de arriba, igual a la de AMSA Gestión: comparte el fondo con el menú lateral (`background.marco`), el botón
 * para achicar el menú (en el celular, para abrirlo), el logo y el nombre, el buscador al centro y, a la derecha, la
 * conexión, los pendientes y la cuenta. Respeta la zona segura de arriba cuando la app está instalada.
 */
export default function AppBar({ onMenuClick, isDesktop, collapsed }) {
    const theme = useTheme();
    const etiqueta = isDesktop ? (collapsed ? 'Expandir menú' : 'Colapsar menú') : 'Abrir menú';

    return (
        <MuiAppBar
            position="fixed"
            color="inherit"
            elevation={0}
            sx={{ zIndex: theme.zIndex.drawer + 2, width: '100%', bgcolor: 'background.marco', pt: 'env(safe-area-inset-top)', pl: 'env(safe-area-inset-left)', pr: 'env(safe-area-inset-right)' }}
        >
            <Toolbar sx={{ gap: { xs: 0.25, sm: 1 }, pl: { xs: 0.5, sm: 1.5 }, pr: { xs: 1, sm: 2 }, minHeight: { xs: 56, sm: 64 } }}>
                <Tooltip title={etiqueta}>
                    <IconButton aria-label={etiqueta} onClick={onMenuClick} sx={{ color: 'text.secondary', flex: 'none', width: { xs: 44, md: 40 }, height: { xs: 44, md: 40 } }}>
                        {isDesktop ? <PanelLeft size={20} strokeWidth={1.75} aria-hidden /> : <Menu size={22} strokeWidth={1.75} aria-hidden />}
                    </IconButton>
                </Tooltip>

                <Box
                    component={RouterLink}
                    to="/"
                    aria-label="AMSA Sender, ir a Inicio"
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        flex: 'none',
                        textDecoration: 'none',
                        color: 'inherit',
                        mr: { xs: 0.5, md: 2 },
                        p: { xs: 0.75, md: 0 },
                        borderRadius: '8px',
                        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                    }}
                >
                    <LogoSender size={32} />
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'baseline', gap: 0.75, fontSize: '1rem', letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>
                        <Box component="span" sx={{ fontWeight: 700 }}>AMSA</Box>
                        <Box component="span" sx={{ fontWeight: 500, color: 'text.secondary' }}>Sender</Box>
                    </Box>
                </Box>

                <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' }, px: { md: 2 } }}>
                    <BuscadorGlobal />
                </Box>

                <ConexionIndicador />
                <PendientesBell />
                <UserMenu />
            </Toolbar>
        </MuiAppBar>
    );
}
