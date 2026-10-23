import { useEffect } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MigasDePan from './MigasDePan';

/**
 * El encabezado de toda pantalla, igual que en AMSA Gestión: migas de pan, título (h1), subtítulo y acciones.
 * Las acciones van a la derecha desde `sm` y debajo del título en el celular. Pone el título de la pestaña.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {React.ReactNode} [props.subtitle]
 * @param {{label: string, to?: string}[]} [props.breadcrumbs]
 * @param {React.ReactNode} [props.actions] Botones (el principal, `variant="contained"`, al final).
 * @param {string|number} [props.back] Ruta (o -1) del botón "Volver" a la izquierda del título.
 * @param {string} [props.backLabel]
 */
export default function PageHeader({ title, subtitle, breadcrumbs, actions, back, backLabel = 'Volver' }) {
    const navigate = useNavigate();

    useEffect(() => {
        document.title = `${title} — AMSA Sender`;
    }, [title]);

    return (
        <Box component="header" sx={{ mb: { xs: 2, sm: 3 } }}>
            <MigasDePan items={breadcrumbs ?? []} />
            <Box
                sx={{
                    display: 'flex',
                    alignItems: { sm: 'flex-end' },
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1.5, sm: 2 },
                    justifyContent: 'space-between',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
                    {back !== undefined && (
                        <Tooltip title={backLabel}>
                            <IconButton aria-label={backLabel} onClick={() => navigate(back)} sx={{ ml: -1, mt: { xs: -0.25, sm: 0 }, width: 44, height: 44, flex: 'none' }}>
                                <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            component="h1"
                            sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, overflowWrap: 'anywhere' }}
                        >
                            {title}
                        </Typography>
                        {subtitle && (
                            <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                </Box>

                {actions && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flexShrink: 0, '& .MuiButton-root': { minHeight: { xs: 44, sm: 36 } } }}>
                        {actions}
                    </Box>
                )}
            </Box>
        </Box>
    );
}
