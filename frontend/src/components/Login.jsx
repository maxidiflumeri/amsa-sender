import { GoogleLogin } from '@react-oauth/google';
import {
    Box,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    useTheme,
    Chip,
} from '@mui/material';
import logo from '../assets/amsasender.png';
import { motion } from 'framer-motion';
import { useState } from 'react';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import EmailIcon from '@mui/icons-material/Email';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import GroupsIcon from '@mui/icons-material/Groups';
import BarChartIcon from '@mui/icons-material/BarChart';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SecurityIcon from '@mui/icons-material/Security';
import InboxIcon from '@mui/icons-material/Inbox';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const features = [
    {
        icon: <AutoAwesomeIcon sx={{ fontSize: 26 }} />,
        title: 'Inteligencia Artificial',
        desc: 'Resúmenes de conversaciones, sugerencias de respuesta y análisis de campañas con IA generativa.',
        color: '#a259f7',
        isAI: true,
    },
    {
        icon: <WhatsAppIcon sx={{ fontSize: 26 }} />,
        title: 'Campañas de WhatsApp',
        desc: 'Enviá mensajes masivos con sesiones multi-cuenta y seguimiento en tiempo real.',
        color: '#25D366',
    },
    {
        icon: <InboxIcon sx={{ fontSize: 26 }} />,
        title: 'Inbox WhatsApp',
        desc: 'Recibí y respondé mensajes entrantes de WhatsApp con asignación de conversaciones por agente.',
        color: '#00BCD4',
    },
    {
        icon: <EmailIcon sx={{ fontSize: 26 }} />,
        title: 'Mailing profesional',
        desc: 'Gestión de campañas de email con plantillas HTML y múltiples cuentas SMTP.',
        color: '#4FC3F7',
    },
    {
        icon: <GroupsIcon sx={{ fontSize: 26 }} />,
        title: 'Gestión de contactos',
        desc: 'Organizá tus listas de contactos y segmentalas para cada campaña.',
        color: '#FFB74D',
    },
    {
        icon: <AttachFileIcon sx={{ fontSize: 26 }} />,
        title: 'Adjuntos y multimedia',
        desc: 'Incluí imágenes, documentos y archivos multimedia en tus envíos.',
        color: '#CE93D8',
    },
    {
        icon: <BarChartIcon sx={{ fontSize: 26 }} />,
        title: 'Reportes y estadísticas',
        desc: 'Monitoreá el estado de cada envío con reportes detallados.',
        color: '#80CBC4',
    },
    {
        icon: <SecurityIcon sx={{ fontSize: 26 }} />,
        title: 'Control de acceso',
        desc: 'Sistema de roles y permisos granulares para tu equipo.',
        color: '#F48FB1',
    },
];

const containerVariants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.1 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const Login = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [errorOpen, setErrorOpen] = useState(false);

    const handleLoginSuccess = async (credentialResponse) => {
        const token = credentialResponse.credential;
        try {
            const res = await fetch(import.meta.env.VITE_API_URL + '/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();
            if (data.access_token) {
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('usuario', JSON.stringify(data.usuario));
                window.location.href = '/';
            } else {
                setErrorOpen(true);
            }
        } catch {
            setErrorOpen(true);
        }
    };

    return (
        <Box
            sx={{
                height: '100vh',
                width: '100vw',
                display: 'flex',
                overflow: 'hidden',
                bgcolor: isDark ? '#0f1117' : '#f0f4f8',
            }}
        >
            {/* ── Panel izquierdo: Login ── */}
            <Box
                sx={{
                    width: { xs: '100%', md: '420px' },
                    minWidth: { md: '380px' },
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    px: 5,
                    py: 6,
                    bgcolor: isDark ? '#161b22' : '#ffffff',
                    boxShadow: isDark
                        ? '4px 0 24px rgba(0,0,0,0.5)'
                        : '4px 0 24px rgba(0,0,0,0.08)',
                    zIndex: 10,
                    position: 'relative',
                }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                    {/* Logo */}
                    <Box sx={{ mb: 3 }}>
                        <img src={logo} alt="AMSA Sender" style={{ height: 72 }} />
                    </Box>

                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 700,
                            mb: 0.5,
                            color: isDark ? '#e6edf3' : '#0d1117',
                            letterSpacing: '-0.5px',
                        }}
                    >
                        Bienvenido de vuelta
                    </Typography>

                    <Typography
                        variant="body2"
                        sx={{
                            mb: 4,
                            color: isDark ? '#8b949e' : '#6e7681',
                            textAlign: 'center',
                        }}
                    >
                        Iniciá sesión con tu cuenta de Google para continuar
                    </Typography>

                    {/* Divider decorativo */}
                    <Box
                        sx={{
                            width: 40,
                            height: 3,
                            borderRadius: 2,
                            background: 'linear-gradient(90deg, #075E54, #25D366)',
                            mb: 4,
                        }}
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <GoogleLogin
                            onSuccess={handleLoginSuccess}
                            onError={() => console.log('Error en el login')}
                            theme={isDark ? 'filled_black' : 'outline'}
                            size="large"
                            shape="pill"
                        />
                    </Box>

                    <Typography
                        variant="caption"
                        sx={{
                            mt: 4,
                            color: isDark ? '#484f58' : '#b0b8c4',
                            textAlign: 'center',
                            lineHeight: 1.6,
                        }}
                    >
                        Solo cuentas autorizadas pueden acceder.
                        <br />
                        Contactá al administrador si necesitás acceso.
                    </Typography>
                </motion.div>
            </Box>

            {/* ── Panel derecho: Branding ── */}
            <Box
                sx={{
                    flex: 1,
                    display: { xs: 'none', md: 'flex' },
                    flexDirection: 'column',
                    justifyContent: 'center',
                    px: { md: 6, lg: 10 },
                    py: 6,
                    background: isDark
                        ? 'linear-gradient(135deg, #0d1117 0%, #0e2a1e 50%, #0d1117 100%)'
                        : 'linear-gradient(135deg, #e8f5e9 0%, #f0fdf4 50%, #e3f2fd 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Círculos decorativos de fondo */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: -120,
                        right: -120,
                        width: 400,
                        height: 400,
                        borderRadius: '50%',
                        background: isDark
                            ? 'radial-gradient(circle, rgba(37,211,102,0.08) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(7,94,84,0.10) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: -80,
                        left: '30%',
                        width: 300,
                        height: 300,
                        borderRadius: '50%',
                        background: isDark
                            ? 'radial-gradient(circle, rgba(37,211,102,0.05) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(37,211,102,0.12) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }}
                />
                {/* Círculo decorativo IA */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '35%',
                        left: -100,
                        width: 340,
                        height: 340,
                        borderRadius: '50%',
                        background: isDark
                            ? 'radial-gradient(circle, rgba(162,89,247,0.09) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(79,142,247,0.08) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }}
                />

                {/* Encabezado */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                >
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                        <Chip
                            label="Plataforma de comunicación multicanal"
                            size="small"
                            sx={{
                                bgcolor: isDark ? 'rgba(37,211,102,0.12)' : 'rgba(7,94,84,0.08)',
                                color: isDark ? '#25D366' : '#075E54',
                                fontWeight: 600,
                                fontSize: 11,
                                border: `1px solid ${isDark ? 'rgba(37,211,102,0.2)' : 'rgba(7,94,84,0.15)'}`,
                            }}
                        />
                        <Chip
                            icon={<AutoAwesomeIcon sx={{ fontSize: '13px !important', color: '#a259f7 !important' }} />}
                            label="Impulsado por IA"
                            size="small"
                            sx={{
                                background: isDark
                                    ? 'linear-gradient(135deg, rgba(79,142,247,0.18) 0%, rgba(162,89,247,0.18) 100%)'
                                    : 'linear-gradient(135deg, rgba(79,142,247,0.1) 0%, rgba(162,89,247,0.1) 100%)',
                                color: isDark ? '#c4b5fd' : '#7c3aed',
                                fontWeight: 700,
                                fontSize: 11,
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

                    <Typography
                        variant="h3"
                        sx={{
                            fontWeight: 800,
                            lineHeight: 1.15,
                            mb: 1.5,
                            color: isDark ? '#e6edf3' : '#0d1117',
                            letterSpacing: '-1px',
                            fontSize: { md: '2.2rem', lg: '2.8rem' },
                        }}
                    >
                        AMSA{' '}
                        <Box
                            component="span"
                            sx={{
                                background: 'linear-gradient(90deg, #075E54, #25D366)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            Sender
                        </Box>
                    </Typography>

                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 400,
                            color: isDark ? '#8b949e' : '#4a5568',
                            mb: 5,
                            maxWidth: 480,
                            lineHeight: 1.6,
                            fontSize: { md: '1rem', lg: '1.1rem' },
                        }}
                    >
                        Enviá campañas, gestioná conversaciones y analizá resultados de WhatsApp y Email — potenciado con IA generativa.
                    </Typography>
                </motion.div>

                {/* Features grid */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { md: '1fr 1fr', lg: '1fr 1fr 1fr' },
                            gap: 2,
                            maxWidth: 960,
                        }}
                    >
                        {features.map((f) => (
                            <motion.div key={f.title} variants={itemVariants}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 2,
                                        p: 2,
                                        borderRadius: 3,
                                        backdropFilter: 'blur(4px)',
                                        transition: 'all 0.2s ease',
                                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
                                        border: `1px solid ${f.color}55`,
                                        '&:hover': {
                                            bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.95)',
                                            transform: 'translateY(-2px)',
                                            boxShadow: isDark
                                                ? '0 4px 20px rgba(0,0,0,0.3)'
                                                : '0 4px 20px rgba(0,0,0,0.08)',
                                        },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            color: f.color,
                                            mt: 0.3,
                                            flexShrink: 0,
                                            p: 0.8,
                                            borderRadius: 2,
                                            bgcolor: f.isAI
                                                ? isDark ? 'rgba(162,89,247,0.2)' : 'rgba(162,89,247,0.12)'
                                                : isDark ? `${f.color}18` : `${f.color}22`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {f.icon}
                                    </Box>
                                    <Box>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontWeight: 700,
                                                mb: 0.3,
                                                fontSize: 13,
                                                ...(f.isAI ? {
                                                    background: 'linear-gradient(135deg, #4f8ef7 0%, #a259f7 100%)',
                                                    WebkitBackgroundClip: 'text',
                                                    WebkitTextFillColor: 'transparent',
                                                } : {
                                                    color: isDark ? '#e6edf3' : '#1a202c',
                                                }),
                                            }}
                                        >
                                            {f.title}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: isDark ? '#8b949e' : '#718096',
                                                lineHeight: 1.5,
                                                display: 'block',
                                            }}
                                        >
                                            {f.desc}
                                        </Typography>
                                    </Box>
                                </Box>
                            </motion.div>
                        ))}
                    </Box>
                </motion.div>
            </Box>

            {/* ── Diálogo de error ── */}
            <Dialog
                open={errorOpen}
                onClose={() => setErrorOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        p: 3,
                        backgroundColor: isDark ? '#202124' : '#fff',
                        color: isDark ? '#e8eaed' : '#000',
                        boxShadow: 10,
                        maxWidth: 400,
                        mx: 'auto',
                    },
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <ErrorOutlineIcon sx={{ fontSize: 48, color: '#d93025' }} />
                </Box>
                <DialogTitle sx={{ textAlign: 'center', fontWeight: 600, fontSize: 20, p: 0, mb: 1 }}>
                    Acceso denegado
                </DialogTitle>
                <DialogContent sx={{ textAlign: 'center', px: 1 }}>
                    <Typography variant="body1" sx={{ fontSize: 15 }}>
                        Tu cuenta no tiene acceso a AMSA Sender.<br />
                        Pedile al administrador que te dé de alta en el sistema.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', mt: 2 }}>
                    <Button
                        variant="contained"
                        onClick={() => setErrorOpen(false)}
                        sx={{
                            backgroundColor: '#1a73e8',
                            textTransform: 'none',
                            borderRadius: 999,
                            px: 4,
                            py: 1,
                            fontWeight: 500,
                            '&:hover': { backgroundColor: '#1967d2' },
                        }}
                    >
                        Volver
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Login;
