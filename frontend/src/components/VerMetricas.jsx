import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, LinearProgress, Typography } from '@mui/material';
import { FileText, MessageSquareText } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { BloqueEstado, EmptyState, PageHeader, SectionCard } from './ui';
import { migasDe } from './layout/navConfig';
import { SelectorCampaniaWeb, useCampaniaElegida, useCampaniasWeb } from './analitica/campaniasWeb';
import GrillaKpi from './analitica/GrillaKpi';
import { fmtNumero, fmtPct, porcentaje } from './analitica/formato';

export default function VerMetricas() {
    const { hasPermiso } = useAuth();
    const { campanias, estado: estadoLista, recargar } = useCampaniasWeb();
    const { campania, campaniaId, elegir } = useCampaniaElegida(campanias);
    const [metricas, setMetricas] = useState(null);
    const [estado, setEstado] = useState('inicial');
    const [reintento, setReintento] = useState(0);

    useEffect(() => {
        setMetricas(null);
        if (!campania?.id) {
            setEstado('inicial');
            return undefined;
        }
        // Al cambiar de campaña se vacía y se muestra la carga: antes quedaban los números de la anterior.
        let vigente = true;
        setEstado('cargando');
        api.get(`/whatsapp/mensajes/campania/${campania.id}/metricas`)
            .then((res) => {
                if (!vigente) return;
                setMetricas(res.data);
                setEstado('ok');
            })
            .catch(() => {
                if (vigente) setEstado('error');
            });
        return () => {
            vigente = false;
        };
    }, [campania?.id, reintento]);

    const enviados = Number(metricas?.enviados ?? 0);
    const respondieron = Number(metricas?.contactosRespondieron ?? 0);
    // El backend manda el porcentaje; si faltara se calcula, así nunca se rompe con null.
    const pctRespuesta = metricas?.porcentajeRespondieron != null ? Number(metricas.porcentajeRespondieron) : porcentaje(respondieron, enviados, 2);

    const vinculo = campaniaId ? `?campania=${campaniaId}` : '';

    return (
        <Box>
            <PageHeader
                title="Métricas de WhatsApp Web"
                subtitle="Cuánta gente respondió a cada campaña."
                breadcrumbs={migasDe('/metricas')}
                actions={hasPermiso('whatsapp.reportes') && (
                    <Button component={RouterLink} to={`/reportes${vinculo}`} variant="outlined" startIcon={<FileText size={18} strokeWidth={1.75} aria-hidden />}>
                        Ver reportes de envío
                    </Button>
                )}
            />

            <Box sx={{ mb: 3 }}>
                <SelectorCampaniaWeb campanias={campanias} estado={estadoLista} onReintentar={recargar} value={campania} onChange={elegir} />
            </Box>

            {estado === 'inicial' && estadoLista !== 'error' && (
                <EmptyState
                    icon={MessageSquareText}
                    title="Elegí una campaña"
                    description="Buscá la campaña arriba para ver cuántos contactos respondieron."
                />
            )}
            {estado === 'cargando' && <BloqueEstado estado="cargando" mensaje="Cargando métricas…" />}
            {estado === 'error' && (
                <BloqueEstado estado="error" mensaje="No se pudieron cargar las métricas de la campaña." onReintentar={() => setReintento((n) => n + 1)} />
            )}

            {estado === 'ok' && metricas && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <GrillaKpi
                        max={4}
                        items={[
                            { titulo: 'Mensajes enviados', valor: fmtNumero(enviados) },
                            { titulo: 'Contactos que respondieron', valor: fmtNumero(respondieron) },
                            { titulo: 'Porcentaje de respuesta', valor: fmtPct(pctRespuesta, 2) },
                            { titulo: 'Mensajes recibidos', valor: fmtNumero(metricas.totalRespuestas), leyenda: 'contando todas las respuestas' },
                        ]}
                    />
                    <SectionCard title="Respondieron sobre enviados" subtitle={`${fmtNumero(respondieron)} de ${fmtNumero(enviados)} contactos`}>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, Math.max(0, pctRespuesta))}
                            aria-label="Porcentaje de contactos que respondieron"
                            sx={{ height: 14, borderRadius: 7, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { borderRadius: 7, bgcolor: 'success.main' } }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {fmtPct(pctRespuesta, 2)} de los contactos a los que se les envió respondió al menos una vez.
                        </Typography>
                    </SectionCard>
                </Box>
            )}
        </Box>
    );
}
