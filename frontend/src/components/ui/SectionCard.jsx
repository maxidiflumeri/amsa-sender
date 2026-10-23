import { Box, Paper, Typography } from '@mui/material';

/**
 * La tarjeta de la familia: blanca (o `background.paper`), borde fino, 14 px de radio. Con título opcional a la
 * izquierda y una acción a la derecha.
 * @param {object} props
 * @param {React.ReactNode} [props.title]
 * @param {React.ReactNode} [props.subtitle]
 * @param {React.ReactNode} [props.action]
 * @param {boolean} [props.noPadding] Para tablas y listas que van de borde a borde.
 */
export default function SectionCard({ title, subtitle, action, noPadding = false, children, sx, ...props }) {
    return (
        <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden', minWidth: 0, ...sx }} {...props}>
            {(title || action) && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, px: { xs: 2, sm: 2.5 }, pt: 2, pb: noPadding ? 1.5 : 0 }}>
                    <Box sx={{ minWidth: 0 }}>
                        {title && (
                            <Typography component="h2" sx={{ fontSize: 15, fontWeight: 650, lineHeight: 1.35 }}>
                                {title}
                            </Typography>
                        )}
                        {subtitle && (
                            <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                    {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
                </Box>
            )}
            <Box sx={noPadding ? undefined : { px: { xs: 2, sm: 2.5 }, py: 2 }}>{children}</Box>
        </Paper>
    );
}
