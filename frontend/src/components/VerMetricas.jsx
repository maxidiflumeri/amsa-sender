import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    TextField,
    Autocomplete,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import api from '../api/axios';
import BarChartIcon from '@mui/icons-material/BarChart';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

export default function VerMetricas() {
    const theme = useTheme();
    const [campanias, setCampanias] = useState([]);
    const [campaniaSeleccionada, setCampaniaSeleccionada] = useState(null);
    const [metricas, setMetricas] = useState(null);
    const [tipoGrafico, setTipoGrafico] = useState('torta');

    useEffect(() => {
        api.get('/whatsapp/reportes/campanias-con-reportes')
            .then(res => setCampanias(res.data))
            .catch(err => console.error('Error cargando campañas', err));
    }, []);

    useEffect(() => {
        if (campaniaSeleccionada?.id) {
            api.get(`/whatsapp/mensajes/campania/${campaniaSeleccionada.id}/metricas`)
                .then(res => setMetricas(res.data))
                .catch(err => console.error('Error cargando métricas', err));
        }
    }, [campaniaSeleccionada]);

    const data = metricas ? [
        { name: 'Enviados', value: metricas.enviados },
        { name: 'Contactos que respondieron', value: metricas.contactosRespondieron },
        { name: 'Total mensajes recibidos', value: metricas.totalRespuestas }
    ] : [];

    const renderChart = () => {
        if (tipoGrafico === 'torta') {
            return (
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            labelLine={false}
                            label={({ name }) => name}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            );
        } else {
            return (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                </ResponsiveContainer>
            );
        }
    };

    return (
        <Box py={3}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChartIcon color="primary" />
                Métricas de Campaña
            </Typography>

            <Autocomplete
                options={campanias}
                getOptionLabel={(option) => option.nombre}
                value={campaniaSeleccionada}
                onChange={(_, newValue) => setCampaniaSeleccionada(newValue)}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Buscar campaña"
                        placeholder="Ej: Campaña verano"
                        sx={{ mb: 3, minWidth: 240 }}
                    />
                )}
                isOptionEqualToValue={(option, value) => option.id === value.id}
            />

            <ToggleButtonGroup
                color="primary"
                value={tipoGrafico}
                exclusive
                onChange={(_, newValue) => newValue && setTipoGrafico(newValue)}
                sx={{ mb: 2 }}
            >
                <ToggleButton value="torta">Gráfico de torta</ToggleButton>
                <ToggleButton value="barras">Gráfico de barras</ToggleButton>
            </ToggleButtonGroup>

            {metricas ? (
                <Paper
                    elevation={3}
                    sx={{
                        p: 3,
                        borderRadius: 3,
                        backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fefefe',
                        boxShadow: theme.palette.mode === 'dark' ? 3 : 6,
                        mt: 2
                    }}
                >
                    <Typography variant="body1" gutterBottom>
                        <strong>Mensajes enviados:</strong> {metricas.enviados}
                    </Typography>
                    <Typography variant="body1" gutterBottom color="success.main">
                        <strong>Contactos que respondieron:</strong> {metricas.contactosRespondieron}
                    </Typography>
                    <Typography variant="body1" gutterBottom color="warning.main">
                        <strong>Mensajes recibidos:</strong> {metricas.totalRespuestas}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                        <strong>% de respuesta:</strong> <span style={{ color: '#1976d2', fontWeight: 600 }}>
                            {metricas.porcentajeRespondieron.toFixed(2)}%
                        </span>
                    </Typography>

                    {renderChart()}
                </Paper>
            ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Seleccioná una campaña para ver las métricas.
                </Typography>
            )}
        </Box>
    );
}