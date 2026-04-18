import React from 'react';
import {
    Card,
    CardContent,
    Box,
    Typography,
    Chip,
    Avatar,
    Link,
    useTheme,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PhonelinkIcon from '@mui/icons-material/Phonelink';
import EmailIcon from '@mui/icons-material/Email';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import AdsClickIcon from '@mui/icons-material/AdsClick';
import ChatIcon from '@mui/icons-material/Chat';

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

const truncateText = (text, maxLength = 80) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

const getEstadoColor = (estado) => {
    if (!estado) return 'default';
    const estadoLower = estado.toLowerCase();
    if (estadoLower === 'success' || estadoLower === 'enviado' || estadoLower === 'entregado' || estadoLower === 'delivered') return 'success';
    if (estadoLower === 'fallido' || estadoLower === 'failed' || estadoLower === 'error') return 'error';
    if (estadoLower === 'pending' || estadoLower === 'pendiente') return 'warning';
    if (estadoLower === 'evento') return 'info';
    return 'default';
};

const getIconAndColor = (canal, tipo, theme) => {
    if (canal === 'whatsapp') {
        return {
            icon: <PhonelinkIcon />,
            color: '#7B1FA2',
        };
    }
    if (canal === 'email') {
        if (tipo === 'open') {
            return {
                icon: <MarkEmailReadIcon />,
                color: theme.palette.info.main,
            };
        }
        if (tipo === 'click') {
            return {
                icon: <AdsClickIcon />,
                color: '#ff9800',
            };
        }
        return {
            icon: <EmailIcon />,
            color: theme.palette.info.main,
        };
    }
    if (canal === 'wapi') {
        return {
            icon: <WhatsAppIcon />,
            color: '#25D366',
        };
    }
    return {
        icon: <ChatIcon />,
        color: theme.palette.text.secondary,
    };
};

const getCanalLabel = (canal) => {
    if (canal === 'whatsapp') return 'WhatsApp Web';
    if (canal === 'wapi') return 'WhatsApp Meta';
    if (canal === 'email') return 'Email';
    return canal;
};

const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

export default function TimelineEntry({ entry }) {
    const theme = useTheme();

    if (!entry) return null;

    const { icon, color } = getIconAndColor(entry.canal, entry.tipo, theme);
    const estadoColor = getEstadoColor(entry.detalle?.estado);

    return (
        <Card
            sx={{
                mb: 2,
                bgcolor: theme.palette.background.paper,
                borderLeft: `4px solid ${color}`,
                display: 'flex',
                alignItems: 'flex-start',
                boxShadow: theme.palette.mode === 'light'
                    ? '0 1px 3px rgba(0,0,0,0.1)'
                    : '0 1px 3px rgba(255,255,255,0.05)',
            }}
        >
            <Box
                sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Avatar
                    sx={{
                        bgcolor: color,
                        width: 48,
                        height: 48,
                    }}
                >
                    {icon}
                </Avatar>
            </Box>

            <CardContent sx={{ flex: 1, py: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                    <Typography
                        variant="body1"
                        sx={{
                            fontWeight: 'bold',
                            color: theme.palette.text.primary,
                        }}
                    >
                        {getCanalLabel(entry.canal)} · {capitalize(entry.tipo)}
                    </Typography>
                    <Chip
                        label={entry.detalle?.estado || 'desconocido'}
                        color={estadoColor}
                        size="small"
                        sx={{ fontSize: '0.75rem' }}
                    />
                </Box>

                <Typography
                    variant="caption"
                    sx={{
                        color: theme.palette.text.secondary,
                        display: 'block',
                        mb: 1,
                    }}
                >
                    {formatDate(entry.fecha)}
                </Typography>

                {entry.detalle?.asunto && (
                    <Typography
                        variant="body2"
                        sx={{ color: theme.palette.text.primary, mb: 0.5 }}
                    >
                        <strong>Asunto:</strong> {truncateText(entry.detalle.asunto)}
                    </Typography>
                )}

                {entry.detalle?.mensaje && (
                    <Typography
                        variant="body2"
                        sx={{ color: theme.palette.text.primary, mb: 0.5 }}
                    >
                        <strong>Mensaje:</strong> {truncateText(entry.detalle.mensaje)}
                    </Typography>
                )}

                {entry.detalle?.templateNombre && (
                    <Typography
                        variant="body2"
                        sx={{ color: theme.palette.text.primary, mb: 0.5 }}
                    >
                        <strong>Template:</strong> {entry.detalle.templateNombre}
                    </Typography>
                )}

                {entry.detalle?.urlDestino && (
                    <Typography
                        variant="body2"
                        sx={{ color: theme.palette.text.primary, mb: 0.5 }}
                    >
                        <strong>URL:</strong>{' '}
                        <Link
                            href={entry.detalle.urlDestino}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ color: theme.palette.primary.main }}
                        >
                            {truncateText(entry.detalle.urlDestino, 50)}
                        </Link>
                    </Typography>
                )}

                {entry.detalle?.error && (
                    <Typography
                        variant="body2"
                        sx={{ color: theme.palette.error.main, mb: 0.5 }}
                    >
                        <strong>Error:</strong> {truncateText(entry.detalle.error)}
                    </Typography>
                )}

                {entry.campaniaNombre && (
                    <Typography
                        variant="caption"
                        sx={{
                            color: theme.palette.text.secondary,
                            display: 'block',
                            mt: 1,
                        }}
                    >
                        Campaña: {entry.campaniaNombre}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}
