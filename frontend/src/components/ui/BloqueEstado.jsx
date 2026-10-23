import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';

/**
 * Cargando o error dentro de una pantalla o una tarjeta. El error siempre se ve y siempre tiene Reintentar: nada de
 * errores que solo van a la consola, ni de "No hay datos" cuando en realidad falló el pedido.
 *
 * @param {object} props
 * @param {'cargando'|'error'} props.estado
 * @param {string} [props.mensaje]
 * @param {() => void} [props.onReintentar]
 */
export default function BloqueEstado({ estado, mensaje, onReintentar }) {
    if (estado === 'cargando') {
        return (
            <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 6, color: 'text.secondary' }}>
                <CircularProgress size={20} />
                <Typography variant="body2">{mensaje ?? 'Cargando…'}</Typography>
            </Box>
        );
    }
    return (
        <Alert
            severity="error"
            variant="outlined"
            action={onReintentar ? <Button color="inherit" size="small" onClick={onReintentar} sx={{ minHeight: 36 }}>Reintentar</Button> : undefined}
            sx={{ my: 1 }}
        >
            {mensaje ?? 'No se pudo cargar.'}
        </Alert>
    );
}
