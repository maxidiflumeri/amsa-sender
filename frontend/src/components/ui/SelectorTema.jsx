import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useColorMode } from '../../context/ColorModeContext';

const OPCIONES = [
    { valor: 'light', etiqueta: 'Claro', Icono: Sun },
    { valor: 'dark', etiqueta: 'Oscuro', Icono: Moon },
    { valor: 'system', etiqueta: 'Sistema', Icono: Monitor },
];

/** Claro / Oscuro / Sistema, como control segmentado. Lo usan el menú de la cuenta y Mi perfil. */
export default function SelectorTema({ fullWidth = true }) {
    const { preferencia, setPreferencia } = useColorMode();
    return (
        <ToggleButtonGroup
            exclusive
            fullWidth={fullWidth}
            value={preferencia}
            onChange={(_, v) => v && setPreferencia(v)}
            aria-label="Tema"
            size="small"
            sx={{
                p: '3px',
                gap: '2px',
                borderRadius: '10px',
                bgcolor: 'action.hover',
                '& .MuiToggleButton-root': {
                    border: 0,
                    borderRadius: '8px !important',
                    minHeight: { xs: 44, md: 34 },
                    gap: 0.75,
                    textTransform: 'none',
                    fontWeight: 500,
                    color: 'text.secondary',
                    '&.Mui-selected': {
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        fontWeight: 600,
                        boxShadow: 1,
                        '&:hover': { bgcolor: 'background.paper' },
                    },
                },
            }}
        >
            {OPCIONES.map(({ valor, etiqueta, Icono }) => (
                <ToggleButton key={valor} value={valor}>
                    <Icono size={15} strokeWidth={1.75} aria-hidden />
                    {etiqueta}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
