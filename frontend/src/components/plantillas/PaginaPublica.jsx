import { Box, CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { buildTheme } from '../../theme';

// Estas páginas las ve el deudor que recibió el mail, no un operador: siempre en tema claro, aunque el navegador (o la
// preferencia de quien las abre) esté en oscuro. El tema se arma una sola vez.
const temaClaro = buildTheme('light');

/**
 * El marco de las páginas públicas: tema claro fijo, fondo propio y contenido centrado. `ancho` en px es el máximo.
 */
export default function PaginaPublica({ children, ancho = 520, centrado = true }) {
    return (
        <ThemeProvider theme={temaClaro}>
            <CssBaseline />
            <Box
                sx={{
                    minHeight: '100dvh',
                    bgcolor: 'background.default',
                    color: 'text.primary',
                    display: 'flex',
                    alignItems: centrado ? 'center' : 'flex-start',
                    justifyContent: 'center',
                    px: 2,
                    py: 3,
                    pb: 'calc(24px + env(safe-area-inset-bottom))',
                }}
            >
                <Box sx={{ width: '100%', maxWidth: ancho }}>{children}</Box>
            </Box>
        </ThemeProvider>
    );
}
