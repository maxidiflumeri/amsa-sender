import { useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { X } from 'lucide-react';

/**
 * El diálogo de Sender: pantalla completa debajo de `sm`, con el título y la X arriba y las acciones fijas abajo
 * (respetando la zona segura del celular). No se cierra con un toque afuera: un formulario a medio cargar no se pierde
 * por accidente. Con `sucio`, cerrar pregunta antes de descartar.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.actions] Los botones de abajo. El principal al final.
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [props.maxWidth]
 * @param {boolean} [props.sucio] Hay cambios sin guardar.
 * @param {boolean} [props.cerrarConFondo] Permite cerrar con un toque afuera (para diálogos de solo lectura).
 * @param {boolean} [props.fullScreenSiempre]
 */
export default function ResponsiveDialog({
    open,
    onClose,
    title,
    actions,
    children,
    maxWidth = 'sm',
    sucio = false,
    cerrarConFondo = false,
    fullScreenSiempre = false,
    contentSx,
    ...props
}) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm')) || fullScreenSiempre;
    const [preguntando, setPreguntando] = useState(false);

    const intentarCerrar = (_, motivo) => {
        if (motivo === 'backdropClick' && !cerrarConFondo) return;
        if (sucio) {
            setPreguntando(true);
            return;
        }
        onClose();
    };

    return (
        <>
            <Dialog open={open} onClose={intentarCerrar} fullScreen={fullScreen} fullWidth maxWidth={maxWidth} scroll="paper" {...props}>
                <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1, py: 1.5 }}>
                    <Box component="h2" sx={{ m: 0, flex: 1, minWidth: 0, fontSize: '1.125rem', fontWeight: 650, lineHeight: 1.35 }}>{title}</Box>
                    <IconButton aria-label="Cerrar" onClick={() => intentarCerrar(null, 'boton')} sx={{ width: 44, height: 44, flex: 'none' }}>
                        <X size={20} strokeWidth={1.75} aria-hidden />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={contentSx}>{children}</DialogContent>
                {actions && (
                    <DialogActions
                        sx={{
                            px: { xs: 2, sm: 3 },
                            py: 1.5,
                            gap: 1,
                            flexWrap: 'wrap',
                            pb: fullScreen ? 'calc(12px + env(safe-area-inset-bottom))' : 1.5,
                            '& .MuiButton-root': { minHeight: { xs: 44, sm: 36 } },
                            '& > :not(style) ~ :not(style)': { ml: 0 },
                        }}
                    >
                        {actions}
                    </DialogActions>
                )}
            </Dialog>

            <Dialog open={preguntando} onClose={() => setPreguntando(false)} maxWidth="xs" fullWidth>
                <DialogTitle>¿Descartar los cambios?</DialogTitle>
                <DialogContent>
                    <DialogContentText>Lo que cargaste en este formulario se va a perder.</DialogContentText>
                </DialogContent>
                <DialogActions sx={{ '& .MuiButton-root': { minHeight: 44 } }}>
                    <Button onClick={() => setPreguntando(false)}>Seguir editando</Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={() => {
                            setPreguntando(false);
                            onClose();
                        }}
                    >
                        Descartar
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
