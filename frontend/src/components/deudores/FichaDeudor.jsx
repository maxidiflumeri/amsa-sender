import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Paper,
    Typography,
    Button,
    Chip,
    Skeleton,
    Alert,
    useTheme,
    Grid,
    Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import BusinessIcon from '@mui/icons-material/Business';
import DescriptionIcon from '@mui/icons-material/Description';
import api from '../../api/axios';
import TimelineDeudor from './TimelineDeudor';

const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

const DataRow = ({ label, value, theme }) => (
    <Box sx={{ mb: 2 }}>
        <Typography
            variant="caption"
            sx={{
                color: theme.palette.text.secondary,
                textTransform: 'uppercase',
                fontWeight: 'bold',
                fontSize: '0.7rem',
            }}
        >
            {label}
        </Typography>
        <Typography
            variant="body1"
            sx={{ color: theme.palette.text.primary, mt: 0.5 }}
        >
            {value || '-'}
        </Typography>
    </Box>
);

export default function FichaDeudor() {
    const theme = useTheme();
    const navigate = useNavigate();
    const { id } = useParams();

    const [deudor, setDeudor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        const cargarDeudor = async () => {
            if (!id) {
                setError('ID de deudor inválido');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            setNotFound(false);

            try {
                const res = await api.get(`/deudores/${id}`);
                setDeudor(res.data);
            } catch (err) {
                if (err.response?.status === 404) {
                    setNotFound(true);
                } else {
                    setError(err.response?.data?.message || 'Error al cargar el deudor');
                }
            } finally {
                setLoading(false);
            }
        };

        cargarDeudor();
    }, [id]);

    const handleVolver = () => {
        navigate('/deudores');
    };

    // Loading state
    if (loading) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Skeleton variant="circular" width={40} height={40} />
                    <Skeleton variant="text" width={200} height={50} />
                </Box>
                <Paper sx={{ p: 3, mb: 3, bgcolor: theme.palette.background.paper }}>
                    <Skeleton variant="text" width="60%" height={40} />
                    <Skeleton variant="text" width="40%" height={30} />
                    <Divider sx={{ my: 3 }} />
                    <Grid container spacing={3}>
                        {[1, 2, 3, 4].map((i) => (
                            <Grid item xs={12} sm={6} md={3} key={i}>
                                <Skeleton variant="text" width="60%" height={20} />
                                <Skeleton variant="text" width="80%" height={30} />
                            </Grid>
                        ))}
                    </Grid>
                </Paper>
                <Paper sx={{ p: 3, bgcolor: theme.palette.background.paper }}>
                    <Skeleton variant="text" width="40%" height={40} />
                    <Skeleton variant="rectangular" width="100%" height={100} sx={{ mt: 2 }} />
                </Paper>
            </Container>
        );
    }

    // Not found state
    if (notFound) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                <Paper
                    sx={{
                        p: 4,
                        bgcolor: theme.palette.background.paper,
                        textAlign: 'center',
                    }}
                >
                    <PersonIcon
                        sx={{ fontSize: 80, color: theme.palette.text.secondary, mb: 2 }}
                    />
                    <Typography variant="h5" sx={{ mb: 2, color: theme.palette.text.primary }}>
                        Deudor no encontrado
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{ mb: 3, color: theme.palette.text.secondary }}
                    >
                        El deudor con ID {id} no existe en el sistema
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<ArrowBackIcon />}
                        onClick={handleVolver}
                    >
                        Volver al listado
                    </Button>
                </Paper>
            </Container>
        );
    }

    // Error state
    if (error) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
                <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={handleVolver}
                >
                    Volver al listado
                </Button>
            </Container>
        );
    }

    // Data view
    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={handleVolver}
                    sx={{ mr: 2 }}
                >
                    Volver
                </Button>
                <PersonIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
                <Box>
                    <Typography variant="h4" component="h1" sx={{ color: theme.palette.text.primary }}>
                        {deudor.nombre || 'Sin nombre'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                        ID Deudor: {deudor.idDeudor !== null ? deudor.idDeudor : '-'}
                    </Typography>
                </Box>
            </Box>

            {/* Card Datos del deudor */}
            <Paper
                sx={{
                    p: 3,
                    mb: 3,
                    bgcolor: theme.palette.background.paper,
                    borderRadius: 2,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <BusinessIcon sx={{ color: theme.palette.primary.main }} />
                    <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
                        Datos del deudor
                    </Typography>
                </Box>
                <Divider sx={{ mb: 3, borderColor: theme.palette.mode === 'light' ? '#e0e0e0' : '#333' }} />
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <DataRow
                            label="Documento"
                            value={deudor.documento}
                            theme={theme}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <DataRow
                            label="Empresa"
                            value={deudor.empresa}
                            theme={theme}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <DataRow
                            label="Nro. Empresa"
                            value={deudor.nroEmpresa}
                            theme={theme}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <DataRow
                            label="Remesa"
                            value={deudor.remesa}
                            theme={theme}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <DataRow
                            label="Última actualización"
                            value={formatDate(deudor.actualizadoEn)}
                            theme={theme}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* Card Canales de contacto */}
            <Paper
                sx={{
                    p: 3,
                    mb: 3,
                    bgcolor: theme.palette.background.paper,
                    borderRadius: 2,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <PhoneIcon sx={{ color: theme.palette.primary.main }} />
                    <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
                        Canales de contacto
                    </Typography>
                </Box>
                <Divider sx={{ mb: 3, borderColor: theme.palette.mode === 'light' ? '#e0e0e0' : '#333' }} />

                {/* Teléfonos */}
                <Box sx={{ mb: 3 }}>
                    <Typography
                        variant="subtitle2"
                        sx={{
                            color: theme.palette.text.secondary,
                            mb: 1.5,
                            fontWeight: 'bold',
                        }}
                    >
                        Teléfonos
                    </Typography>
                    {deudor.canales.telefonos.length === 0 ? (
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                            Sin teléfonos registrados
                        </Typography>
                    ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {deudor.canales.telefonos.map((tel, idx) => (
                                <Chip
                                    key={idx}
                                    icon={<PhoneIcon />}
                                    label={tel}
                                    color="success"
                                    variant="outlined"
                                    sx={{
                                        fontSize: '0.9rem',
                                        color: theme.palette.text.primary,
                                        borderColor: theme.palette.success.main,
                                    }}
                                />
                            ))}
                        </Box>
                    )}
                </Box>

                {/* Emails */}
                <Box>
                    <Typography
                        variant="subtitle2"
                        sx={{
                            color: theme.palette.text.secondary,
                            mb: 1.5,
                            fontWeight: 'bold',
                        }}
                    >
                        Emails
                    </Typography>
                    {deudor.canales.emails.length === 0 ? (
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                            Sin emails registrados
                        </Typography>
                    ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {deudor.canales.emails.map((email, idx) => (
                                <Chip
                                    key={idx}
                                    icon={<EmailIcon />}
                                    label={email}
                                    color="primary"
                                    variant="outlined"
                                    sx={{
                                        fontSize: '0.9rem',
                                        color: theme.palette.text.primary,
                                        borderColor: theme.palette.primary.main,
                                    }}
                                />
                            ))}
                        </Box>
                    )}
                </Box>
            </Paper>

            {/* Card Datos adicionales (JSON) */}
            {deudor.datos && Object.keys(deudor.datos).length > 0 && (
                <Paper
                    sx={{
                        p: 3,
                        mb: 3,
                        bgcolor: theme.palette.background.paper,
                        borderRadius: 2,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                        <DescriptionIcon sx={{ color: theme.palette.primary.main }} />
                        <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
                            Datos adicionales
                        </Typography>
                    </Box>
                    <Divider sx={{ mb: 3, borderColor: theme.palette.mode === 'light' ? '#e0e0e0' : '#333' }} />
                    <Grid container spacing={2}>
                        {Object.entries(deudor.datos).map(([key, value]) => (
                            <Grid item xs={12} sm={6} md={4} key={key}>
                                <DataRow
                                    label={key}
                                    value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    theme={theme}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </Paper>
            )}

            {/* Card Historial de interacciones (Timeline omnicanal) */}
            <Paper
                sx={{
                    p: 3,
                    bgcolor: theme.palette.background.paper,
                    borderRadius: 2,
                }}
            >
                <TimelineDeudor deudorId={deudor.id} />
            </Paper>
        </Container>
    );
}
