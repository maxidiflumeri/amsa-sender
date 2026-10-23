import { Box, Button, Typography } from '@mui/material';
import { Inbox } from 'lucide-react';

/**
 * Un estado vacío: ícono en un círculo, título, descripción y una acción opcional.
 * @param {object} props
 * @param {string} [props.title]
 * @param {React.ReactNode} [props.description]
 * @param {import('lucide-react').LucideIcon} [props.icon] Un ícono de Lucide (el componente, no el elemento).
 * @param {{label: string, onClick: () => void}} [props.action]
 * @param {boolean} [props.compact] Menos aire arriba y abajo (adentro de una tarjeta).
 */
export default function EmptyState({ title = 'No hay datos', description, icon: Icono = Inbox, action, compact = false }) {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: compact ? 4 : 8,
                px: 3,
                textAlign: 'center',
            }}
        >
            <Box
                sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                    color: 'text.secondary',
                }}
            >
                <Icono size={26} strokeWidth={1.75} aria-hidden />
            </Box>
            <Typography variant="h6" component="p" fontWeight={600} gutterBottom>
                {title}
            </Typography>
            {description && (
                <Typography variant="body2" color="text.secondary" component="div" sx={{ maxWidth: 420 }}>
                    {description}
                </Typography>
            )}
            {action && (
                <Button variant="contained" onClick={action.onClick} sx={{ mt: 3, minHeight: 44 }}>
                    {action.label}
                </Button>
            )}
        </Box>
    );
}
