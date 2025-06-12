import React, { useState, useRef } from 'react';
import {
    TextField,
    Button,
    Paper,
    Typography,
    CircularProgress,
    Box,
    Stack
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import api from '../api/axios';

export default function SubirCampaña({ onUploadSuccess, setMensaje }) {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [archivo, setArchivo] = useState(null);
    const [nombreCampaña, setNombreCampaña] = useState('');
    const [subiendo, setSubiendo] = useState(false);
    const inputFileRef = useRef(null);

    const handleUpload = async () => {
        if (!archivo || !nombreCampaña) {
            setMensaje({ tipo: 'error', texto: 'Completa todos los campos' });
            return;
        }

        const formData = new FormData();
        formData.append('file', archivo);
        formData.append('campaña', nombreCampaña);

        setSubiendo(true);
        try {
            await api.post('/upload-csv', formData);
            setArchivo(null);
            setNombreCampaña('');
            inputFileRef.current.value = null;
            onUploadSuccess();
        } catch (error) {
            console.error('Error subiendo campaña:', error);
            setMensaje({ tipo: 'error', texto: 'Ocurrió un error al subir la campaña' });
        } finally {
            setSubiendo(false);
        }
    };

    const handleArchivoClick = () => {
        inputFileRef.current?.click();
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Subir nueva campaña</Typography>

            <Stack spacing={2}>
                <TextField
                    fullWidth
                    label="Nombre de campaña"
                    value={nombreCampaña}
                    onChange={(e) => setNombreCampaña(e.target.value)}
                />

                <input
                    type="file"
                    accept=".csv"
                    ref={inputFileRef}
                    style={{ display: 'none' }}
                    onChange={(e) => setArchivo(e.target.files[0])}
                />

                <Button
                    variant="outlined"
                    startIcon={<UploadFileIcon />}
                    onClick={handleArchivoClick}
                >
                    {archivo ? archivo.name : 'Seleccionar archivo CSV'}
                </Button>

                <Box textAlign="center">
                    <Button
                        variant="contained"
                        disabled={subiendo || !nombreCampaña || !archivo}
                        onClick={handleUpload}
                        startIcon={subiendo ? <CircularProgress size={20} /> : null}
                        sx={{
                            borderRadius: 2,
                            fontFamily: commonFont,
                            textTransform: 'none',
                            fontSize: '0.9rem',
                            backgroundColor: '#075E54',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                backgroundColor: '#0b7b65',
                                transform: 'scale(1.03)',
                                boxShadow: 4,
                            },
                        }}
                    >
                        {subiendo ? 'Subiendo...' : 'Subir'}
                    </Button>
                </Box>
            </Stack>
        </Paper>
    );
}