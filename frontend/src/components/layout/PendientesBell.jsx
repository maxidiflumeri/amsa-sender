import { useState } from 'react';
import { Badge, Box, Button, Divider, IconButton, Popover, Tooltip, Typography } from '@mui/material';
import { Bell, MessagesSquare } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

function Fila({ etiqueta, valor, tono }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, minHeight: 32 }}>
            <Typography variant="body2">{etiqueta}</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums', color: valor > 0 && tono ? tono : 'text.primary' }}>
                {valor}
            </Typography>
        </Box>
    );
}

/** La campanita: los pendientes de Conversaciones (sin leer, sin asignar, tus chats activos). */
export default function PendientesBell() {
    const { hasPermiso } = useAuth();
    const { unreadCount, unassignedCount, myActiveCount } = useNotifications();
    const [ancla, setAncla] = useState(null);
    if (!hasPermiso('wapi.inbox')) return null;
    const total = unreadCount + unassignedCount;
    const etiqueta = total > 0 ? `Pendientes: ${unreadCount} sin leer, ${unassignedCount} sin asignar` : 'Sin pendientes';

    return (
        <>
            <Tooltip title="Pendientes de Conversaciones">
                <IconButton aria-label={etiqueta} onClick={(e) => setAncla(e.currentTarget)} sx={{ color: 'text.secondary', width: { xs: 44, md: 40 }, height: { xs: 44, md: 40 } }}>
                    <Badge
                        badgeContent={total}
                        max={99}
                        color="error"
                        overlap="circular"
                        sx={{ '& .MuiBadge-badge': { fontSize: 10.5, fontWeight: 700, height: 18, minWidth: 18, boxShadow: (t) => `0 0 0 2px ${t.palette.background.marco}` } }}
                    >
                        <Bell size={20} strokeWidth={1.75} aria-hidden />
                    </Badge>
                </IconButton>
            </Tooltip>
            <Popover
                open={!!ancla}
                anchorEl={ancla}
                onClose={() => setAncla(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{ paper: { role: 'dialog', 'aria-label': 'Pendientes', sx: { p: 2, width: 'min(300px, calc(100vw - 24px))', borderRadius: '14px', mt: 0.5 } } }}
            >
                <Typography component="h2" sx={{ fontSize: 15, fontWeight: 650, mb: 1 }}>Pendientes</Typography>
                <Fila etiqueta="Tus chats con mensajes sin leer" valor={unreadCount} tono="error.main" />
                <Fila etiqueta="Sin asignar, para tomar" valor={unassignedCount} tono="warning.dark" />
                <Fila etiqueta="Tus chats activos" valor={myActiveCount} />
                <Divider sx={{ my: 1.5 }} />
                <Button
                    component={RouterLink}
                    to="/wapi/inbox"
                    fullWidth
                    variant="contained"
                    onClick={() => setAncla(null)}
                    startIcon={<MessagesSquare size={18} strokeWidth={1.75} aria-hidden />}
                    sx={{ minHeight: 44 }}
                >
                    Ir a Conversaciones
                </Button>
            </Popover>
        </>
    );
}
