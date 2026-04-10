import { useState } from 'react';
import {
    Box, Button, Typography, Collapse, Paper, CircularProgress, Divider, Alert,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import api from '../../../api/axios';

const SECTION_ICONS = {
    '📊': { color: '#1976d2' },
    '💡': { color: '#f59e0b' },
    '⚠️': { color: '#ef4444' },
    '🎯': { color: '#10b981' },
    '👥': { color: '#8b5cf6' },
    '🏆': { color: '#f59e0b' },
    '🔴': { color: '#ef4444' },
    '📈': { color: '#1976d2' },
};

function renderAnalisis(texto) {
    if (!texto) return null;
    const secciones = texto.split(/\n(?=[📊💡⚠️🎯👥🏆🔴📈])/u);
    return secciones.map((seccion, i) => {
        const primeraLinea = seccion.split('\n')[0];
        const emoji = [...Object.keys(SECTION_ICONS)].find(e => primeraLinea.startsWith(e));
        const color = SECTION_ICONS[emoji]?.color ?? 'text.primary';
        const lineas = seccion.split('\n').filter(l => l.trim());
        const titulo = lineas[0];
        const cuerpo = lineas.slice(1);
        return (
            <Box key={i} sx={{ mb: 2.5 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color, mb: 0.75, fontSize: 13 }}>
                    {titulo}
                </Typography>
                {cuerpo.map((linea, j) => (
                    <Typography key={j} variant="body2" sx={{ lineHeight: 1.75, pl: linea.startsWith('•') || /^\d+\./.test(linea) ? 1 : 0, color: 'text.primary', fontSize: 13 }}>
                        {linea}
                    </Typography>
                ))}
            </Box>
        );
    });
}

export default function PanelAnalisisIA({ endpoint, label = 'Analizar con IA', disabled = false }) {
    const [abierto, setAbierto] = useState(false);
    const [analisis, setAnalisis] = useState('');
    const [loading, setLoading] = useState(false);
    const [cargado, setCargado] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const ejecutar = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const { data } = await api.post(endpoint);
            setAnalisis(data.analisis);
            setCargado(true);
        } catch (err) {
            const status = err?.response?.status;
            if (status === 429) {
                setErrorMsg('El servicio de IA está temporalmente saturado. Esperá unos segundos e intentá de nuevo.');
            } else {
                setErrorMsg('No se pudo generar el análisis. Verificá la conexión e intentá de nuevo.');
            }
            setCargado(false);
        } finally {
            setLoading(false);
        }
    };

    const analizar = async () => {
        if (cargado) { setAbierto(o => !o); return; }
        setAbierto(true);
        await ejecutar();
    };

    const reanalizar = async () => {
        setCargado(false);
        await ejecutar();
    };

    return (
        <Box sx={{ mt: 2, mb: 3 }}>
            <Button
                variant="contained"
                disabled={disabled || loading}
                onClick={analizar}
                startIcon={
                    loading ? (
                        <AutoAwesomeIcon sx={{
                            fontSize: 18,
                            '@keyframes aiSpin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
                            animation: 'aiSpin 1.4s linear infinite',
                        }} />
                    ) : (
                        <AutoAwesomeIcon sx={{ fontSize: 18 }} />
                    )
                }
                endIcon={!loading && (abierto ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
                sx={{
                    background: 'linear-gradient(135deg, #4f8ef7 0%, #a259f7 100%)',
                    color: 'white',
                    fontWeight: 600,
                    boxShadow: (t) => t.palette.mode === 'dark'
                        ? '0 0 10px 3px rgba(79,142,247,0.7)'
                        : '0 2px 8px rgba(79,142,247,0.4)',
                    '@keyframes aiGlow': {
                        '0%':   { boxShadow: '0 0 6px 1px rgba(79,142,247,0.5)' },
                        '50%':  { boxShadow: '0 0 18px 4px rgba(162,89,247,0.75)' },
                        '100%': { boxShadow: '0 0 6px 1px rgba(79,142,247,0.5)' },
                    },
                    animation: loading ? 'aiGlow 1.4s ease-in-out infinite' : 'none',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #3a7be0 0%, #8b3fe0 100%)',
                        boxShadow: (t) => t.palette.mode === 'dark'
                            ? '0 0 18px 5px rgba(162,89,247,0.85)'
                            : '0 2px 14px rgba(162,89,247,0.6)',
                    },
                    '&.Mui-disabled': { background: 'rgba(0,0,0,0.12)', color: 'rgba(0,0,0,0.26)' },
                }}
            >
                {loading ? 'Analizando...' : label}
            </Button>

            <Collapse in={abierto} timeout={300}>
                <Paper
                    variant="outlined"
                    sx={{
                        mt: 2, p: 2.5,
                        borderColor: 'rgba(79,142,247,0.3)',
                        background: (t) => t.palette.mode === 'dark'
                            ? 'rgba(79,142,247,0.05)'
                            : 'rgba(79,142,247,0.03)',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AutoAwesomeIcon sx={{
                                fontSize: 18,
                                background: 'linear-gradient(135deg, #4f8ef7, #a259f7)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }} />
                            <Typography variant="subtitle2" fontWeight={700} sx={{
                                background: 'linear-gradient(135deg, #4f8ef7 0%, #a259f7 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}>
                                Análisis IA
                            </Typography>
                        </Box>
                        {cargado && !loading && (
                            <Button size="small" onClick={reanalizar} sx={{ fontSize: 11, color: 'text.secondary' }}>
                                Regenerar
                            </Button>
                        )}
                    </Box>
                    <Divider sx={{ mb: 2, borderColor: 'rgba(79,142,247,0.2)' }} />

                    {loading ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 3 }}>
                            <AutoAwesomeIcon sx={{
                                fontSize: 36,
                                background: 'linear-gradient(135deg, #4f8ef7, #a259f7)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                '@keyframes aiSpin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
                                animation: 'aiSpin 1.4s linear infinite',
                            }} />
                            <Typography variant="body2" sx={{
                                '@keyframes shimmer': {
                                    '0%':   { backgroundPosition: '-200% center' },
                                    '100%': { backgroundPosition: '200% center' },
                                },
                                background: 'linear-gradient(90deg, #4f8ef7 25%, #a259f7 50%, #4f8ef7 75%)',
                                backgroundSize: '200% auto',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                animation: 'shimmer 1.8s linear infinite',
                                fontWeight: 600,
                            }}>
                                Analizando datos...
                            </Typography>
                        </Box>
                    ) : errorMsg ? (
                        <Alert
                            severity="warning"
                            action={
                                <Button size="small" onClick={reanalizar}>Reintentar</Button>
                            }
                        >
                            {errorMsg}
                        </Alert>
                    ) : (
                        renderAnalisis(analisis)
                    )}
                </Paper>
            </Collapse>
        </Box>
    );
}
