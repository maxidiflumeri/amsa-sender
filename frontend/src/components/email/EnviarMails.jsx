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
import api from '../../api/axios';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';

export default function EnviarMailsModal({ open, onSendSuccess, onClose, campaña, mostrarCalendario = false }) {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [cuentasSmtp, setCuentasSmtp] = useState([]);
    const [selectedCuentaSmtp, setselectedCuentaSmtp] = useState([]);
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
            setselectedCuentaSmtp([]);
            setSelectedTemplateId('');
            setFechaAgendada(null);

            api.get('/email/cuentas')
                .then(res => setCuentasSmtp(res.data))
                .catch(err => console.error('Error al obtener cuentas smtp:', err));

            api.get('/email/templates')
                .then(res => setTemplates(res.data))
                .catch(err => console.error('Error al obtener templates:', err));
        }
    }, [open]);

    const enviarMensajes = async () => {
        if (selectedCuentaSmtp.length === 0) {
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

            if (fechaAgendada) {
                // Envío agendado
                await api.post(`/email/envio/campania/agendar`, {
                    idCampania: campaña.id,
                    idTemplate: selectedTemplateId,
                    idCuentaSmtp: selectedCuentaSmtp,
                    fechaAgenda: fechaAgendada
                });
            } else {
                // Envío inmediato
                await api.post('/email/envio/campania', {
                    idCampania: campaña.id,
                    idTemplate: selectedTemplateId,
                    idCuentaSmtp: selectedCuentaSmtp,
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
                    <InputLabel>Cuentas</InputLabel>
                    <Select
                        value={selectedCuentaSmtp}
                        onChange={(e) => setselectedCuentaSmtp(e.target.value)}
                        label="Cuentas"
                    >
                        {cuentasSmtp.map((s) => (
                            <MenuItem
                                key={s.id}
                                value={s.id}
                            >
                                <Box display="flex" justifyContent="space-between" width="100%">
                                    <span>{s.usuario}</span>
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
                        disabled={loading || selectedCuentaSmtp.length === 0 || !selectedTemplateId}
                        startIcon={loading ? <CircularProgress size={20} /> : null}
                    >
                        {loading ? 'Iniciando...' : mostrarCalendario ? 'Agendar campaña' : 'Iniciar envío'}
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
}