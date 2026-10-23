import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Box, CircularProgress, Container, Typography, useTheme } from '@mui/material';
import { GoogleLogin } from '@react-oauth/google';
import { Navigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { mensajeDeError } from '../context/FeedbackContext';
import LogoSender from './layout/LogoSender';
import { SectionCard } from './ui';

/**
 * Adónde volver después de entrar. Sólo se acepta una ruta interna ("/algo"): una URL absoluta o "//otro-sitio" en
 * `?volver=` sería un redirect abierto, y la pantalla de login es justo la que alguien va a querer falsificar.
 */
function destinoSeguro(valor) {
    if (typeof valor !== 'string' || !valor.startsWith('/')) return '/';
    // Se valida la URL ya normalizada, como la va a leer el navegador: un tab o un salto de línea en "/\t/otro.com" se
    // descartan al parsear y queda "//otro.com". Mirar solo los primeros caracteres no alcanza.
    let url;
    try {
        url = new URL(valor, window.location.origin);
    } catch {
        return '/';
    }
    if (url.origin !== window.location.origin) return '/';
    // No volver al propio login: quedaría en un bucle.
    if (url.pathname.startsWith('/login')) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
}

const Login = () => {
    const { autenticado } = useAuth();
    const oscuro = useTheme().palette.mode === 'dark';
    const [error, setError] = useState('');
    const [entrando, setEntrando] = useState(false);
    const [ancho, setAncho] = useState(280);
    const cajaRef = useRef(null);

    // El botón de Google se dibuja con un ancho en píxeles (200 a 400): se mide la tarjeta para que ocupe todo.
    useLayoutEffect(() => {
        const el = cajaRef.current;
        if (!el) return undefined;
        const medir = () => setAncho(Math.max(200, Math.min(400, Math.floor(el.getBoundingClientRect().width))));
        medir();
        const ro = new ResizeObserver(medir);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        document.title = 'Ingresar — AMSA Sender';
    }, []);

    const volver = destinoSeguro(new URLSearchParams(window.location.search).get('volver'));

    // Ya hay sesión válida: no tiene sentido pedir el login de nuevo.
    if (autenticado) return <Navigate to={volver} replace />;

    const alEntrar = async (credentialResponse) => {
        const token = credentialResponse?.credential;
        if (!token) {
            setError('Google no devolvió la credencial. Probá de nuevo.');
            return;
        }
        setError('');
        setEntrando(true);
        try {
            const { data } = await api.post('/auth/google', { token });
            if (!data?.access_token) throw new Error('sin token');
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('usuario', JSON.stringify(data.usuario));
            // Recarga completa, como siempre: corta cualquier estado de la sesión anterior.
            window.location.href = volver;
        } catch (err) {
            // El backend distingue "no está dado de alta" de "cuenta suspendida": se muestra tal cual.
            setError(mensajeDeError(err, 'No se pudo iniciar sesión. Probá de nuevo.'));
            setEntrando(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100dvh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.default',
                px: 2,
                py: 4,
                pt: 'max(32px, env(safe-area-inset-top))',
                pb: 'max(32px, env(safe-area-inset-bottom))',
            }}
        >
            <Container maxWidth="xs" disableGutters>
                <SectionCard sx={{ p: { xs: 1, sm: 2 } }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, textAlign: 'center' }}>
                        <Box sx={{ mt: 1 }}>
                            <LogoSender size={72} titulo="AMSA Sender" />
                        </Box>
                        <Box>
                            <Typography component="h1" sx={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
                                AMSA Sender
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Campañas de WhatsApp y email, y la atención de las respuestas, en un solo lugar.
                            </Typography>
                        </Box>

                        {error && (
                            <Alert severity="error" variant="outlined" sx={{ width: '100%', textAlign: 'left' }} role="alert">
                                {error}
                            </Alert>
                        )}

                        <Box ref={cajaRef} sx={{ width: '100%', minHeight: 44, display: 'flex', justifyContent: 'center' }}>
                            {entrando ? (
                                <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary', minHeight: 44 }}>
                                    <CircularProgress size={20} />
                                    <Typography variant="body2">Ingresando…</Typography>
                                </Box>
                            ) : (
                                <GoogleLogin
                                    onSuccess={alEntrar}
                                    onError={() => setError('No se pudo conectar con Google. Revisá que no tengas bloqueadas las ventanas emergentes y probá de nuevo.')}
                                    theme={oscuro ? 'filled_black' : 'outline'}
                                    size="large"
                                    shape="rectangular"
                                    text="signin_with"
                                    locale="es"
                                    width={ancho}
                                />
                            )}
                        </Box>

                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12.5 }}>
                            Solo pueden entrar las cuentas que dio de alta el administrador.
                        </Typography>
                    </Box>
                </SectionCard>
            </Container>
        </Box>
    );
};

export default Login;
