import { Component } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { RefreshCw } from 'lucide-react';

/** Un error de carga de una pantalla (el chunk ya no existe porque se publicó otra versión). */
function esErrorDeVersion(error) {
    const m = String(error?.message ?? '');
    return /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch dynamically/i.test(m);
}

/**
 * La última red: si algo revienta al dibujar, en vez de la pantalla en blanco se ve un aviso con "Recargar". El caso
 * típico es una pestaña que quedó con la versión anterior y pide una pantalla cuyo archivo ya no está publicado.
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        const version = esErrorDeVersion(error);
        return (
            <Box role="alert" sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, bgcolor: 'background.default' }}>
                <Box sx={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                    <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700 }}>
                        {version ? 'Hay una versión nueva de Sender' : 'Algo salió mal'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {version
                            ? 'Esta pestaña quedó con la versión anterior. Recargá para seguir.'
                            : 'La pantalla no se pudo mostrar. Recargá; si vuelve a pasar, avisale a quien administra Sender.'}
                    </Typography>
                    <Button variant="contained" startIcon={<RefreshCw size={16} aria-hidden />} onClick={() => window.location.reload()} sx={{ mt: 1, minHeight: 44 }}>
                        Recargar
                    </Button>
                </Box>
            </Box>
        );
    }
}
