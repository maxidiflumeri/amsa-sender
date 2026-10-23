import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Checkbox, Chip, ListItemText, MenuItem, TextField, Typography } from '@mui/material';
import api from '../../../api/axios';
import { useEventoSocket } from '../../../context/SocketContext';
import { BloqueEstado, ResponsiveDialog, StatusChip } from '../../ui';

// Reanudar una campaña de WhatsApp Web cuando la línea con la que salió ya no está conectada. Una línea que se vuelve
// a conectar queda con otro id de sesión y la campaña no la encuentra sola: acá se elige con cuál seguir.

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {any} props.campania
 * @param {(sessionIds: string[]) => Promise<void>} props.onReanudar
 */
export default function DialogoElegirSesiones({ open, onClose, campania, onReanudar }) {
    const [sesiones, setSesiones] = useState([]);
    const [seleccionadas, setSeleccionadas] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [errorCarga, setErrorCarga] = useState(false);
    const [reintento, setReintento] = useState(0);
    const [enviando, setEnviando] = useState(false);

    const cargarSesiones = useCallback(async () => {
        const res = await api.get('/whatsapp/sesiones/status');
        setSesiones(res.data);
        // Una sesión que se cayó deja de estar elegida.
        setSeleccionadas((actual) => actual.filter((id) => res.data.some((s) => s.id === id && s.estado === 'conectado')));
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        setSeleccionadas([]);
        let cancelado = false;
        setCargando(true);
        setErrorCarga(false);
        cargarSesiones()
            .catch(() => !cancelado && setErrorCarga(true))
            .finally(() => !cancelado && setCargando(false));
        return () => {
            cancelado = true;
        };
    }, [open, reintento, cargarSesiones]);

    // Si una sesión se conecta o se cae con el diálogo abierto, la lista se actualiza.
    useEventoSocket('estado_sesion', ({ estado }) => {
        if (open && estado !== 'qr') cargarSesiones().catch(() => undefined);
    });

    const conectadas = sesiones.filter((s) => s.estado === 'conectado');

    const reanudar = async () => {
        setEnviando(true);
        try {
            await onReanudar(seleccionadas);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <ResponsiveDialog
            open={open}
            onClose={() => !enviando && onClose()}
            title={`Reanudar «${campania?.nombre ?? ''}»`}
            maxWidth="sm"
            actions={(
                <>
                    <Button onClick={onClose} disabled={enviando}>Cancelar</Button>
                    <Button variant="contained" disabled={seleccionadas.length === 0 || enviando} onClick={reanudar}>Reanudar</Button>
                </>
            )}
        >
            <Typography color="text.secondary" sx={{ mb: 2 }}>
                La línea con la que salió esta campaña ya no está conectada. Elegí con cuál seguir: se envían solo los mensajes que faltan.
            </Typography>

            {cargando && <BloqueEstado estado="cargando" mensaje="Cargando sesiones…" />}
            {errorCarga && <BloqueEstado estado="error" mensaje="No se pudieron cargar las sesiones." onReintentar={() => setReintento((n) => n + 1)} />}

            {!cargando && !errorCarga && (
                <TextField
                    select
                    fullWidth
                    label="Sesiones"
                    value={seleccionadas}
                    onChange={(e) => setSeleccionadas(e.target.value)}
                    error={conectadas.length === 0}
                    helperText={conectadas.length === 0
                        ? 'No hay ninguna sesión conectada. Conectá una desde Envíos › WhatsApp Web › Sesiones.'
                        : 'Los mensajes que faltan se reparten entre las sesiones que elijas.'}
                    slotProps={{
                        select: {
                            multiple: true,
                            renderValue: (ids) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {ids.map((id) => <Chip key={id} size="small" label={sesiones.find((s) => s.id === id)?.ani || id} />)}
                                </Box>
                            ),
                        },
                    }}
                >
                    {sesiones.map((s) => (
                        <MenuItem key={s.id} value={s.id} disabled={s.estado !== 'conectado'} sx={{ minHeight: 44, gap: 1 }}>
                            <Checkbox checked={seleccionadas.includes(s.id)} tabIndex={-1} disableRipple sx={{ p: 0.5 }} />
                            <ListItemText primary={s.ani || 'Sin número todavía'} />
                            <StatusChip label={s.estado === 'conectado' ? 'Conectada' : 'No disponible'} tono={s.estado === 'conectado' ? 'ok' : 'neutro'} />
                        </MenuItem>
                    ))}
                </TextField>
            )}
        </ResponsiveDialog>
    );
}
