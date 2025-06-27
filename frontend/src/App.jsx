import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import Navbar from './components/NavBar';
import ConectarSesion from './components/ConectarSesion';
import EstadoSesiones from './components/EstadoSesiones';
import SubirCampaña from './components/SubirCampaña';
import EnviarMensajes from './components/EnviarMensajes';
import VerReportes from './components/VerReportes';
import VerCampañas from './components/VerCampañas';
import VerTemplates from './components/VerTemplates';
import VerMetricas from './components/VerMetricas';

export default function App() {
    const [mode, setMode] = useState('light');

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
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Navbar mode={mode} toggleTheme={toggleTheme}>
                <Routes>
                    <Route path="/" element={<EstadoSesiones />} />
                    <Route path="/conectar" element={<ConectarSesion />} />
                    <Route path="/subir-campania" element={<SubirCampaña />} />
                    <Route path="/campanias" element={<VerCampañas />} />
                    <Route path="/enviar" element={<EnviarMensajes />} />
                    <Route path="/reportes" element={<VerReportes />} />
                    <Route path="/templates" element={<VerTemplates />} />
                    <Route path="/metricas" element={<VerMetricas />} />
                </Routes>
            </Navbar>
        </ThemeProvider>
    );
}