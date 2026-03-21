import { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Grid, Button, MenuItem,
    CircularProgress, Alert, Card, CardContent,
    Stack, Chip, TextField,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../../../api/axios';

const TIPOS_REPORTE = [
    {
        key: 'campania-csv',
        label: 'Contactos de campaña (CSV)',
        descripcion: 'Lista completa de contactos con estados, timestamps y flags de respuesta.',
        formato: 'CSV',
        necesitaCampania: true,
        color: 'info',
    },
    {
        key: 'campania-excel',
        label: 'Reporte completo de campaña (Excel)',
        descripcion: 'Libro Excel con 3 hojas: Resumen KPIs, Contactos y Errores.',
        formato: 'Excel',
        necesitaCampania: true,
        color: 'success',
    },
    {
        key: 'bajas-csv',
        label: 'Lista de bajas (CSV)',
        descripcion: 'Todos los números que se dieron de baja con campaña, template y fecha.',
        formato: 'CSV',
        necesitaCampania: false,
        color: 'warning',
    },
    {
        key: 'agentes-excel',
        label: 'Performance de agentes (Excel)',
        descripcion: 'KPIs de todos los asesores para el período seleccionado.',
        formato: 'Excel',
        necesitaCampania: false,
        tieneRango: true,
        color: 'primary',
    },
];

export default function WapiReportes() {
    const [campanias, setCampanias] = useState([]);
    const [campaniaId, setCampaniaId] = useState('');
    const [tipoKey, setTipoKey] = useState('');
    const [desde, setDesde] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().slice(0, 10);
    });
    const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        api.get('/wapi/campanias').then(r => setCampanias(r.data || [])).catch(() => {});
    }, []);

    const tipoSeleccionado = TIPOS_REPORTE.find(t => t.key === tipoKey);

    const descargar = async () => {
        if (!tipoKey) { setError('Seleccioná un tipo de reporte'); return; }
        if (tipoSeleccionado?.necesitaCampania && !campaniaId) { setError('Seleccioná una campaña'); return; }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            let url = '';
            let filename = '';

            if (tipoKey === 'campania-csv') {
                url = `/wapi/reportes/campania/${campaniaId}/csv`;
                filename = `campania-${campaniaId}.csv`;
            } else if (tipoKey === 'campania-excel') {
                url = `/wapi/reportes/campania/${campaniaId}/excel`;
                filename = `campania-${campaniaId}.xlsx`;
            } else if (tipoKey === 'bajas-csv') {
                url = '/wapi/reportes/bajas/csv';
                filename = 'bajas.csv';
            } else if (tipoKey === 'agentes-excel') {
                url = `/wapi/reportes/agentes/excel?desde=${desde}&hasta=${hasta}`;
                filename = `agentes-${desde}_${hasta}.xlsx`;
            }

            const res = await api.get(url, { responseType: 'blob' });
            const href = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = href;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(href);
            setSuccess(`Reporte "${tipoSeleccionado?.label}" generado y descargado.`);
        } catch (e) {
            setError('Error al generar el reporte. Intentá de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Typography variant="h6" mb={3}>Generador de Reportes</Typography>

            {/* Cards de tipos de reporte */}
            <Grid container spacing={2} mb={4}>
                {TIPOS_REPORTE.map(t => (
                    <Grid item xs={12} sm={6} md={3} key={t.key}>
                        <Card
                            variant="outlined"
                            sx={{
                                height: '100%',
                                cursor: 'pointer',
                                border: tipoKey === t.key ? '2px solid' : '1px solid',
                                borderColor: tipoKey === t.key ? `${t.color}.main` : 'divider',
                                transition: 'all 0.15s',
                                '&:hover': { boxShadow: 2 },
                            }}
                            onClick={() => setTipoKey(t.key)}
                        >
                            <CardContent sx={{ pb: 1 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                    <Typography variant="subtitle2" fontWeight="bold">{t.label}</Typography>
                                    <Chip label={t.formato} color={t.color} size="small" />
                                </Stack>
                                <Typography variant="body2" color="text.secondary">{t.descripcion}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Formulario de generación */}
            <Paper variant="outlined" sx={{ p: 3 }}>
                <Typography variant="subtitle2" fontWeight="bold" mb={2}>Configurar y descargar</Typography>

                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={4}>
                        <TextField
                            select
                            fullWidth
                            label="Tipo de reporte"
                            value={tipoKey}
                            onChange={e => setTipoKey(e.target.value)}
                        >
                            <MenuItem value=""><em>Seleccionar...</em></MenuItem>
                            {TIPOS_REPORTE.map(t => (
                                <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <TextField
                            select
                            fullWidth
                            label="Campaña"
                            value={tipoSeleccionado?.necesitaCampania ? campaniaId : ''}
                            onChange={e => setCampaniaId(e.target.value)}
                            disabled={!tipoSeleccionado?.necesitaCampania}
                        >
                            <MenuItem value=""><em>Seleccionar...</em></MenuItem>
                            {campanias.map(c => (
                                <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>

                    {tipoSeleccionado?.tieneRango && (
                        <>
                            <Grid item xs={6} sm={3} md={2}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label="Desde"
                                    value={desde}
                                    onChange={e => setDesde(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid item xs={6} sm={3} md={2}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label="Hasta"
                                    value={hasta}
                                    onChange={e => setHasta(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                        </>
                    )}

                    <Grid item xs={12} sm="auto">
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
                            onClick={descargar}
                            disabled={loading || !tipoKey}
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            {loading ? 'Generando...' : 'Generar y descargar'}
                        </Button>
                    </Grid>
                </Grid>

                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
            </Paper>
        </Box>
    );
}
