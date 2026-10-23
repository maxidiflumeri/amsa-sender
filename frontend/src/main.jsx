import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { es } from 'date-fns/locale';
import { GoogleOAuthProvider } from '@react-oauth/google';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, registrarAlCerrarSesion } from './context/AuthContext';
import { ColorModeProvider } from './context/ColorModeContext';
import { FeedbackProvider } from './context/FeedbackContext';
import { PwaProvider, desuscribirPushAlCerrarSesion } from './pwa';

// Al cerrar sesión, primero se da de baja la suscripción push (el pedido necesita el token todavía vigente).
registrarAlCerrarSesion(desuscribirPushAlCerrarSesion);

// Una pestaña con la versión anterior que pide una pantalla cuyo archivo ya no está publicado: recarga una vez para
// tomar la versión nueva (si vuelve a fallar enseguida, queda el aviso del ErrorBoundary).
window.addEventListener('vite:preloadError', (evento) => {
    try {
        const ultima = Number(sessionStorage.getItem('recargaPorVersion') || 0);
        if (Date.now() - ultima < 30_000) return;
        sessionStorage.setItem('recargaPorVersion', String(Date.now()));
    } catch {
        /* sin sessionStorage: se recarga igual */
    }
    evento.preventDefault();
    window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
            <BrowserRouter>
                <ColorModeProvider>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
                        <AuthProvider>
                            <PwaProvider>
                                <FeedbackProvider>
                                    <ErrorBoundary>
                                        <App />
                                    </ErrorBoundary>
                                </FeedbackProvider>
                            </PwaProvider>
                        </AuthProvider>
                    </LocalizationProvider>
                </ColorModeProvider>
            </BrowserRouter>
        </GoogleOAuthProvider>
    </React.StrictMode>,
);
