import { GoogleLogin } from '@react-oauth/google';
import {
    Box,
    Paper,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    useTheme
} from '@mui/material';
import logo from '../assets/amsasender.png';
import { motion } from 'framer-motion';
import { useState } from 'react';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const Login = () => {
    const theme = useTheme();
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
                window.location.href = '/dashboard';
            } else {
                setErrorOpen(true);
            }
        } catch (err) {
            setErrorOpen(true);
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

                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            minWidth: 260,
                            maxWidth: 320,
                            mx: 'auto',
                        }}
                    >
                        <GoogleLogin
                            onSuccess={handleLoginSuccess}
                            onError={() => console.log('Error en el login')}
                            theme={theme.palette.mode === 'dark' ? 'filled_black' : 'outline'}
                            size="large"
                            shape="pill"
                        />
                    </Box>
                </Paper>
                {/* Diálogo de error de acceso denegado */}
                <Dialog
                    open={errorOpen}
                    onClose={() => setErrorOpen(false)}
                    PaperProps={{
                        sx: {
                            borderRadius: 3,
                            p: 3,
                            backgroundColor: theme.palette.mode === 'dark' ? '#202124' : '#fff',
                            color: theme.palette.mode === 'dark' ? '#e8eaed' : '#000',
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
                            Tu cuenta no tiene permisos para usar AMSA Sender.<br />
                            Por favor, usá una cuenta <strong>@anamayasa.com.ar</strong> autorizada.
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
                                '&:hover': {
                                    backgroundColor: '#1967d2',
                                },
                            }}
                        >
                            Volver
                        </Button>
                    </DialogActions>
                </Dialog>
            </motion.div>
        </Box>
    );
};

export default Login;