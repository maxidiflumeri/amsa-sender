import { useCallback, useEffect, useState } from 'react';
import { Autocomplete, Button, CircularProgress, TextField } from '@mui/material';
import api from '../../../api/axios';
import { mensajeDeError, useFeedback } from '../../../context/FeedbackContext';
import { BloqueEstado, ResponsiveDialog } from '../../ui';

// Asignar la conversación a un asesor (solo admin). La lista de usuarios se pide al abrir; si falla, se ve el error
// con "Reintentar" en el mismo diálogo (antes la excepción se perdía y el botón no hacía nada).

export default function DialogoAsignar({ open, onClose, asignando, onAsignar }) {
    const feedback = useFeedback();
    const [usuarios, setUsuarios] = useState(null);
    const [error, setError] = useState(false);
    const [elegido, setElegido] = useState(null);

    const cargar = useCallback(async () => {
        setError(false);
        try {
            const { data } = await api.get('/usuarios');
            setUsuarios(data);
        } catch (e) {
            setError(true);
            feedback.error(mensajeDeError(e, 'No se pudo cargar la lista de asesores.'));
        }
    }, [feedback]);

    useEffect(() => {
        if (!open) return;
        setElegido(null);
        if (!usuarios) cargar();
    }, [open, usuarios, cargar]);

    return (
        <ResponsiveDialog
            open={open}
            onClose={() => !asignando && onClose()}
            title="Asignar la conversación"
            maxWidth="xs"
            actions={
                <Button
                    variant="contained"
                    onClick={() => onAsignar(elegido.id)}
                    disabled={!elegido || asignando}
                    startIcon={asignando ? <CircularProgress size={16} color="inherit" /> : null}
                >
                    Asignar
                </Button>
            }
        >
            {error ? (
                <BloqueEstado estado="error" mensaje="No se pudo cargar la lista de asesores." onReintentar={cargar} />
            ) : !usuarios ? (
                <BloqueEstado estado="cargando" mensaje="Cargando asesores…" />
            ) : (
                <Autocomplete
                    options={usuarios}
                    getOptionLabel={(u) => `${u.nombre} (${u.email})`}
                    value={elegido}
                    onChange={(_, u) => setElegido(u)}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    renderInput={(params) => <TextField {...params} label="Asesor" placeholder="Buscar por nombre o email" autoFocus />}
                    noOptionsText="Sin resultados"
                />
            )}
        </ResponsiveDialog>
    );
}
