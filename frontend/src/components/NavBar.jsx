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

const drawerWidth = 200;

const navItems = [
    { label: 'Sesiones', path: '/', icon: <DashboardIcon /> },
    { label: 'Conectar', path: '/conectar', icon: <LinkIcon /> },
    { label: 'Campañas', path: '/campanias', icon: <CampaignIcon /> },
    { label: 'Reportes', path: '/reportes', icon: <BarChartIcon /> },
    { label: 'Templates', path: '/templates', icon: <ArticleIcon /> }
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
    const [collapsed, setCollapsed] = useState(false);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const location = useLocation();

    const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
    const toggleCollapse = () => setCollapsed(prev => !prev);

    useEffect(() => {
        if (isMobile) setCollapsed(false);
    }, [isMobile]);

    const drawerContent = (
        <Box height="100%" display="flex" flexDirection="column">
            <Box sx={{ flexGrow: 1 }}>
                <List sx={{ paddingTop: 1 }}>
                    {navItems.map(({ label, path, icon }) => (
                        <ListItem key={path} disablePadding>
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
                    <Tooltip title={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
                        <IconButton onClick={toggleTheme}>
                            {mode === 'dark' ? <FaSun /> : <FaMoon />}
                        </IconButton>
                    </Tooltip>
                )}
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />

            {/* AppBar */}
            <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, backgroundColor: '#075E54' }}>
                <Toolbar sx={{ justifyContent: 'space-between' }}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <WhatsAppIcon />
                        <Typography variant="h6" fontWeight="bold" color="#fff">
                            WhatsApp Manager
                        </Typography>
                    </Box>
                    {isMobile && (
                        <IconButton color="inherit" onClick={handleDrawerToggle}>
                            <FiMenu size={24} />
                        </IconButton>
                    )}
                </Toolbar>
            </AppBar>

            {/* Sidebar */}
            <Box
                position="relative"
                sx={{
                    width: { md: collapsed ? 72 : drawerWidth },
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
                        '& .MuiDrawer-paper': {
                            width: collapsed ? 72 : drawerWidth,
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

                {/* Botón flotante para colapsar/expandir */}
                {!isMobile && (
                    <Box
                        marginTop={50}
                        position="absolute"
                        top="50%"
                        right={-16}
                        sx={{
                            transform: 'translateY(-50%)',
                            backgroundColor: theme.palette.background.paper,
                            borderRadius: '50%',
                            boxShadow: 2,
                            zIndex: theme.zIndex.drawer + 2,
                        }}
                    >
                        <Tooltip title={collapsed ? 'Expandir menú' : 'Colapsar menú'}>
                            <IconButton onClick={toggleCollapse} size="small">
                                {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Box>

            {/* Contenido principal */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    padding: 1,
                    marginTop: '64px',
                    width: {
                        xs: '100%',
                        md: `calc(100% - ${collapsed ? 72 : drawerWidth}px)`
                    },
                    marginLeft: {
                        md: collapsed ? '72px' : `${drawerWidth}px`
                    },
                    transition: 'all 0.3s ease',
                    maxWidth: '100vw',
                    overflowX: 'hidden',
                    position: 'absolute'
                }}
            >
                {children}
            </Box>
        </Box>
    );
}