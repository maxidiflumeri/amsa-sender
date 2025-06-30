import React, { useEffect, useState } from 'react';
import {
    Box, Button, Grid, Card, CardContent, Typography,
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, CircularProgress, useTheme, Snackbar, IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api from '../../api/axios';
import MuiAlert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export default function CuentasSMTP() {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const theme = useTheme();
    const [cuentas, setCuentas] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        nombre: '',
        host: '',
        puerto: 587,
        usuario: '',
        password: '',
        remitente: '',
        emailFrom: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState({
        open: false,
        message: '',
        type: 'success' // o 'error'
    });


    useEffect(() => {
        fetchCuentas();
    }, []);

    const fetchCuentas = async () => {
        try {
            const res = await api.get('/email/cuentas');
            setCuentas(res.data);
        } catch (err) {
            console.error('Error al obtener cuentas SMTP', err);
        }
    };

    const handleChange = e => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        setError('');
        setLoading(true);
        try {
            await api.post('/email/cuentas', formData);
            setModalOpen(false);
            setFormData({
                nombre: '',
                host: '',
                puerto: 587,
                usuario: '',
                password: '',
                remitente: '',
                emailFrom: ''
            });
            fetchCuentas();
        } catch (err) {
            const msg =
                typeof err?.response?.data?.message === 'string'
                    ? err.response.data.message
                    : 'Error al crear cuenta SMTP';
            console.error('Error SMTP:', msg);
            setFeedback({
                open: true,
                type: 'error',
                message: msg
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{
            maxWidth: '1400px',
            mx: 'auto',
            px: { xs: 2, md: 3, lg: 4 },
            py: 3
        }}>
            <Box display="flex" justifyContent="space-between" mb={2} >
                <Typography variant="h5" fontWeight="bold">Cuentas SMTP</Typography>
                <Button sx={{
                    px: 4,
                    py: 1.3,
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
                }} variant="contained" startIcon={<AddIcon />} onClick={() => setModalOpen(true)}>
                    Nueva cuenta
                </Button>
            </Box>

            <Grid container spacing={2}>
                {cuentas.length === 0 && !loading && (

                    <Box
                        minHeight="25vh"
                        textAlign="center"
                        display="flex"
                        flexDirection="column"
                        alignItems="center"
                        justifyContent="center"
                        sx={{
                            border: '2px dashed',
                            borderColor: theme.palette.mode === 'dark' ? '#555' : '#ccc',
                            borderRadius: 4,
                            py: 5,
                            px: 3,
                            backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f9f9f9',
                            color: theme.palette.text.secondary,
                            mx: 'auto',
                        }}
                    >
                        <img
                            src="https://cdn-icons-png.flaticon.com/512/4208/4208391.png"
                            alt="Sin cuentas SMTP"
                            width={100}
                            style={{ marginBottom: 16, opacity: 0.6 }}
                        />
                        <Typography variant="h6" gutterBottom>
                            No hay ninguna cuenta SMTP cargada
                        </Typography>
                        <Typography variant="body2">
                            Agregá una cuenta para comenzar a enviar campañas por correo electrónico.
                        </Typography>
                        <Button
                            variant="contained"
                            onClick={() => setModalOpen(true)}
                            sx={{
                                mt: 3,
                                px: 4,
                                py: 1.3,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontSize: '0.9rem',
                                backgroundColor: '#1976d2',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    backgroundColor: '#115293',
                                    transform: 'scale(1.03)',
                                    boxShadow: 4,
                                },
                            }}
                        >
                            Nueva cuenta
                        </Button>
                    </Box>
                )}

                {cuentas.map((cuenta) => (
                    <Grid item xs={12} sm={6} md={4} key={cuenta.id}>
                        <Card
                            variant="outlined"
                            sx={{
                                position: 'relative',
                                p: 2,
                                borderRadius: 2,
                                boxShadow: 1,
                                transition: 'box-shadow 0.3s ease',
                                background: theme.palette.mode === 'light'
                                    ? 'linear-gradient(to right, #f0f4f8, #e8f0fe)'
                                    : '#2c2c2c',
                                color: theme.palette.text.primary,
                                '&:hover': { boxShadow: 6 },
                            }}
                        >
                            {/* Ícono eliminar (opcional) */}
                            <IconButton
                                size="small"
                                onClick={() => handleDelete(cuenta.id)}
                                sx={{
                                    position: 'absolute',
                                    top: 6,
                                    right: 6,
                                    color: theme.palette.error.main,
                                    zIndex: 1,
                                }}
                            >
                                <DeleteOutlineIcon fontSize="small" />
                            </IconButton>

                            <CardContent sx={{ pl: 0, pt: 0, pr: 1 }}>
                                <Typography variant="subtitle1" noWrap fontWeight="bold">
                                    {cuenta.nombre}
                                </Typography>
                                <Typography variant="subtitle2" noWrap>
                                    Host: {cuenta.host}:{cuenta.puerto}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" noWrap>
                                    Usuario: {cuenta.usuario}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" noWrap>
                                    Remitente: {cuenta.remitente} ({cuenta.emailFrom})
                                </Typography>

                                <Button
                                    variant="outlined"
                                    size="small"
                                    sx={{ mt: 2, textTransform: 'none' }}
                                    onClick={async () => {
                                        try {
                                            await api.get(`/email/cuentas/${cuenta.id}/test`);
                                            setFeedback({
                                                open: true,
                                                type: 'success',
                                                message: 'Conexión SMTP exitosa.'
                                            });
                                        } catch (error) {
                                            const msg =
                                                typeof error?.response?.data?.message === 'string'
                                                    ? error.response.data.message
                                                    : 'Error al probar la conexión SMTP';
                                            setFeedback({
                                                open: true,
                                                type: 'error',
                                                message: msg
                                            });
                                        }
                                    }}
                                >
                                    Probar conexión
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>



            <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Nueva cuenta SMTP</DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2}>
                        {[
                            { label: 'Nombre', name: 'nombre' },
                            { label: 'Host', name: 'host' },
                            { label: 'Puerto', name: 'puerto', type: 'number' },
                            { label: 'Usuario', name: 'usuario' },
                            { label: 'Contraseña', name: 'password', type: 'password' },
                            { label: 'Nombre del remitente', name: 'remitente' },
                            { label: 'Email del remitente', name: 'emailFrom', type: 'email' }
                        ].map(field => (
                            <Grid item xs={12} sm={field.full ? 12 : 6} key={field.name}>
                                <TextField
                                    label={field.label}
                                    name={field.name}
                                    type={field.type || 'text'}
                                    fullWidth
                                    value={formData[field.name]}
                                    onChange={handleChange}
                                />
                            </Grid>
                        ))}
                        {error && (
                            <Grid item xs={12}>
                                <Typography color="error">{error}</Typography>
                            </Grid>
                        )}
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading} variant="contained">
                        {loading ? <CircularProgress size={20} /> : 'Guardar'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={feedback.open}
                autoHideDuration={3000}
                onClose={() => setFeedback({ ...feedback, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <MuiAlert
                    elevation={6}
                    variant="filled"
                    severity={feedback.type}
                    onClose={() => setFeedback({ ...feedback, open: false })}
                    icon={<CheckCircleIcon fontSize="inherit" />}
                >
                    {feedback.message}
                </MuiAlert>
            </Snackbar>
        </Box>
    );
}