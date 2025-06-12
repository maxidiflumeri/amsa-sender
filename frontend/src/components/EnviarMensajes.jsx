import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Typography,
    Box,
    Alert,
    IconButton,
    Tooltip,
    TextField,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    CircularProgress,
    Autocomplete
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import api from '../api/axios';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';

export default function EnviarMensajesModal({ open, onSendSuccess, onClose, campaña, mostrarCalendario = false }) {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [sesiones, setSesiones] = useState([]);
    const [selectedSesion, setSelectedSesion] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [loading, setLoading] = useState(false);
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
    const [config, setConfig] = useState({
        batchSize: 10,
        delayEntreMensajes: 3000,
        delayEntreLotes: 15000
    });
    const [fechaAgendada, setFechaAgendada] = useState(null);

    useEffect(() => {
        if (open) {
            setMensaje({ tipo: '', texto: '' });
            setSelectedSesion([]);
            setSelectedTemplateId('');
            setFechaAgendada(null);

            api.get('/sesiones/status')
                .then(res => setSesiones(res.data))
                .catch(err => console.error('Error al obtener sesiones:', err));

            api.get('/templates')
                .then(res => setTemplates(res.data))
                .catch(err => console.error('Error al obtener templates:', err));
        }
    }, [open]);

    const enviarMensajes = async () => {
        if (selectedSesion.length === 0) {
            setMensaje({ tipo: 'error', texto: 'Seleccioná al menos una sesión' });
            return;
        }

        if (!selectedTemplateId) {
            setMensaje({ tipo: 'error', texto: 'Seleccioná un template para continuar' });
            return;
        }

        if (mostrarCalendario && !fechaAgendada || dayjs(fechaAgendada).isBefore(dayjs())) {
            setMensaje({ tipo: 'error', texto: 'Seleccioná una fecha válida para el envío agendado' });
            return;
        }

        setLoading(true);
        setMensaje({ tipo: '', texto: '' });

        try {
            // Aplicar template si corresponde
            if (selectedTemplateId) {
                await api.post(`/campanias/${campaña.id}/aplicar-template`, {
                    templateId: selectedTemplateId
                });
            }

            if (fechaAgendada) {
                // Envío agendado
                await api.post(`/campanias/${campaña.id}/agendar`, {
                    sessionIds: selectedSesion,
                    fechaAgenda: fechaAgendada,
                    config
                });
            } else {
                // Envío inmediato
                await api.post('/mensajes/send-messages', {
                    sessionIds: selectedSesion,
                    campaña: campaña.id,
                    config
                });
            }

            onSendSuccess();
        } catch (error) {
            console.error('Error al iniciar el envío', error);
            setMensaje({ tipo: 'error', texto: 'Ocurrió un error al iniciar el envío' });
        } finally {
            setLoading(false);
        }
    };


    const handleChangeConfig = (field, value) => {
        setConfig(prev => ({ ...prev, [field]: Number(value) }));
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {`${mostrarCalendario ? 'Agendar campaña: ' : 'Enviar campaña: '} ${campaña?.nombre}`}
                <IconButton
                    aria-label="cerrar"
                    onClick={onClose}
                    sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Autocomplete
                    fullWidth
                    sx={{ mb: 2 }}
                    options={templates}
                    getOptionLabel={(option) => option.nombre}
                    value={templates.find((t) => t.id === selectedTemplateId) || null}
                    onChange={(event, newValue) => {
                        setSelectedTemplateId(newValue ? newValue.id : '');
                    }}
                    renderInput={(params) => (
                        <TextField {...params} label="Template" />
                    )}
                />
                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Sesiones</InputLabel>
                    <Select
                        multiple
                        value={selectedSesion}
                        onChange={(e) => setSelectedSesion(e.target.value)}
                        label="Sesiones"
                        renderValue={(selected) => selected.join(', ')}
                    >
                        {sesiones.map((s) => (
                            <MenuItem
                                key={s.id}
                                value={s.id}
                                disabled={s.estado !== 'conectado'}
                            >
                                <Box display="flex" justifyContent="space-between" width="100%">
                                    <span>{s.ani}</span>
                                    <span style={{ color: s.estado === 'conectado' ? 'green' : 'gray' }}>
                                        {s.estado}
                                    </span>
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {mostrarCalendario && (
                    <Box display="flex" justifyContent="center" sx={{ mt: 2, mb: 4 }}>
                        <DateTimePicker
                            label="Agendar envío"
                            value={fechaAgendada}
                            onChange={setFechaAgendada}
                            minDateTime={dayjs()}
                            renderInput={(params) => (
                                <TextField {...params} />
                            )}
                        />
                    </Box>
                )}

                <Accordion sx={{ mb: 2 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Configuración avanzada</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box display="flex" flexDirection="column" gap={2}>
                            <TextField
                                label={
                                    <Box display="flex" alignItems="center" gap={1}>
                                        Tamaño del lote
                                        <Tooltip title="Cantidad de contactos que se envían por sesión">
                                            <InfoOutlinedIcon fontSize="small" color="action" />
                                        </Tooltip>
                                    </Box>
                                }
                                type="number"
                                fullWidth
                                value={config.batchSize}
                                onChange={e => handleChangeConfig('batchSize', e.target.value)}
                            />

                            <TextField
                                label={
                                    <Box display="flex" alignItems="center" gap={1}>
                                        Delay entre mensajes (ms)
                                        <Tooltip title="Tiempo de espera entre cada mensaje enviado">
                                            <InfoOutlinedIcon fontSize="small" color="action" />
                                        </Tooltip>
                                    </Box>
                                }
                                type="number"
                                fullWidth
                                value={config.delayEntreMensajes}
                                onChange={e => handleChangeConfig('delayEntreMensajes', e.target.value)}
                            />

                            <TextField
                                label={
                                    <Box display="flex" alignItems="center" gap={1}>
                                        Delay entre lotes (ms)
                                        <Tooltip title="Pausa luego de completar los mensajes de una sesión">
                                            <InfoOutlinedIcon fontSize="small" color="action" />
                                        </Tooltip>
                                    </Box>
                                }
                                type="number"
                                fullWidth
                                value={config.delayEntreLotes}
                                onChange={e => handleChangeConfig('delayEntreLotes', e.target.value)}
                            />
                        </Box>
                    </AccordionDetails>
                </Accordion>

                {mensaje.texto && (
                    <Alert severity={mensaje.tipo} sx={{ mb: 2 }}>
                        {mensaje.texto}
                    </Alert>
                )}

                <Box textAlign="center" sx={{ mt: 2 }}>
                    <Button
                        sx={{
                            mb: 2,
                            backgroundColor: '#075E54',
                            fontFamily: commonFont,
                            textTransform: 'none'
                        }}
                        variant="contained"
                        onClick={enviarMensajes}
                        disabled={loading || selectedSesion.length === 0 || !selectedTemplateId}
                        startIcon={loading ? <CircularProgress size={20} /> : null}
                    >
                        {loading ? 'Iniciando...' : mostrarCalendario ? 'Agendar campaña' : 'Iniciar envío'}
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
}