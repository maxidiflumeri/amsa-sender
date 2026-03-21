import { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleIcon from '@mui/icons-material/People';
import DownloadIcon from '@mui/icons-material/Download';
import MetricasCampania from './MetricasCampania';
import MetricasAgentes from './MetricasAgentes';
import WapiReportes from './WapiReportes';

export default function WapiAnalitica() {
    const [tab, setTab] = useState(0);
    return (
        <Box sx={{ height: '100%', pt: { xs: 2, md: 3 } }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, md: 3 } }}>
                <Typography fontWeight="bold" mb={1.5} sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' }, lineHeight: 1.3 }}>
                    Analítica WhatsApp API
                </Typography>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    variant="scrollable"
                    allowScrollButtonsMobile
                    scrollButtons="auto"
                >
                    <Tab icon={<BarChartIcon />} iconPosition="start" label="Campañas" sx={{ fontSize: { xs: 12, sm: 14 }, minHeight: 40 }} />
                    <Tab icon={<PeopleIcon />} iconPosition="start" label="Agentes" sx={{ fontSize: { xs: 12, sm: 14 }, minHeight: 40 }} />
                    <Tab icon={<DownloadIcon />} iconPosition="start" label="Reportes" sx={{ fontSize: { xs: 12, sm: 14 }, minHeight: 40 }} />
                </Tabs>
            </Box>
            {tab === 0 && <MetricasCampania />}
            {tab === 1 && <MetricasAgentes />}
            {tab === 2 && <WapiReportes />}
        </Box>
    );
}
