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
import { motion } from 'framer-motion';
import logo from '../assets/amsasender.png';
import { useAuth } from '../context/AuthContext';

const features = [
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
    const { user } = useAuth();
    const nombre = user?.nombre?.split(' ')[0] ?? 'bienvenido';

    return (
        <Box sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1100, mx: 'auto' }}>
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
                        <Typography variant="h4" fontWeight={700} lineHeight={1.2}>
                            AMSA Sender
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
                </Box>
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
                                    border: '1px solid',
                                    borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                                    borderRadius: 3,
                                    bgcolor: f.bg,
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                        boxShadow: theme.palette.mode === 'dark'
                                            ? '0 4px 20px rgba(0,0,0,0.4)'
                                            : '0 4px 20px rgba(0,0,0,0.08)',
                                    },
                                }}
                            >
                                <Box sx={{ color: f.color, mb: 1.5 }}>{f.icon}</Box>
                                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
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
    );
}
