import { Box, Tab, Tabs } from '@mui/material';
import { BarChart3, Download, Users } from 'lucide-react';
import { PageHeader } from '../../ui';
import { migasDe } from '../../layout/navConfig';
import useTabUrl from '../../analitica/useTabUrl';
import MetricasCampania from './MetricasCampania';
import MetricasAgentes from './MetricasAgentes';
import WapiReportes from './WapiReportes';

// La pestaña vive en `?tab=` (campanas | agentes | reportes). Cada una se monta sola: al cambiar se vuelve a cargar,
// pero el atrás y los enlaces compartidos caen en la pestaña correcta.
const PESTANIAS = ['campanas', 'agentes', 'reportes'];

export default function WapiAnalitica() {
    const [tab, setTab] = useTabUrl(PESTANIAS);

    return (
        <Box>
            <PageHeader
                title="Analítica de WhatsApp API"
                subtitle="Cómo les fue a las campañas y al equipo que atiende las respuestas."
                breadcrumbs={migasDe('/wapi/analitica')}
            />
            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                allowScrollButtonsMobile
                scrollButtons="auto"
                aria-label="Secciones de la analítica"
                sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, md: 3 }, '& .MuiTab-root': { minHeight: 48 } }}
            >
                <Tab icon={<BarChart3 size={18} strokeWidth={1.75} aria-hidden />} iconPosition="start" label="Campañas" />
                <Tab icon={<Users size={18} strokeWidth={1.75} aria-hidden />} iconPosition="start" label="Agentes" />
                <Tab icon={<Download size={18} strokeWidth={1.75} aria-hidden />} iconPosition="start" label="Reportes" />
            </Tabs>
            {tab === 0 && <MetricasCampania />}
            {tab === 1 && <MetricasAgentes />}
            {tab === 2 && <WapiReportes />}
        </Box>
    );
}
