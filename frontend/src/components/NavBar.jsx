import React, { useState, useEffect } from 'react';
import {
    Box,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
    AppBar,
    Toolbar,
    Typography,
    useTheme,
    useMediaQuery,
    Divider,
    Switch,
    Tooltip,
    CssBaseline
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { FaSun, FaMoon } from 'react-icons/fa';
import { FiMenu, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LinkIcon from '@mui/icons-material/Link';
import CampaignIcon from '@mui/icons-material/Campaign';
import BarChartIcon from '@mui/icons-material/BarChart';
import ArticleIcon from '@mui/icons-material/Article';
import InsightsIcon from '@mui/icons-material/Insights';
import { Avatar, Menu, MenuItem } from '@mui/material';
import logo from '../assets/amsasender.png'; // Asegúrate de que la ruta sea correcta

const drawerWidth = 200;

const navItems = [
    { label: 'Sesiones', path: '/sesiones', icon: <DashboardIcon /> },
    { label: 'Conectar', path: '/conectar', icon: <LinkIcon /> },
    { label: 'Campañas', path: '/campanias', icon: <CampaignIcon /> },
    { label: 'Templates', path: '/templates', icon: <ArticleIcon /> },
    { label: 'Reportes', path: '/reportes', icon: <BarChartIcon /> },
    { label: 'Métricas', path: '/metricas', icon: <InsightsIcon /> }
];

// Switch estilo iOS con íconos dentro del track
const ThemedSwitch = styled(Switch)(({ theme }) => ({
    width: 62,
    height: 32,
    padding: 0,
    transition: 'all 0.4s ease',
    '& .MuiSwitch-switchBase': {
        padding: 4,
        transition: 'all 0.4s ease',
        '&.Mui-checked': {
            transform: 'translateX(30px)',
            color: '#fff',
            transition: 'all 0.4s ease',
            '& + .MuiSwitch-track': {
                backgroundColor: theme.palette.mode === 'dark' ? '#4caf50' : '#65C466',
                opacity: 1,
            },
        },
    },
    '& .MuiSwitch-thumb': {
        width: 24,
        height: 24,
        borderRadius: '50%',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease',
    },
    '& .MuiSwitch-track': {
        position: 'relative',
        borderRadius: 32,
        backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#aab4be',
        opacity: 1,
        transition: 'background-color 0.4s ease',
        '&:before, &:after': {
            content: '""',
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 14,
        },
        '&:before': {
            content: '"🌞"',
            left: 8,
        },
        '&:after': {
            content: '"🌙"',
            right: 8,
        },
    },
}));

export default function Layout({ children, mode, toggleTheme }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(true);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const location = useLocation();
    const [delayedDrawerWidth, setDelayedDrawerWidth] = useState(drawerWidth);
    const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
    const toggleCollapse = () => setCollapsed(prev => !prev);
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.href = '/login';
    };

    const user = JSON.parse(localStorage.getItem('usuario') || '{}');
    const avatarContent = user?.foto ? (
        <Avatar
            src={user.foto}
            alt={user?.nombre}
            sx={{
                width: 40,
                height: 40,
                bgcolor: 'transparent',
            }}
        />
    ) : (
        <Avatar
            alt={user?.nombre}
            sx={{
                bgcolor: '#4caf50',
                color: '#fff',
                fontWeight: 'bold',
                width: 40,
                height: 40,
                textTransform: 'uppercase',
            }}
        >
            {user?.nombre?.[0] || '?'}
        </Avatar>
    );

    useEffect(() => {
        if (isMobile) setCollapsed(false);
    }, [isMobile]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDelayedDrawerWidth(collapsed ? 72 : drawerWidth);
        }, 300); // el mismo delay de la transición del Drawer

        return () => clearTimeout(timeout);
    }, [collapsed]);

    const drawerContent = (
        <Box height="100%" display="flex" flexDirection="column">
            {/* Encabezado con botón de colapsar */}
            <Box
                display="flex"
                justifyContent={collapsed ? 'center' : 'flex-end'}
                alignItems="center"
                px={1}
                py={1}
                sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    position: 'relative',
                }}
            >
                <Tooltip title={collapsed ? 'Expandir menú' : 'Colapsar menú'}>
                    <IconButton
                        onClick={toggleCollapse}
                        sx={{
                            backgroundColor: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                            '&:hover': {
                                backgroundColor: theme.palette.action.hover,
                            },
                            transition: 'transform 0.3s ease',
                            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)'
                        }}
                    >
                        <FiChevronLeft />
                    </IconButton>
                </Tooltip>
            </Box>

            <Box sx={{ flexGrow: 1 }}>
                <List sx={{ paddingTop: 1 }}>
                    {navItems.map(({ label, path, icon }) => (
                        <ListItem key={path} disablePadding>
                            <Tooltip title={collapsed ? label : ''} placement="right">
                                <ListItemButton
                                    component={RouterLink}
                                    to={path}
                                    selected={location.pathname === path}
                                    onClick={isMobile ? handleDrawerToggle : undefined}
                                    sx={{
                                        '&.Mui-selected': {
                                            backgroundColor: theme.palette.action.selected,
                                            fontWeight: 'bold',
                                        }
                                    }}
                                >
                                    <ListItemIcon>{icon}</ListItemIcon>
                                    {!collapsed && <ListItemText primary={label} />}
                                </ListItemButton>
                            </Tooltip>
                        </ListItem>
                    ))}
                </List>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Box
                px={2}
                py={2}
                display="flex"
                alignItems="center"
                justifyContent="center"
            >
                {!collapsed ? (
                    <ThemedSwitch checked={mode === 'dark'} onChange={toggleTheme} />
                ) : (
                    <ThemedSwitch checked={mode === 'dark'} onChange={toggleTheme} sx={{ transform: 'scale(0.7)' }} />
                )}
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />

            {/* AppBar */}
            <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, backgroundColor: '#075E54' }}>
                <Toolbar
                    sx={{
                        px: 2,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        minWidth: 0,
                        overflow: 'hidden',
                        flexWrap: 'wrap',
                        gap: 1,
                    }}
                >
                    <Box display="flex" alignItems="center" gap={1}>
                        <img src={logo} alt="amsasender logo" style={{ height: '60px' }} />
                        <Typography variant="h6" fontWeight="bold" color="#fff">
                            AMSA Sender
                        </Typography>
                    </Box>
                    {isMobile && (
                        <IconButton color="inherit" onClick={handleDrawerToggle}>
                            <FiMenu size={24} />
                        </IconButton>
                    )}
                    <Box display="flex" alignItems="center" gap={2}>
                        <Tooltip title={user?.nombre || ''}>
                            <IconButton onClick={handleMenuOpen} color="inherit">
                                {avatarContent}
                            </IconButton>
                        </Tooltip>
                        <Menu
                            anchorEl={anchorEl}
                            open={open}
                            onClose={handleMenuClose}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        >
                            <MenuItem onClick={handleLogout}>Cerrar sesión</MenuItem>
                        </Menu>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* Sidebar */}
            <Box
                position="relative"
                sx={{
                    width: { md: collapsed ? 60 : drawerWidth },
                    flexShrink: 0,
                    height: 'calc(100% - 64px)',
                }}
            >
                <Drawer
                    variant={isMobile ? 'temporary' : 'permanent'}
                    open={isMobile ? mobileOpen : true}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        transition: 'width 0.3s ease',
                        '& .MuiDrawer-paper': {
                            width: collapsed ? 60 : drawerWidth,
                            top: 64,
                            height: 'calc(100% - 64px)',
                            boxSizing: 'border-box',
                            backgroundColor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f4f4f4',
                            color: theme.palette.text.primary,
                            transition: 'width 0.3s ease',
                            overflowX: 'hidden',
                        },
                    }}
                >
                    {drawerContent}
                </Drawer>
            </Box>

            {/* Contenido principal */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    mt: '64px',
                    px: { xs: 2, sm: 3 },
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                }}
            >
                <Box sx={{ flex: 1, px: { xs: 2, md: 3, lg: 4 }, width: '100%', transition: 'width 0.3s ease' }}>
                    {children}
                </Box>
            </Box>
        </Box>
    );
}