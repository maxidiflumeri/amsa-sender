import { Box, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '../context/AuthContext';

export default function RutaProtegida({ permiso, children }) {
    const { hasPermiso } = useAuth();

    if (permiso && !hasPermiso(permiso)) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '70vh',
                    gap: 2,
                    opacity: 0.6,
                }}
            >
                <LockOutlinedIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                <Typography variant="h5" color="text.secondary" fontWeight={600}>
                    Acceso denegado
                </Typography>
                <Typography variant="body2" color="text.disabled">
                    No tenés permiso para ver esta sección.
                </Typography>
            </Box>
        );
    }

    return children;
}
