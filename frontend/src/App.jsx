import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import ConectarSesion from './components/ConectarSesion';
import EstadoSesiones from './components/EstadoSesiones';
import SubirCampaña from './components/SubirCampaña';
import EnviarMensajes from './components/EnviarMensajes';
import VerReportes from './components/VerReportes';
import VerCampañas from './components/VerCampañas';
import VerTemplates from './components/VerTemplates';
import VerMetricas from './components/VerMetricas';
import CuentasSMTP from './components/email/CuentasSMTP';
import Login from './components/Login';
import LayoutPrivado from './components/LayoutPrivado';
import CrearTemplate from './components/email/CrearTemplate';
import VerTemplatesEmail from './components/email/VerTemplatesEmail';
import PreviewTemplate from './components/email/PreviewTemplate';
import VerCampañasEmail from './components/email/VerCampañasEmail';
import VistaPublicaEmail from './components/email/VistaPublicaEmail';
import VerReportesEmail from './components/email/VerReportesEmail';
import DesuscripcionConfirmar from './components/email/DesuscripcionConfirmar';
import DesuscripcionResultado from './components/email/DesuscripcionResultado';
import VerDesuscripcionesEmail from './components/email/VerDesuscripcionesEmail';
import TareasProgramadas from './components/TareasProgramadas';
import EnvioManual from './components/email/EnvioManual';
import GestionUsuarios from './components/admin/GestionUsuarios';
import GestionRoles from './components/admin/GestionRoles';
import PaginaInicio from './components/PaginaInicio';
import RutaProtegida from './components/RutaProtegida';

export default function App() {
    const [mode, setMode] = useState('light');
    const location = useLocation();
    const isLoggedIn = !!localStorage.getItem('token');

    const publicRoutes = ['/login', '/mailing/vista'];
    const isPublicRoute = publicRoutes.some((r) => location.pathname.startsWith(r));

    if (!isLoggedIn && !isPublicRoute) {
        return <Navigate to="/login" />;
    }

    useEffect(() => {
        const savedMode = localStorage.getItem('themeMode');
        if (savedMode) setMode(savedMode);
    }, []);

    const toggleTheme = () => {
        const newMode = mode === 'light' ? 'dark' : 'light';
        setMode(newMode);
        localStorage.setItem('themeMode', newMode);
    };

    const theme = useMemo(() =>
        createTheme({
            palette: {
                mode,
                ...(mode === 'light'
                    ? {
                        background: {
                            default: '#f9f9f9',
                            paper: '#fff',
                        },
                        primary: { main: '#075E54' },
                        secondary: { main: '#128C7E' },
                        text: { primary: '#000' },
                        error: { main: '#f44336' }, // rojo estándar
                    }
                    : {
                        background: {
                            default: '#121212',
                            paper: '#1e1e1e',
                        },
                        primary: { main: '#25D366' },
                        secondary: { main: '#34B7F1' },
                        text: { primary: '#fff' },
                        error: { main: '#ff6b6b' }, // rojo más suave para dark mode
                    }),
            },
            components: {
                MuiAppBar: {
                    styleOverrides: {
                        root: {
                            backgroundColor: mode === 'light' ? '#075E54' : '#1e1e1e',
                        },
                    },
                },
                MuiPaper: {
                    styleOverrides: {
                        root: {
                            backgroundImage: 'none',
                        },
                    },
                },
                MuiButton: {
                    styleOverrides: {
                        root: {
                            borderRadius: 8,
                            textTransform: 'none',
                            ...(mode === 'dark' && {
                                color: '#fff',
                            }),
                        },
                    },
                },
                MuiAlert: {
                    styleOverrides: {
                        root: {
                            borderRadius: 8,
                            ...(mode === 'dark' && {
                                color: '#fff',
                            }),
                        },
                    },
                },
                MuiSnackbarContent: {
                    styleOverrides: {
                        root: {
                            ...(mode === 'dark' && {
                                color: '#fff',
                                backgroundColor: '#333',
                            }),
                        },
                    },
                },
                MuiTableCell: {
                    styleOverrides: {
                        root: {
                            borderBottom: '1px solid',
                            borderColor: mode === 'light' ? '#e0e0e0' : '#333',
                            ...(mode === 'dark' && {
                                color: '#fff',
                            }),
                        },
                        head: {
                            fontWeight: 'bold',
                            backgroundColor: mode === 'light' ? '#e8f0fe' : '#2c2c2c',
                        },
                    },
                },
                MuiTextField: {
                    defaultProps: {
                        variant: 'outlined',
                    },
                },
                MuiInputLabel: {
                    styleOverrides: {
                        root: {
                            ...(mode === 'dark' && {
                                color: '#ccc',
                            }),
                        },
                    },
                },
                MuiOutlinedInput: {
                    styleOverrides: {
                        root: {
                            ...(mode === 'dark' && {
                                color: '#fff',
                                backgroundColor: '#1e1e1e',
                                borderRadius: 8,
                                '& fieldset': {
                                    borderColor: '#666',
                                },
                                '&:hover fieldset': {
                                    borderColor: '#aaa',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: '#25D366',
                                },
                            }),
                        },
                        input: {
                            ...(mode === 'dark' && {
                                color: '#fff',
                            }),
                        },
                    },
                },
                MuiSelect: {
                    styleOverrides: {
                        icon: {
                            ...(mode === 'dark' && {
                                color: '#fff',
                            }),
                        },
                    },
                },
                MuiChip: {
                    styleOverrides: {
                        label: {
                            ...(mode === 'dark' && {
                                color: '#fff',
                            }),
                        },
                    },
                },
                MuiCssBaseline: {
                    styleOverrides: {
                        body: {
                            scrollbarWidth: 'thin',
                            scrollbarColor: mode === 'dark' ? '#555 #1e1e1e' : '#c1c1c1 #f5f5f5',
                        },
                        '*::-webkit-scrollbar': {
                            width: '8px',
                            height: '8px',
                        },
                        '*::-webkit-scrollbar-track': {
                            backgroundColor: mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
                        },
                        '*::-webkit-scrollbar-thumb': {
                            backgroundColor: mode === 'dark' ? '#555' : '#aaa',
                            borderRadius: '8px',
                        },
                        '*::-webkit-scrollbar-thumb:hover': {
                            backgroundColor: mode === 'dark' ? '#888' : '#888',
                        },
                    },
                }
            },
        }), [mode]);

    return (
        <AuthProvider>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Routes>
                {/* Ruta pública */}
                <Route path="/login" element={<Login />} />
                <Route path="/mailing/vista/:id" element={<VistaPublicaEmail />} />
                <Route path='/mailing/desuscribirse' element={<DesuscripcionConfirmar />} />
                <Route path='/mailing/desuscribirse/resultado' element={<DesuscripcionResultado />} />

                {/* Rutas privadas con layout */}
                <Route element={<LayoutPrivado mode={mode} toggleTheme={toggleTheme} />}>
                    <Route path="/" element={<PaginaInicio />} />
                    <Route path="/sesiones" element={<RutaProtegida permiso="whatsapp.sesiones"><EstadoSesiones /></RutaProtegida>} />
                    <Route path="/conectar" element={<RutaProtegida permiso="whatsapp.conectar"><ConectarSesion /></RutaProtegida>} />
                    <Route path="/subir-campania" element={<RutaProtegida permiso="whatsapp.campanias"><SubirCampaña /></RutaProtegida>} />
                    <Route path="/campanias" element={<RutaProtegida permiso="whatsapp.campanias"><VerCampañas /></RutaProtegida>} />
                    <Route path="/enviar" element={<RutaProtegida permiso="whatsapp.campanias"><EnviarMensajes /></RutaProtegida>} />
                    <Route path="/reportes" element={<RutaProtegida permiso="whatsapp.reportes"><VerReportes /></RutaProtegida>} />
                    <Route path="/templates" element={<RutaProtegida permiso="whatsapp.templates"><VerTemplates /></RutaProtegida>} />
                    <Route path="/metricas" element={<RutaProtegida permiso="whatsapp.metricas"><VerMetricas /></RutaProtegida>} />
                    <Route path="/config/tareas-programadas" element={<RutaProtegida permiso="config.tareas_programadas"><TareasProgramadas /></RutaProtegida>} />
                    <Route path="/email/cuentas" element={<RutaProtegida permiso="email.cuentas_smtp"><CuentasSMTP /></RutaProtegida>} />
                    <Route path="/email/crearTemplate" element={<RutaProtegida permiso="email.templates"><CrearTemplate /></RutaProtegida>} />
                    <Route path="/email/templates" element={<RutaProtegida permiso="email.templates"><VerTemplatesEmail /></RutaProtegida>} />
                    <Route path="/preview-template/:id" element={<RutaProtegida permiso="email.templates"><PreviewTemplate /></RutaProtegida>} />
                    <Route path="/email/campanias" element={<RutaProtegida permiso="email.campanias"><VerCampañasEmail /></RutaProtegida>} />
                    <Route path="/email/reportes" element={<RutaProtegida permiso="email.reportes"><VerReportesEmail /></RutaProtegida>} />
                    <Route path="/email/desuscripciones" element={<RutaProtegida permiso="email.desuscripciones"><VerDesuscripcionesEmail /></RutaProtegida>} />
                    <Route path="/email/envio-manual" element={<RutaProtegida permiso="email.envio_manual"><EnvioManual /></RutaProtegida>} />
                    <Route path="/admin/usuarios" element={<RutaProtegida permiso="admin.usuarios"><GestionUsuarios /></RutaProtegida>} />
                    <Route path="/admin/roles" element={<RutaProtegida permiso="admin.usuarios"><GestionRoles /></RutaProtegida>} />
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </ThemeProvider>
        </AuthProvider>
    );
}