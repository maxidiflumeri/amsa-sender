// Los colores de Sender. Son los de AMSA Gestión (frontend/src/theme/tokens.ts) con otro acento: los grises, los
// fondos y el oscuro se comparten para que las dos se vean de la misma familia; el verde es lo propio de Sender.
// `background.marco` es el fondo de la barra superior y del menú lateral; la pantalla va en un panel encima.

/** El verde de la marca. El logo es el mismo en claro y en oscuro. */
export const VERDE_MARCA = '#075E54';

export const lightPalette = {
    primary: {
        main: '#075E54',
        light: '#128C7E',
        dark: '#053F38',
        contrastText: '#FFFFFF',
    },
    secondary: {
        main: '#7C3AED',
    },
    // Ni primary ni success pueden ser el mismo verde: un chip "Terminada" se confundía con un botón.
    success: { main: '#16A34A', dark: '#15803D' },
    warning: { main: '#D97706', dark: '#B45309' },
    error: { main: '#DC2626' },
    info: { main: '#0284C7', dark: '#0369A1' },
    background: {
        default: '#F8FAFC',
        paper: '#FFFFFF',
        marco: '#EDF1F5',
    },
    text: {
        primary: '#0F172A',
        secondary: '#475569',
        disabled: '#94A3B8',
    },
    divider: 'rgba(15, 23, 42, 0.08)',
    action: {
        hover: 'rgba(15, 23, 42, 0.04)',
        selected: 'rgba(7, 94, 84, 0.10)',
    },
    ia: { main: '#7C3AED' },
    whatsapp: {
        fondo: '#EEF2EF',
        entrante: '#FFFFFF',
        saliente: '#DCF3E6',
        leido: '#0EA5E9',
    },
};

export const darkPalette = {
    primary: {
        main: '#25D366',
        light: '#4ADE80',
        dark: '#16A34A',
        contrastText: '#04210F',
    },
    secondary: {
        main: '#A78BFA',
    },
    success: { main: '#22C55E', dark: '#4ADE80' },
    warning: { main: '#F59E0B', dark: '#FBBF24' },
    error: { main: '#F87171' },
    info: { main: '#38BDF8', dark: '#7DD3FC' },
    background: {
        default: '#0B1020',
        paper: '#111827',
        marco: '#070B14',
    },
    text: {
        primary: '#F1F5F9',
        secondary: '#94A3B8',
        disabled: '#64748B',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    action: {
        hover: 'rgba(255, 255, 255, 0.06)',
        selected: 'rgba(37, 211, 102, 0.14)',
    },
    ia: { main: '#A78BFA' },
    whatsapp: {
        fondo: '#0B1020',
        entrante: '#1A2332',
        saliente: '#103D2C',
        leido: '#38BDF8',
    },
};

/** @param {'light'|'dark'} mode */
export function getPalette(mode) {
    return mode === 'light' ? lightPalette : darkPalette;
}
