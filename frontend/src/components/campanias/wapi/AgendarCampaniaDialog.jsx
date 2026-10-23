import { useEffect, useState } from 'react';
import { Button, CircularProgress, Typography } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import api from '../../../api/axios';
import { mensajeDeError, useFeedback } from '../../../context/FeedbackContext';
import { ResponsiveDialog } from '../../ui';

/**
 * Agenda una campaña en borrador. El `LocalizationProvider` ya está en main.jsx.
 * `onAgendada` recibe la campaña para que la lista se refresque.
 */
export default function AgendarCampaniaDialog({ campania, onClose, onAgendada }) {
    const feedback = useFeedback();
    const [fecha, setFecha] = useState(null);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (campania) setFecha(null);
    }, [campania]);

    const agendar = async () => {
        if (!fecha || guardando) return;
        setGuardando(true);
        try {
            await api.post(`/wapi/campanias/${campania.id}/agendar`, { agendadoAt: fecha.toISOString() });
            feedback.exito(`Campaña agendada para el ${fecha.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}.`);
            onAgendada?.(campania);
            onClose();
        } catch (err) {
            feedback.error(mensajeDeError(err, 'No se pudo agendar la campaña.'));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ResponsiveDialog
            open={!!campania}
            onClose={guardando ? () => {} : onClose}
            title="Agendar campaña"
            maxWidth="xs"
            actions={(
                <>
                    <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={agendar}
                        disabled={!fecha || guardando}
                        startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : undefined}
                    >
                        Agendar
                    </Button>
                </>
            )}
        >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                «{campania?.nombre}» se envía sola a la hora que elijas, desde la línea con la que se creó.
            </Typography>
            <DateTimePicker
                label="Fecha y hora de envío"
                value={fecha}
                onChange={setFecha}
                disablePast
                slotProps={{ textField: { fullWidth: true } }}
            />
        </ResponsiveDialog>
    );
}
