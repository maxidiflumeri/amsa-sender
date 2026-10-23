import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { Sparkles } from 'lucide-react';
import api from '../../../api/axios';
import { mensajeDeError, useFeedback } from '../../../context/FeedbackContext';
import { BloqueEstado, ResponsiveDialog } from '../../ui';

// El resumen de la conversación con IA. En violeta (`ia.main`) y con borde, sin degradados ni brillos. Pide el resumen
// al abrir; si falla, lo dice en el diálogo (con "Reintentar") y también como aviso.

export default function DialogoResumen({ open, onClose, convId, onEstado }) {
    const feedback = useFeedback();
    const [cargando, setCargando] = useState(false);
    const [texto, setTexto] = useState('');
    const [error, setError] = useState('');
    const pedido = useRef(0);

    const generar = useCallback(async () => {
        const mio = ++pedido.current;
        setCargando(true);
        setError('');
        setTexto('');
        onEstado?.(true);
        try {
            const { data } = await api.post(`/wapi/inbox/${convId}/ai/resumen`);
            if (mio === pedido.current) setTexto(data.resumen ?? '');
        } catch (e) {
            if (mio !== pedido.current) return;
            const msg = e?.response?.status === 429
                ? 'La IA está saturada en este momento. Probá de nuevo en unos segundos.'
                : mensajeDeError(e, 'No se pudo generar el resumen. Revisá la conexión y probá de nuevo.');
            setError(msg);
            feedback.error(msg);
        } finally {
            if (mio === pedido.current) {
                setCargando(false);
                onEstado?.(false);
            }
        }
    }, [convId, feedback, onEstado]);

    useEffect(() => {
        if (open && convId) generar();
        // Cerrar o cambiar de conversación descarta lo que todavía venga en camino.
        return () => { pedido.current += 1; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, convId]);

    return (
        <ResponsiveDialog
            open={open}
            onClose={onClose}
            cerrarConFondo
            maxWidth="sm"
            title={
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: 'ia.main' }}>
                    <Sparkles size={20} strokeWidth={1.75} aria-hidden />
                    Resumen con IA
                </Box>
            }
            actions={<Button onClick={onClose} color="inherit">Cerrar</Button>}
        >
            {cargando ? (
                <Box role="status" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 5, color: 'ia.main' }}>
                    <CircularProgress size={20} color="inherit" />
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'inherit' }}>Analizando la conversación…</Typography>
                </Box>
            ) : error ? (
                <BloqueEstado estado="error" mensaje={error} onReintentar={generar} />
            ) : (
                <Box sx={{ border: 1, borderColor: 'ia.main', borderRadius: '12px', p: 2 }}>
                    <Typography sx={{ fontSize: 14.5, whiteSpace: 'pre-line', lineHeight: 1.7, overflowWrap: 'anywhere' }}>{texto || 'No hay nada para resumir todavía.'}</Typography>
                </Box>
            )}
        </ResponsiveDialog>
    );
}
