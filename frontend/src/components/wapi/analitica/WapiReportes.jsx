import { useCallback, useEffect, useState } from 'react';
import { Autocomplete, Box, Button, ButtonBase, CircularProgress, Paper, TextField, Typography } from '@mui/material';
import { Check, Download } from 'lucide-react';
import api from '../../../api/axios';
import { BloqueEstado, SectionCard, StatusChip } from '../../ui';
import { mensajeDeError, useFeedback } from '../../../context/FeedbackContext';
import { descargarBlob } from '../../../utils/descargar';
import { aDiaLocal, diaLocalHaceDias } from '../../analitica/formato';

const TIPOS_REPORTE = [
    {
        key: 'campania-csv',
        label: 'Contactos de campaña',
        descripcion: 'Lista completa de contactos con estados, horarios y si respondieron.',
        formato: 'CSV',
        necesitaCampania: true,
        tono: 'info',
    },
    {
        key: 'campania-excel',
        label: 'Reporte completo de campaña',
        descripcion: 'Libro Excel con 3 hojas: resumen de indicadores, contactos y errores.',
        formato: 'Excel',
        necesitaCampania: true,
        tono: 'ok',
    },
    {
        key: 'bajas-csv',
        label: 'Lista de bajas',
        descripcion: 'Todos los números que se dieron de baja, con campaña, plantilla y fecha.',
        formato: 'CSV',
        necesitaCampania: false,
        tono: 'aviso',
    },
    {
        key: 'agentes-excel',
        label: 'Rendimiento de agentes',
        descripcion: 'Indicadores de todos los asesores para el período elegido.',
        formato: 'Excel',
        necesitaCampania: false,
        tieneRango: true,
        tono: 'acento',
    },
];

export default function WapiReportes() {
    const feedback = useFeedback();
    const [campanias, setCampanias] = useState([]);
    const [estadoLista, setEstadoLista] = useState('cargando');
    const [campania, setCampania] = useState(null);
    const [tipoKey, setTipoKey] = useState('');
    const [desde, setDesde] = useState(() => diaLocalHaceDias(30));
    const [hasta, setHasta] = useState(() => aDiaLocal());
    const [generando, setGenerando] = useState(false);

    const cargarCampanias = useCallback(() => {
        setEstadoLista('cargando');
        api.get('/wapi/campanias')
            .then((r) => {
                setCampanias(r.data || []);
                setEstadoLista('ok');
            })
            .catch(() => setEstadoLista('error'));
    }, []);

    useEffect(() => {
        cargarCampanias();
    }, [cargarCampanias]);

    const tipo = TIPOS_REPORTE.find((t) => t.key === tipoKey);
    const rangoInvalido = !!tipo?.tieneRango && (!desde || !hasta || desde > hasta);
    const faltaCampania = !!tipo?.necesitaCampania && !campania;
    const puedeDescargar = !!tipo && !faltaCampania && !rangoInvalido && !generando;

    const descargar = async () => {
        if (!puedeDescargar) return;
        setGenerando(true);
        try {
            let url = '';
            let nombre = '';
            if (tipoKey === 'campania-csv') {
                url = `/wapi/reportes/campania/${campania.id}/csv`;
                nombre = `campania-${campania.id}.csv`;
            } else if (tipoKey === 'campania-excel') {
                url = `/wapi/reportes/campania/${campania.id}/excel`;
                nombre = `campania-${campania.id}.xlsx`;
            } else if (tipoKey === 'bajas-csv') {
                url = '/wapi/reportes/bajas/csv';
                nombre = 'bajas.csv';
            } else {
                // El backend hace `new Date(...)` con lo que llega: sin zona, en prod (UTC) el rango se corría 3 horas.
                // Con el offset de Argentina explícito, desde y hasta son los días completos que ve la persona.
                const params = new URLSearchParams({ desde: `${desde}T00:00:00.000-03:00`, hasta: `${hasta}T23:59:59.999-03:00` });
                url = `/wapi/reportes/agentes/excel?${params}`;
                nombre = `agentes-${desde}_${hasta}.xlsx`;
            }
            const res = await api.get(url, { responseType: 'blob' });
            descargarBlob(new Blob([res.data]), nombre);
            feedback.exito(`Se descargó "${tipo.label}".`);
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo generar el reporte. Probá de nuevo.'), {
                accion: { etiqueta: 'Reintentar', onClick: descargar },
            });
        } finally {
            setGenerando(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box
                role="radiogroup"
                aria-label="Tipo de reporte"
                sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                }}
            >
                {TIPOS_REPORTE.map((t) => {
                    const elegido = tipoKey === t.key;
                    return (
                        <ButtonBase
                            key={t.key}
                            role="radio"
                            aria-checked={elegido}
                            onClick={() => setTipoKey(t.key)}
                            sx={{ display: 'block', textAlign: 'left', borderRadius: '14px', minWidth: 0 }}
                        >
                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 2,
                                    height: '100%',
                                    borderRadius: '14px',
                                    borderColor: elegido ? 'primary.main' : 'divider',
                                    boxShadow: (th) => (elegido ? `inset 0 0 0 1px ${th.palette.primary.main}` : 'none'),
                                    bgcolor: elegido ? 'action.selected' : 'background.paper',
                                }}
                            >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                                    <Typography sx={{ fontSize: 15, fontWeight: 650 }}>{t.label}</Typography>
                                    {elegido ? <Check size={18} strokeWidth={2} aria-hidden /> : <StatusChip label={t.formato} tono={t.tono} />}
                                </Box>
                                <Typography variant="body2" color="text.secondary">{t.descripcion}</Typography>
                            </Paper>
                        </ButtonBase>
                    );
                })}
            </Box>

            <SectionCard title="Configurar y descargar" subtitle={tipo ? tipo.label : 'Elegí un tipo de reporte arriba.'}>
                {estadoLista === 'error' && tipo?.necesitaCampania ? (
                    <BloqueEstado estado="error" mensaje="No se pudieron cargar las campañas." onReintentar={cargarCampanias} />
                ) : (
                    <Box
                        sx={{
                            display: 'grid',
                            gap: 2,
                            gridTemplateColumns: { xs: '1fr', md: tipo?.tieneRango ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)' },
                            maxWidth: 640,
                        }}
                    >
                        {tipo?.necesitaCampania && (
                            <Autocomplete
                                sx={{ gridColumn: '1 / -1' }}
                                options={campanias}
                                loading={estadoLista === 'cargando'}
                                loadingText="Cargando campañas…"
                                noOptionsText="No hay campañas con ese nombre"
                                getOptionLabel={(c) => c.nombre ?? ''}
                                isOptionEqualToValue={(a, b) => a.id === b.id}
                                value={campania}
                                onChange={(_, v) => setCampania(v)}
                                renderInput={(params) => <TextField {...params} label="Campaña" placeholder="Escribí para buscar" />}
                            />
                        )}
                        {tipo?.tieneRango && (
                            <>
                                <TextField
                                    type="date"
                                    label="Desde"
                                    value={desde}
                                    onChange={(e) => setDesde(e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    error={!!desde && !!hasta && desde > hasta}
                                />
                                <TextField
                                    type="date"
                                    label="Hasta"
                                    value={hasta}
                                    onChange={(e) => setHasta(e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    error={!!desde && !!hasta && desde > hasta}
                                    helperText={desde > hasta ? 'Tiene que ser posterior a "Desde".' : 'Incluye el día entero.'}
                                />
                            </>
                        )}
                        {!tipo && (
                            <Typography variant="body2" color="text.secondary">
                                Cuando elijas un tipo vas a ver acá lo que hay que completar.
                            </Typography>
                        )}
                        <Box sx={{ gridColumn: '1 / -1' }}>
                            <Button
                                variant="contained"
                                onClick={descargar}
                                disabled={!puedeDescargar}
                                aria-busy={generando}
                                startIcon={generando ? <CircularProgress size={18} color="inherit" /> : <Download size={18} strokeWidth={1.75} aria-hidden />}
                                sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: { xs: 44, sm: 36 } }}
                            >
                                {generando ? 'Generando…' : 'Generar y descargar'}
                            </Button>
                        </Box>
                    </Box>
                )}
            </SectionCard>
        </Box>
    );
}
