import { useCallback, useEffect, useState } from 'react';
import { Box, Button, CircularProgress, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { Eraser, History } from 'lucide-react';
import api from '../../api/axios';
import { mensajeDeError } from '../../context/FeedbackContext';
import { BloqueEstado, EmptyState, SectionCard } from '../ui';
import TimelineEntry from './TimelineEntry';
import { finDelDia, inicioDelDia } from './comunes';

const TAMANIO = 30;

export default function TimelineDeudor({ deudorId }) {
    const [entries, setEntries] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [canal, setCanal] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // `page` 0 reemplaza la lista; las siguientes se agregan al final ("Cargar más").
    const cargar = useCallback(async (pagina) => {
        if (!deudorId) {
            setError('ID de deudor inválido');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const params = { page: pagina, size: TAMANIO };
            if (canal) params.canal = canal;
            // Días completos en hora local: un "hasta" de hoy incluye hoy y un "desde" arranca a las 00:00 de ese día.
            if (desde) params.desde = inicioDelDia(desde);
            if (hasta) params.hasta = finDelDia(hasta);
            const res = await api.get(`/deudores/${deudorId}/timeline`, { params });
            const nuevas = res.data.data || [];
            setEntries((prev) => (pagina === 0 ? nuevas : [...prev, ...nuevas]));
            setTotal(res.data.total || 0);
            setPage(pagina);
        } catch (err) {
            setError(mensajeDeError(err, 'No se pudo cargar el historial.'));
        } finally {
            setLoading(false);
        }
    }, [deudorId, canal, desde, hasta]);

    useEffect(() => {
        cargar(0);
    }, [cargar]);

    const hayFiltros = Boolean(canal || desde || hasta);
    const limpiar = () => {
        setCanal('');
        setDesde('');
        setHasta('');
    };
    const primeraCarga = loading && entries.length === 0;
    const quedan = entries.length < total;

    return (
        <SectionCard title="Historial de interacciones" subtitle={total > 0 ? `${total.toLocaleString('es-AR')} en total` : undefined}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fit, minmax(160px, 1fr))' }, alignItems: 'start', mb: 2 }}>
                <TextField select size="small" label="Canal" value={canal} onChange={(e) => setCanal(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="wapi">WhatsApp API</MenuItem>
                    <MenuItem value="whatsapp">WhatsApp Web</MenuItem>
                    <MenuItem value="email">Email</MenuItem>
                </TextField>
                <TextField size="small" type="date" label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hasta || undefined } }} />
                <TextField size="small" type="date" label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: desde || undefined } }} />
                <Button
                    variant="outlined"
                    color="inherit"
                    onClick={limpiar}
                    disabled={!hayFiltros}
                    startIcon={<Eraser size={18} strokeWidth={1.75} aria-hidden />}
                    sx={{ minHeight: { xs: 44, sm: 40 } }}
                >
                    Limpiar filtros
                </Button>
            </Box>

            {/* Un solo estado a la vez: cargando, error, vacío o la lista. */}
            {primeraCarga ? (
                <Stack spacing={1.5}>
                    {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={96} />)}
                </Stack>
            ) : error && entries.length === 0 ? (
                <BloqueEstado estado="error" mensaje={error} onReintentar={() => cargar(0)} />
            ) : entries.length === 0 ? (
                <EmptyState
                    compact
                    icon={History}
                    title={hayFiltros ? 'Sin resultados con estos filtros' : 'Sin interacciones registradas'}
                    description={hayFiltros ? 'Probá con otro canal o con otras fechas.' : 'Todavía no se le envió nada a este deudor.'}
                />
            ) : (
                <Stack spacing={1.5}>
                    {entries.map((entry) => <TimelineEntry key={entry.id} entry={entry} />)}
                    {error && <BloqueEstado estado="error" mensaje={error} onReintentar={() => cargar(page + 1)} />}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, pt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                            Mostrando {entries.length.toLocaleString('es-AR')} de {total.toLocaleString('es-AR')}
                        </Typography>
                        {quedan && (
                            <Button
                                variant="outlined"
                                onClick={() => cargar(page + 1)}
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                                sx={{ minHeight: 44 }}
                            >
                                Cargar más
                            </Button>
                        )}
                    </Box>
                </Stack>
            )}
        </SectionCard>
    );
}
