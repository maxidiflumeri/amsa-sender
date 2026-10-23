import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { FileUp, Info } from 'lucide-react';
import { ResponsiveDialog } from '../../ui';

// El diálogo "Nueva campaña" de Email y de WhatsApp Web: nombre, archivo CSV y la ayuda de qué columnas espera. Cada
// canal pone su ayuda y su pedido; el diálogo se ocupa del resto.

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(nombre: string, archivo: File) => Promise<void>} props.onSubir Tira si falla; el que llama muestra el error.
 * @param {React.ReactNode} props.ayuda El formato que espera el CSV.
 */
export default function SubirCsvDialog({ open, onClose, onSubir, ayuda }) {
    const [nombre, setNombre] = useState('');
    const [archivo, setArchivo] = useState(null);
    const [subiendo, setSubiendo] = useState(false);
    const [intento, setIntento] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setNombre('');
            setArchivo(null);
            setIntento(false);
        }
    }, [open]);

    const falta = !nombre.trim() || !archivo;

    const subir = async () => {
        setIntento(true);
        if (falta) return;
        setSubiendo(true);
        try {
            await onSubir(nombre.trim(), archivo);
        } catch {
            // El error ya se avisó en `onSubir`; el diálogo queda abierto para reintentar sin volver a cargar todo.
        } finally {
            setSubiendo(false);
        }
    };

    return (
        <ResponsiveDialog
            open={open}
            onClose={() => !subiendo && onClose()}
            title="Nueva campaña"
            sucio={!subiendo && (!!nombre || !!archivo)}
            actions={(
                <>
                    <Button onClick={onClose} disabled={subiendo}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={subir}
                        disabled={subiendo}
                        startIcon={subiendo ? <CircularProgress size={16} color="inherit" /> : undefined}
                    >
                        {subiendo ? 'Subiendo…' : 'Crear campaña'}
                    </Button>
                </>
            )}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                    label="Nombre de la campaña"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    fullWidth
                    autoFocus
                    required
                    error={intento && !nombre.trim()}
                    helperText={intento && !nombre.trim() ? 'Poné un nombre para encontrarla después.' : undefined}
                />

                <Alert severity="info" icon={<Info size={20} strokeWidth={1.75} aria-hidden />} variant="outlined" sx={{ '& .MuiAlert-message': { minWidth: 0, overflowWrap: 'anywhere' } }}>
                    {ayuda}
                </Alert>

                <Box>
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
                        hidden
                        onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                    />
                    <Button
                        variant="outlined"
                        fullWidth
                        startIcon={<FileUp size={18} strokeWidth={1.75} aria-hidden />}
                        onClick={() => inputRef.current?.click()}
                        sx={{ minHeight: 44 }}
                    >
                        {archivo ? 'Elegir otro archivo' : 'Elegir archivo CSV'}
                    </Button>
                    <Typography
                        variant="body2"
                        color={intento && !archivo ? 'error' : 'text.secondary'}
                        sx={{ mt: 0.75, overflowWrap: 'anywhere' }}
                        role={intento && !archivo ? 'alert' : undefined}
                    >
                        {archivo ? `Archivo elegido: ${archivo.name}` : intento ? 'Elegí el archivo CSV con los contactos.' : 'Todavía no elegiste ningún archivo.'}
                    </Typography>
                </Box>
            </Box>
        </ResponsiveDialog>
    );
}
