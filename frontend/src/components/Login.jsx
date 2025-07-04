import { GoogleLogin } from '@react-oauth/google';
import { Box, Typography, Paper, useTheme } from '@mui/material';
import logo from '../assets/amsasender.png';
import { motion } from 'framer-motion';

const Login = () => {
    const theme = useTheme();

    const handleLoginSuccess = async (credentialResponse) => {
        const token = credentialResponse.credential;

        const res = await fetch(import.meta.env.VITE_API_URL + '/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (data.access_token) {
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('usuario', JSON.stringify(data.usuario));
            window.location.href = '/dashboard';
        } else {
            alert('Error en el login');
        }
    };

    return (
        <Box
            sx={{
                height: '100vh',
                width: '100vw',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #075E54 0%, #25D366 100%)',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover',
            }}
        >
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            >
                <Paper
                    elevation={6}
                    sx={{
                        p: 4,
                        px: 6,
                        borderRadius: 4,
                        minWidth: 320,
                        textAlign: 'center',                        
                        background: theme.palette.mode === 'dark' ? '#1e1e1e' : '#ffffff',
                    }}
                >
                    <Box sx={{ mb: 2 }}>
                        <img src={logo} alt="Logo" style={{ height: 100 }} />
                    </Box>

                    <Typography
                        variant="h5"
                        sx={{ mb: 3, fontWeight: 'bold', color: theme.palette.mode === 'dark' ? '#fff' : '#075E54' }}
                    >
                        Bienvenido a AMSA Sender
                    </Typography>

                    <Typography variant="body2" sx={{ mb: 2, color: theme.palette.text.secondary }}>
                        Iniciá sesión con tu cuenta de Google
                    </Typography>

                    <GoogleLogin
                        onSuccess={handleLoginSuccess}
                        onError={() => console.log('Error en el login')}
                        theme={theme.palette.mode === 'dark' ? 'filled_black' : 'outline'}
                        size="large"
                        shape="pill"
                    />
                </Paper>
            </motion.div>
        </Box>
    );
};

export default Login;