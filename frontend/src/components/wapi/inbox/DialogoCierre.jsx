import { useEffect, useState } from 'react';
import { Button, CircularProgress, TextField, Typography } from '@mui/material';
import { ResponsiveDialog } from '../../ui';

// Resolver una conversación. La nota es opcional, pero conviene: queda en el historial de cierres y se ve en el chat.
// Dos botones: "Resolver" (con la nota escrita) y, como texto, "Resolver sin nota". El tercero, cancelar, es la X.

const MAX = 500;

export default function DialogoCierre({ open, onClose, resolviendo, onResolver, nombre }) {
    const [nota, setNota] = useState('');

    useEffect(() => {
        if (open) setNota('');
    }, [open]);

    return (
        <ResponsiveDialog
            open={open}
            onClose={() => !resolviendo && onClose()}
            title="Resolver la conversación"
            maxWidth="xs"
            sucio={nota.trim().length > 0 && !resolviendo}
            actions={
                <>
                    <Button color="inherit" onClick={() => onResolver('')} disabled={resolviendo}>Resolver sin nota</Button>
                    <Button
                        variant="contained"
                        onClick={() => onResolver(nota.trim())}
                        disabled={resolviendo || !nota.trim()}
                        startIcon={resolviendo ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        Resolver
                    </Button>
                </>
            }
        >
            <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 2 }}>
                Podés dejar una nota con el motivo del cierre{nombre ? ` de ${nombre}` : ''}. Queda en el historial de la conversación.
            </Typography>
            <TextField
                autoFocus
                multiline
                minRows={3}
                maxRows={8}
                fullWidth
                label="Nota de cierre"
                placeholder='Ej: "Contactado por teléfono", "Resuelto por email"'
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                inputProps={{ maxLength: MAX }}
                helperText={`${nota.length}/${MAX}`}
            />
        </ResponsiveDialog>
    );
}
