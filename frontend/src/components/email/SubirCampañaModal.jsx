import React, { useState } from 'react';
import {
    Box,
    Button,
    TextField,
    Typography,
    CircularProgress
} from '@mui/material';
import api from '../../api/axios';

export default function SubirCampaniaEmail({ onUploadSuccess }) {
    const [nombre, setNombre] = useState('');
    const [archivo, setArchivo] = useState(null);
    const [subiendo, setSubiendo] = useState(false);
    const [error, setError] = useState('');

    const handleArchivo = (e) => {
        setArchivo(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!nombre || !archivo) {
            setError('Debe completar el nombre y subir un archivo CSV');
            return;
        }

        try {
            const user = JSON.parse(localStorage.getItem('usuario'));
            const formData = new FormData();
            formData.append('file', archivo);
            formData.append('nombre', nombre);
            formData.append('userId', user.id);
            setSubiendo(true);
            setError(null);
            await api.post('/email/campanias', formData);
            onUploadSuccess();
        } catch (err) {
            console.error('Error al subir campaña:', err);
            setError('Hubo un error al procesar el CSV o al subir la campaña.');
        } finally {
            setSubiendo(false);
        }
    };

    return (
        <Box display="flex" flexDirection="column" gap={2}>
            <TextField
                label="Nombre de la campaña"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                fullWidth
            />
            <Button
                variant="outlined"
                component="label"
            >
                Seleccionar archivo CSV
                <input
                    type="file"
                    accept=".csv"
                    hidden
                    onChange={handleArchivo}
                />
            </Button>
            {archivo && <Typography variant="body2">Archivo seleccionado: {archivo.name}</Typography>}

            {error && <Typography color="error">{error}</Typography>}

            <Box textAlign="center">
                <Button
                    variant="contained"
                    onClick={handleUpload}
                    disabled={subiendo}
                    sx={{ backgroundColor: '#075E54', '&:hover': { backgroundColor: '#0b7b65' } }}
                >
                    {subiendo ? <CircularProgress size={24} /> : 'Crear campaña'}
                </Button>
            </Box>
        </Box>
    );
}