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
        <Box sx={{ height: '100%', pt: 3 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Typography variant="h5" fontWeight="bold" mb={2}>Analítica WhatsApp API</Typography>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab icon={<BarChartIcon />} iconPosition="start" label="Campañas" />
                    <Tab icon={<PeopleIcon />} iconPosition="start" label="Agentes" />
                    <Tab icon={<DownloadIcon />} iconPosition="start" label="Reportes" />
                </Tabs>
            </Box>
            {tab === 0 && <MetricasCampania />}
            {tab === 1 && <MetricasAgentes />}
            {tab === 2 && <WapiReportes />}
        </Box>
    );
}
