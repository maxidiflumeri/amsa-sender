import { useEffect, useState } from 'react';
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';

/**
 * Una confirmación. Lo que corta un envío o borra datos va con `peligro` y, si es grave, con `textoATipear` (hay que
 * escribirlo para habilitar el botón). El mensaje tiene que decir qué y cuánto toca: "Se van a dejar de enviar 1.140
 * mensajes", no "¿Estás seguro?".
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {React.ReactNode} props.titulo
 * @param {React.ReactNode} [props.mensaje]
 * @param {string} [props.confirmarTexto]
 * @param {string} [props.cancelarTexto]
 * @param {boolean} [props.peligro]
 * @param {boolean} [props.cargando]
 * @param {string} [props.textoATipear]
 * @param {() => void} props.onConfirmar
 * @param {() => void} props.onCancelar
 */
export default function ConfirmDialog({
    open,
    titulo,
    mensaje,
    confirmarTexto = 'Confirmar',
    cancelarTexto = 'Cancelar',
    peligro = false,
    cargando = false,
    textoATipear,
    onConfirmar,
    onCancelar,
    children,
}) {
    const [tipeado, setTipeado] = useState('');
    useEffect(() => {
        if (!open) setTipeado('');
    }, [open]);
    const habilitado = !cargando && (!textoATipear || tipeado.trim().toLowerCase() === textoATipear.toLowerCase());

    return (
        <Dialog open={open} onClose={cargando ? undefined : onCancelar} maxWidth="xs" fullWidth>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {mensaje && <Typography variant="body2" color="text.secondary" component="div">{mensaje}</Typography>}
                {children}
                {textoATipear && (
                    <TextField
                        autoFocus
                        size="small"
                        label={`Escribí «${textoATipear}» para confirmar`}
                        value={tipeado}
                        onChange={(e) => setTipeado(e.target.value)}
                        inputProps={{ autoCapitalize: 'off', autoCorrect: 'off' }}
                    />
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1, '& .MuiButton-root': { minHeight: { xs: 44, sm: 36 } } }}>
                <Button onClick={onCancelar} disabled={cargando}>{cancelarTexto}</Button>
                <Button
                    variant="contained"
                    color={peligro ? 'error' : 'primary'}
                    onClick={onConfirmar}
                    disabled={!habilitado}
                    startIcon={cargando ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                    {confirmarTexto}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
