import { Box, Chip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

/**
 * Un chip de estado con los colores de la familia. `tono`: 'ok' | 'aviso' | 'error' | 'info' | 'acento' | 'ia' |
 * 'neutro'. `vivo` agrega un punto (para "Enviando", "Conectada").
 */
export default function StatusChip({ label, tono = 'neutro', vivo = false, size = 'small', sx, ...props }) {
    const theme = useTheme();
    const oscuro = theme.palette.mode === 'dark';
    const colores = {
        ok: theme.palette.success,
        aviso: theme.palette.warning,
        error: theme.palette.error,
        info: theme.palette.info,
        acento: theme.palette.primary,
        ia: theme.palette.ia ?? theme.palette.secondary,
    };
    const c = colores[tono];
    const texto = c ? (oscuro ? c.light ?? c.main : c.dark ?? c.main) : theme.palette.text.secondary;
    const fondo = c ? alpha(c.main, oscuro ? 0.16 : 0.12) : theme.palette.action.hover;

    return (
        <Chip
            size={size}
            label={
                vivo ? (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        <Box component="span" aria-hidden sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: texto, flex: 'none' }} />
                        {label}
                    </Box>
                ) : label
            }
            sx={{ height: 24, fontWeight: 600, color: texto, bgcolor: fondo, '& .MuiChip-label': { px: 1 }, ...sx }}
            {...props}
        />
    );
}
