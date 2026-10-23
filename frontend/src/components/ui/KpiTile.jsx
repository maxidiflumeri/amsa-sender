import { Box, ButtonBase, Paper, Skeleton, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

/**
 * Un indicador, como los de "Tu día" en AMSA Gestión: título, valor grande con números tabulares, unidad y leyenda.
 * Con `to` es un enlace (toda la tarjeta).
 *
 * @param {object} props
 * @param {string} props.titulo
 * @param {React.ReactNode} props.valor
 * @param {string} [props.unidad]
 * @param {React.ReactNode} [props.leyenda]
 * @param {'normal'|'error'|'aviso'} [props.tonoLeyenda]
 * @param {string} [props.to]
 * @param {boolean} [props.cargando]
 */
export default function KpiTile({ titulo, valor, unidad, leyenda, tonoLeyenda = 'normal', to, cargando = false }) {
    const colorLeyenda = tonoLeyenda === 'error' ? 'error.main' : tonoLeyenda === 'aviso' ? 'warning.dark' : 'text.secondary';
    const contenido = (
        <Box sx={{ p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 0.25, width: '100%', textAlign: 'left' }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ fontSize: { xs: 12.5, sm: 13.5 } }}>
                {titulo}
            </Typography>
            {cargando ? (
                <Skeleton width="50%" height={36} />
            ) : (
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
                    <Typography component="span" sx={{ fontSize: { xs: 26, sm: 28 }, fontWeight: 700, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
                        {valor}
                    </Typography>
                    {unidad && (
                        <Typography component="span" variant="body2" color="text.secondary" noWrap>
                            {unidad}
                        </Typography>
                    )}
                </Box>
            )}
            {leyenda && !cargando && (
                <Typography variant="caption" sx={{ color: colorLeyenda, fontWeight: tonoLeyenda === 'normal' ? 400 : 600 }}>
                    {leyenda}
                </Typography>
            )}
        </Box>
    );

    return (
        <Paper variant="outlined" sx={{ borderRadius: '14px', minWidth: 0, display: 'flex', overflow: 'hidden' }}>
            {to ? (
                <ButtonBase component={RouterLink} to={to} sx={{ flex: 1, alignItems: 'stretch', '&:hover': { bgcolor: 'action.hover' } }}>
                    {contenido}
                </ButtonBase>
            ) : (
                contenido
            )}
        </Paper>
    );
}
