import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Collapse, LinearProgress, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import api from '../../../api/axios';

// El análisis llega del backend con una línea de título por sección que empieza con un emoji. Se usa solo para cortar
// las secciones y darles un tono del tema (el emoji queda como parte del texto que escribió la IA).
const TONO_SECCION = {
    '📊': 'info.main',
    '💡': 'warning.main',
    '⚠️': 'error.main',
    '🎯': 'success.main',
    '👥': 'ia.main',
    '🏆': 'warning.main',
    '🔴': 'error.main',
    '📈': 'info.main',
};

function renderAnalisis(texto) {
    if (!texto) return null;
    const secciones = texto.split(/\n(?=(?:📊|💡|⚠️|🎯|👥|🏆|🔴|📈))/u);
    return secciones.map((seccion, i) => {
        const lineas = seccion.split('\n').filter((l) => l.trim());
        const titulo = lineas[0];
        const cuerpo = lineas.slice(1);
        const emoji = Object.keys(TONO_SECCION).find((e) => titulo?.startsWith(e));
        return (
            <Box key={i} sx={{ mb: 2.5, '&:last-child': { mb: 0 } }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: TONO_SECCION[emoji] ?? 'text.primary', mb: 0.75 }}>
                    {titulo}
                </Typography>
                {cuerpo.map((linea, j) => (
                    <Typography
                        key={j}
                        variant="body2"
                        sx={{ lineHeight: 1.75, pl: linea.startsWith('•') || /^\d+\./.test(linea) ? 1 : 0, overflowWrap: 'anywhere' }}
                    >
                        {linea}
                    </Typography>
                ))}
            </Box>
        );
    });
}

/**
 * El análisis con IA de una campaña o del equipo. Va en violeta (`ia.main`) con borde, como amaIA en Gestión: nada
 * de degradados ni brillos. `endpoint` es el POST que genera el texto.
 */
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
            // 429: el proveedor de IA está saturado; se dice distinto porque reintentar en unos segundos sí sirve.
            if (err?.response?.status === 429) {
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
        if (cargado) {
            setAbierto((o) => !o);
            return;
        }
        setAbierto(true);
        await ejecutar();
    };

    const reanalizar = async () => {
        setCargado(false);
        await ejecutar();
    };

    return (
        <Box sx={{ my: 2 }}>
            <Button
                variant="outlined"
                disabled={disabled || loading}
                onClick={analizar}
                aria-busy={loading}
                aria-expanded={abierto}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Sparkles size={18} strokeWidth={1.75} aria-hidden />}
                endIcon={!loading && cargado ? (abierto ? <ChevronUp size={18} strokeWidth={1.75} aria-hidden /> : <ChevronDown size={18} strokeWidth={1.75} aria-hidden />) : undefined}
                sx={{
                    color: 'ia.main',
                    borderColor: 'ia.main',
                    fontWeight: 600,
                    minHeight: { xs: 44, sm: 36 },
                    width: { xs: '100%', sm: 'auto' },
                    '&:hover': { borderColor: 'ia.main', bgcolor: (t) => alpha(t.palette.ia.main, 0.08) },
                }}
            >
                {loading ? 'Analizando…' : label}
            </Button>

            <Collapse in={abierto} timeout={200} unmountOnExit>
                <Paper
                    variant="outlined"
                    sx={{ mt: 2, p: { xs: 2, sm: 2.5 }, borderRadius: '14px', borderColor: (t) => alpha(t.palette.ia.main, 0.4) }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'ia.main' }}>
                            <Sparkles size={18} strokeWidth={1.75} aria-hidden />
                            <Typography variant="subtitle2" fontWeight={700} sx={{ color: 'inherit' }}>
                                Análisis IA
                            </Typography>
                        </Box>
                        {cargado && !loading && (
                            <Button size="small" onClick={reanalizar} sx={{ fontSize: 12, color: 'text.secondary', minHeight: { xs: 44, sm: 32 } }}>
                                Regenerar
                            </Button>
                        )}
                    </Box>

                    {loading ? (
                        <Box role="status" aria-live="polite" sx={{ py: 2 }}>
                            <LinearProgress sx={{ borderRadius: 1, '& .MuiLinearProgress-bar': { bgcolor: 'ia.main' }, bgcolor: (t) => alpha(t.palette.ia.main, 0.15) }} />
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Analizando los datos…
                            </Typography>
                        </Box>
                    ) : errorMsg ? (
                        <Alert severity="warning" variant="outlined" action={<Button size="small" color="inherit" onClick={reanalizar}>Reintentar</Button>}>
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
