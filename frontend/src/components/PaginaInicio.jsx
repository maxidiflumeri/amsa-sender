import {
    Box,
    Typography,
    Paper,
    Chip,
    useTheme,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import SendIcon from '@mui/icons-material/Send';
import BarChartIcon from '@mui/icons-material/BarChart';
import GroupIcon from '@mui/icons-material/Group';
import ScheduleIcon from '@mui/icons-material/Schedule';
import InboxIcon from '@mui/icons-material/Inbox';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { motion } from 'framer-motion';
import logo from '../assets/amsasender.png';
import { useAuth } from '../context/AuthContext';

const features = [
    {
        icon: <AutoAwesomeIcon sx={{ fontSize: 32 }} />,
        titulo: 'Inteligencia Artificial',
        descripcion: 'Resúmenes automáticos de conversaciones, sugerencias de respuesta contextuales y análisis de campañas y agentes con IA generativa.',
        color: '#a259f7',
        bg: 'linear-gradient(135deg, rgba(79,142,247,0.08) 0%, rgba(162,89,247,0.08) 100%)',
        isAI: true,
    },
    {
        icon: <WhatsAppIcon sx={{ fontSize: 32 }} />,
        titulo: 'Campañas WhatsApp',
        descripcion: 'Enviá mensajes masivos personalizados desde múltiples sesiones de WhatsApp. Templates Handlebars con variables dinámicas.',
        color: '#25D366',
        bg: 'rgba(37, 211, 102, 0.08)',
    },
    {
        icon: <InboxIcon sx={{ fontSize: 32 }} />,
        titulo: 'Inbox WhatsApp',
        descripcion: 'Recibí y respondé mensajes entrantes de WhatsApp. Conversaciones organizadas por estado, asignación a agentes y respuestas con adjuntos.',
        color: '#00BCD4',
        bg: 'rgba(0, 188, 212, 0.08)',
    },
    {
        icon: <EmailIcon sx={{ fontSize: 32 }} />,
        titulo: 'Campañas Email',
        descripcion: 'Diseñá emails profesionales con el editor drag & drop. Seguimiento de aperturas, clics, rebotes y desuscripciones en tiempo real.',
        color: '#1a73e8',
        bg: 'rgba(26, 115, 232, 0.08)',
    },
    {
        icon: <SendIcon sx={{ fontSize: 32 }} />,
        titulo: 'Envío Manual',
        descripcion: 'Enviá emails individuales o a múltiples destinatarios con adjuntos, desde cualquier cuenta SMTP configurada.',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.08)',
    },
    {
        icon: <BarChartIcon sx={{ fontSize: 32 }} />,
        titulo: 'Reportes y Métricas',
        descripcion: 'Visualizá el rendimiento de cada campaña con gráficos detallados de entrega, apertura y clics.',
        color: '#8b5cf6',
        bg: 'rgba(139, 92, 246, 0.08)',
    },
    {
        icon: <GroupIcon sx={{ fontSize: 32 }} />,
        titulo: 'Gestión de Usuarios',
        descripcion: 'Administrá usuarios con roles y permisos granulares. Asigná acceso solo a los módulos que cada perfil necesita.',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.08)',
    },
    {
        icon: <ScheduleIcon sx={{ fontSize: 32 }} />,
        titulo: 'Tareas Programadas',
        descripcion: 'Automatizá el envío de reportes por email en los horarios que configurés, sin intervención manual.',
        color: '#14b8a6',
        bg: 'rgba(20, 184, 166, 0.08)',
    },
];

const containerVariants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.08 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function PaginaInicio() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { user } = useAuth();
    const nombre = user?.nombre?.split(' ')[0] ?? 'bienvenido';

    return (
        <Box
            sx={{
                minHeight: 'calc(100vh - 64px)',
                background: isDark
                    ? 'linear-gradient(135deg, #0d1117 0%, #0d2016 50%, #0d1117 100%)'
                    : 'linear-gradient(135deg, #f0f4f0 0%, #f5faf5 50%, #eaf2ea 100%)',
                position: 'relative',
                overflow: 'hidden',
                mx: { xs: -1.5, sm: -2, md: -3, lg: -4 },
                px: { xs: 1.5, sm: 2, md: 3, lg: 4 },
            }}
        >
            {/* Círculos decorativos */}
            <Box sx={{
                position: 'absolute', top: -100, right: -100,
                width: 380, height: 380, borderRadius: '50%', pointerEvents: 'none',
                background: isDark
                    ? 'radial-gradient(circle, rgba(37,211,102,0.07) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(7,94,84,0.08) 0%, transparent 70%)',
            }} />
            <Box sx={{
                position: 'absolute', bottom: -80, left: '25%',
                width: 300, height: 300, borderRadius: '50%', pointerEvents: 'none',
                background: isDark
                    ? 'radial-gradient(circle, rgba(37,211,102,0.04) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(37,211,102,0.10) 0%, transparent 70%)',
            }} />

        <Box sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1100, mx: 'auto', position: 'relative' }}>
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Box
                        component="img"
                        src={logo}
                        alt="AMSA Sender"
                        sx={{ height: 52, objectFit: 'contain' }}
                    />
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.5px', color: isDark ? '#e6edf3' : '#0d1117' }}>
                            AMSA{' '}
                            <Box component="span" sx={{
                                background: 'linear-gradient(90deg, #075E54, #25D366)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}>
                                Sender
                            </Box>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Plataforma de comunicación multicanal
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ mt: 3, mb: 4 }}>
                    <Typography variant="h6" fontWeight={500} color="text.primary">
                        Hola, {nombre} 👋
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                        Usá el menú lateral para acceder a los módulos disponibles para tu perfil.
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 5 }}>
                    <Chip label="WhatsApp" icon={<WhatsAppIcon />} sx={{ bgcolor: 'rgba(37,211,102,0.12)', color: '#25D366', fontWeight: 600 }} size="small" />
                    <Chip label="Email" icon={<EmailIcon />} sx={{ bgcolor: 'rgba(26,115,232,0.12)', color: '#1a73e8', fontWeight: 600 }} size="small" />
                    <Chip label="Reportes" icon={<BarChartIcon />} sx={{ bgcolor: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontWeight: 600 }} size="small" />
                    <Chip label="Multi-cuenta SMTP" sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', fontWeight: 600 }} size="small" />
                    <Chip label="Tracking en tiempo real" sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', fontWeight: 600 }} size="small" />
                    <Chip label="Inbox WhatsApp" icon={<InboxIcon />} sx={{ bgcolor: 'rgba(0,188,212,0.12)', color: '#00BCD4', fontWeight: 600 }} size="small" />
                    <Chip
                        icon={<AutoAwesomeIcon sx={{ fontSize: '14px !important', color: '#a259f7 !important' }} />}
                        label="IA Generativa"
                        size="small"
                        sx={{
                            background: 'linear-gradient(135deg, rgba(79,142,247,0.15) 0%, rgba(162,89,247,0.15) 100%)',
                            color: theme.palette.mode === 'dark' ? '#c4b5fd' : '#7c3aed',
                            fontWeight: 700,
                            border: '1px solid rgba(162,89,247,0.3)',
                            '@keyframes aiPulse': {
                                '0%': { borderColor: 'rgba(162,89,247,0.3)' },
                                '50%': { borderColor: 'rgba(162,89,247,0.7)' },
                                '100%': { borderColor: 'rgba(162,89,247,0.3)' },
                            },
                            animation: 'aiPulse 2.5s ease-in-out infinite',
                        }}
                    />
                </Box>
            </motion.div>

            {/* Banner IA */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <Paper
                    elevation={0}
                    sx={{
                        mb: 4,
                        p: 2.5,
                        borderRadius: 3,
                        background: theme.palette.mode === 'dark'
                            ? 'linear-gradient(135deg, rgba(79,142,247,0.12) 0%, rgba(162,89,247,0.12) 100%)'
                            : 'linear-gradient(135deg, rgba(79,142,247,0.07) 0%, rgba(162,89,247,0.07) 100%)',
                        border: '1px solid rgba(162,89,247,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                    }}
                >
                    <Box
                        sx={{
                            p: 1.2,
                            borderRadius: 2.5,
                            background: 'linear-gradient(135deg, rgba(79,142,247,0.2) 0%, rgba(162,89,247,0.2) 100%)',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '& svg': {
                                background: 'linear-gradient(135deg, #4f8ef7, #a259f7)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            },
                        }}
                    >
                        <AutoAwesomeIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography
                            variant="subtitle2"
                            fontWeight={700}
                            sx={{
                                background: 'linear-gradient(135deg, #4f8ef7 0%, #a259f7 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                mb: 0.25,
                            }}
                        >
                            Ahora impulsado por IA generativa
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                            Resúmenes de conversaciones, sugerencias de respuesta y análisis de campañas generados automáticamente con IA.
                        </Typography>
                    </Box>
                    <Chip
                        label="NUEVO"
                        size="small"
                        sx={{
                            flexShrink: 0,
                            background: 'linear-gradient(135deg, #4f8ef7 0%, #a259f7 100%)',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: 10,
                            height: 20,
                        }}
                    />
                </Paper>
            </motion.div>

            {/* Feature cards */}
            <Typography variant="overline" color="text.secondary" letterSpacing={1.5} fontWeight={700}>
                Capacidades de la plataforma
            </Typography>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <Box
                    sx={{
                        mt: 1,
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                        gap: 2.5,
                    }}
                >
                    {features.map((f) => (
                        <motion.div key={f.titulo} variants={itemVariants} style={{ display: 'flex' }}>
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 2.5,
                                    width: '100%',
                                    borderRadius: 3,
                                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.75)',
                                    backdropFilter: 'blur(4px)',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    ...(f.isAI ? {
                                        border: '1px solid rgba(162,89,247,0.35)',
                                        boxShadow: isDark
                                            ? '0 0 16px rgba(162,89,247,0.12)'
                                            : '0 0 10px rgba(162,89,247,0.12)',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: theme.palette.mode === 'dark'
                                                ? '0 6px 28px rgba(162,89,247,0.3)'
                                                : '0 6px 28px rgba(79,142,247,0.2)',
                                        },
                                    } : {
                                        border: `1px solid ${f.color}55`,
                                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.75)',
                                        backdropFilter: 'blur(4px)',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: theme.palette.mode === 'dark'
                                                ? '0 4px 20px rgba(0,0,0,0.4)'
                                                : '0 4px 20px rgba(0,0,0,0.08)',
                                        },
                                    }),
                                }}
                            >
                                <Box
                                    sx={{
                                        mb: 1.5,
                                        ...(f.isAI ? {
                                            '& svg': {
                                                background: 'linear-gradient(135deg, #4f8ef7, #a259f7)',
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                            },
                                        } : {
                                            color: f.color,
                                        }),
                                    }}
                                >
                                    {f.icon}
                                </Box>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={700}
                                    gutterBottom
                                    sx={f.isAI ? {
                                        background: 'linear-gradient(135deg, #4f8ef7 0%, #a259f7 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    } : {}}
                                >
                                    {f.titulo}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                                    {f.descripcion}
                                </Typography>
                            </Paper>
                        </motion.div>
                    ))}
                </Box>
            </motion.div>
        </Box>
        </Box>
    );
}
