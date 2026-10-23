import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { buildTheme } from '../theme';

// La misma clave que usaba Sender (`themeMode`), así nadie pierde lo que eligió. Ahora acepta también `system`.
const CLAVE = 'themeMode';
const PREFERENCIAS = ['light', 'dark', 'system'];
const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';

function leerPreferencia() {
    try {
        const guardada = localStorage.getItem(CLAVE);
        return PREFERENCIAS.includes(guardada) ? guardada : 'system';
    } catch {
        return 'system';
    }
}

function equipoEnOscuro() {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(CONSULTA_OSCURO).matches;
}

const ColorModeContext = createContext({
    preferencia: 'system',
    modo: 'light',
    setPreferencia: () => {},
    toggleColorMode: () => {},
});

/**
 * El tema de la app: Claro, Oscuro o Sistema (sigue al equipo y escucha sus cambios). Incluye el ThemeProvider y el
 * CssBaseline. También pinta la barra del sistema del celular (`theme-color`) con el color del marco.
 */
export function ColorModeProvider({ children }) {
    const [preferencia, setPreferenciaState] = useState(leerPreferencia);
    const [sistemaOscuro, setSistemaOscuro] = useState(equipoEnOscuro);

    useEffect(() => {
        if (!window.matchMedia) return undefined;
        const mq = window.matchMedia(CONSULTA_OSCURO);
        const alCambiar = (e) => setSistemaOscuro(e.matches);
        mq.addEventListener?.('change', alCambiar);
        return () => mq.removeEventListener?.('change', alCambiar);
    }, []);

    const modo = preferencia === 'system' ? (sistemaOscuro ? 'dark' : 'light') : preferencia;
    const theme = useMemo(() => buildTheme(modo), [modo]);

    useEffect(() => {
        // Las páginas públicas (las ve el deudor) van siempre en claro, también los controles nativos y la barra.
        document.documentElement.style.colorScheme = window.location.pathname.startsWith('/mailing/') ? 'light' : modo;
        const marco = theme.palette.background.marco;
        document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', marco));
    }, [modo, theme]);

    const setPreferencia = useCallback((nueva) => {
        if (!PREFERENCIAS.includes(nueva)) return;
        setPreferenciaState(nueva);
        try {
            localStorage.setItem(CLAVE, nueva);
        } catch {
            /* sin localStorage (modo privado): vale solo para esta pestaña */
        }
    }, []);

    const toggleColorMode = useCallback(() => setPreferencia(modo === 'dark' ? 'light' : 'dark'), [modo, setPreferencia]);

    const valor = useMemo(() => ({ preferencia, modo, setPreferencia, toggleColorMode }), [preferencia, modo, setPreferencia, toggleColorMode]);

    return (
        <ColorModeContext.Provider value={valor}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
}

export function useColorMode() {
    return useContext(ColorModeContext);
}
