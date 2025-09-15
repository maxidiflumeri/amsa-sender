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
import Tooltip from '@mui/material/Tooltip';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import LinkIcon from '@mui/icons-material/Link';

export default function CuentasSMTP() {
    const [validacionesDominio, setValidacionesDominio] = useState({});
    const [verificandoDominioMap, setVerificandoDominioMap] = useState({});
    const [resultadoVerificacion, setResultadoVerificacion] = useState(null);
    const [modalVerificacionOpen, setModalVerificacionOpen] = useState(false);
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [showPassword, setShowPassword] = useState(false);
    const togglePasswordVisibility = () => setShowPassword((prev) => !prev);
    const [testResultados, setTestResultados] = useState(getStoredTestResultados);
    const [probandoId, setProbandoId] = useState(null);
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
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedCuenta, setSelectedCuenta] = useState(null);


    useEffect(() => {
        fetchCuentas();
    }, []);

    const fetchCuentas = async () => {
        try {
            const res = await api.get('/email/cuentas');
            setCuentas(res.data);
            res.data.forEach((cuenta) => verificarDominio(cuenta.id));
        } catch (err) {
            console.error('Error al obtener cuentas SMTP', err);
        }
    };

    function getStoredTestResultados() {
        try {
            const saved = localStorage.getItem('smtpTestResultados');
            const parsed = saved ? JSON.parse(saved) : {};
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                return parsed;
            }
        } catch (e) {
            console.warn('Error leyendo o parseando localStorage:', e);
        }

        localStorage.removeItem('smtpTestResultados'); // Limpieza
        return {};
    }

    const abrirModalVerificacion = (id) => {
        setResultadoVerificacion(validacionesDominio[id]);
        setModalVerificacionOpen(true);
    };

    const verificarDominio = async (id) => {
        setVerificandoDominioMap((prev) => ({ ...prev, [id]: true }));
        try {
            const res = await api.get(`/email/cuentas/${id}/verificar-dominio`);
            setValidacionesDominio((prev) => ({
                ...prev,
                [id]: res.data
            }));
            console.log(validacionesDominio[id])
        } catch (error) {
            setValidacionesDominio((prev) => ({
                ...prev,
                [id]: {
                    spf: false,
                    dkim: false,
                    dmarc: false,
                    error: true
                }
            }));
        } finally {
            setVerificandoDominioMap((prev) => ({ ...prev, [id]: false }));
        }
    };

    const handleChange = e => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleDelete = async () => {        
        try {
            await api.delete(`/email/cuentas/${selectedCuenta.id}`);
            setCuentas((prev) => prev.filter((cuenta) => cuenta.id !== selectedCuenta.id));
            setFeedback({
                open: true,
                type: 'success',
                message: 'Cuenta SMTP eliminada.'
            });
            setTestResultados((prev) => {
                const nuevo = { ...prev };
                delete nuevo[selectedCuenta.id];
                localStorage.setItem('smtpTestResultados', JSON.stringify(nuevo));
                return nuevo;
            });
            setSelectedCuenta(null);
            setDialogOpen(false);
        } catch (error) {
            const msg =
                typeof error?.response?.data?.message === 'string'
                    ? error.response.data.message
                    : 'Error al eliminar la cuenta SMTP';
            setFeedback({
                open: true,
                type: 'error',
                message: msg
            });
            setSelectedCuenta(null);
            setDialogOpen(false);
        }
    }

    const actualizarResultado = (id, resultado) => {
        setTestResultados((prev) => {
            const nuevo = { ...prev, [id]: resultado };
            localStorage.setItem('smtpTestResultados', JSON.stringify(nuevo));
            return nuevo;
        });
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

    const getLabelTitle = (key) => {
        switch (key) {
            case 'spf':
                return 'SPF (Sender Policy Framework)';
            case 'dkim':
                return 'DKIM (DomainKeys Identified Mail)';
            case 'dmarc':
                return 'DMARC (Domain-based Message Authentication, Reporting & Conformance)';
            default:
                return key.toUpperCase();
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
                <Box display="flex" alignItems="center">
                    <LinkIcon sx={{ fontSize: 32 }} />
                    <Typography ml={1} variant="h5" fontWeight="bold">Cuentas SMTP</Typography>
                </Box>
                <Button sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    backgroundColor: '#075E54',
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
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: 2,
                                boxShadow: 1,
                                transition: 'box-shadow 0.3s ease',
                                background: theme.palette.mode === 'light'
                                    ? 'linear-gradient(to right, #f0f4f8, #e8f0fe)'
                                    : '#2c2c2c',
                                color: theme.palette.text.primary,
                                '&:hover': { boxShadow: 6 },
                                px: 1.5,
                                py: 1,
                            }}
                        >

                            <Tooltip
                                title={
                                    testResultados[cuenta.id] === 'ok'
                                        ? 'Conexión exitosa'
                                        : testResultados[cuenta.id] === 'error'
                                            ? 'Error de conexión'
                                            : 'Nunca probado'
                                }
                                arrow
                                placement="left"
                            >
                                <Box
                                    sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        bgcolor:
                                            testResultados[cuenta.id] === 'ok'
                                                ? 'green'
                                                : testResultados[cuenta.id] === 'error'
                                                    ? 'red'
                                                    : 'gray',
                                        mx: 1,
                                        flexShrink: 0,
                                        cursor: 'default',
                                    }}
                                />
                            </Tooltip>


                            <CardContent sx={{ pl: 1, pr: 2, py: 1.5, width: '100%' }}>
                                <Box display="flex" justifyContent="space-between" alignItems="start">
                                    <Typography variant="subtitle1" fontWeight="bold" noWrap>
                                        {cuenta.nombre}
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            setSelectedCuenta(cuenta);
                                            setDialogOpen(true);
                                        }}
                                        sx={{ color: theme.palette.error.main }}
                                    >
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </Box>

                                <Typography variant="subtitle2" noWrap>
                                    Host: {cuenta.host}:{cuenta.puerto}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" noWrap>
                                    Usuario: {cuenta.usuario}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" noWrap>
                                    Remitente: {cuenta.remitente} ({cuenta.emailFrom})
                                </Typography>

                                {verificandoDominioMap[cuenta.id] ? (
                                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                                        <CircularProgress size={16} />
                                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                                            Verificando dominio...
                                        </Typography>
                                    </Box>
                                ) : validacionesDominio[cuenta.id] && (
                                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                                        {['spf', 'dkim', 'dmarc'].map((tipo) => (
                                            <Box key={tipo} display="flex" alignItems="center" gap={0.5}>
                                                <CheckCircleIcon
                                                    fontSize="small"
                                                    sx={{
                                                        color: validacionesDominio[cuenta.id][tipo]?.valido === true ? '#28a745' : 'gray'
                                                    }}
                                                />
                                                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                                                    {tipo.toUpperCase()}
                                                </Typography>
                                            </Box>
                                        ))}
                                        <Button
                                            onClick={() => abrirModalVerificacion(cuenta.id)}
                                            size="small"
                                            sx={{
                                                ml: 1,
                                                fontSize: '0.85rem',
                                                textTransform: 'none',
                                                color: '#1a73e8',
                                                '&:hover': { textDecoration: 'underline' }
                                            }}
                                        >
                                            Ver detalle
                                        </Button>
                                    </Box>
                                )}
                                <Button
                                    variant="outlined"
                                    size="small"
                                    sx={{ mt: 2, textTransform: 'none', minWidth: 140 }}
                                    onClick={async () => {
                                        setProbandoId(cuenta.id);
                                        actualizarResultado(cuenta.id, null);

                                        try {
                                            await api.get(`/email/cuentas/${cuenta.id}/test`);
                                            actualizarResultado(cuenta.id, 'ok');
                                            setFeedback({
                                                open: true,
                                                type: 'success',
                                                message: 'Conexión SMTP exitosa.',
                                            });
                                        } catch (error) {
                                            const msg =
                                                typeof error?.response?.data?.message === 'string'
                                                    ? error.response.data.message
                                                    : 'Error al probar la conexión SMTP';
                                            actualizarResultado(cuenta.id, 'error');
                                            setFeedback({
                                                open: true,
                                                type: 'error',
                                                message: msg,
                                            });
                                        } finally {
                                            setProbandoId(null);
                                        }
                                    }}
                                    disabled={probandoId === cuenta.id}
                                >
                                    {probandoId === cuenta.id ? (
                                        <CircularProgress size={16} />
                                    ) : (
                                        'Probar conexión'
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.3rem', px: 3, py: 2 }}>
                    Nueva cuenta SMTP
                </DialogTitle>

                <DialogContent dividers>
                    <Box component="form" noValidate autoComplete="off">
                        <Grid container direction="column" spacing={2}>
                            {/* Nombre */}
                            <Grid item>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Nombre"
                                    name="nombre"
                                    value={formData.nombre}
                                    onChange={handleChange}
                                    InputProps={{
                                        sx: { py: 0.5 }, // altura más baja aún
                                    }}
                                />
                            </Grid>

                            {/* Puerto y Host */}
                            <Grid item>
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Puerto"
                                            name="puerto"
                                            type="number"
                                            value={formData.puerto}
                                            onChange={handleChange}
                                            InputProps={{ sx: { py: 0.5 } }}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Host"
                                            name="host"
                                            value={formData.host}
                                            onChange={handleChange}
                                            InputProps={{ sx: { py: 0.5 } }}
                                        />
                                    </Grid>
                                </Grid>
                            </Grid>

                            {/* Usuario */}
                            <Grid item>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Usuario"
                                    name="usuario"
                                    value={formData.usuario}
                                    onChange={handleChange}
                                    InputProps={{ sx: { py: 0.5 } }}
                                />
                            </Grid>

                            {/* Contraseña */}
                            <Grid item>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Contraseña"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={handleChange}
                                    InputProps={{
                                        sx: { py: 0.5 },
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton onClick={togglePasswordVisibility} edge="end">
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>

                            {/* Nombre remitente */}
                            <Grid item>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Nombre del remitente"
                                    name="remitente"
                                    value={formData.remitente}
                                    onChange={handleChange}
                                    InputProps={{ sx: { py: 0.5 } }}
                                />
                            </Grid>

                            {/* Email remitente */}
                            <Grid item>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Email del remitente"
                                    name="emailFrom"
                                    type="email"
                                    value={formData.emailFrom}
                                    onChange={handleChange}
                                    InputProps={{ sx: { py: 0.5 } }}
                                />
                            </Grid>

                            {/* Error */}
                            {error && (
                                <Grid item>
                                    <Typography color="error">{error}</Typography>
                                </Grid>
                            )}
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button
                        onClick={() => setModalOpen(false)}
                        sx={{
                            textTransform: 'none',
                            fontFamily: commonFont,
                            borderRadius: 2,
                            px: 3,
                            py: 1.3,
                            color: '#555'
                        }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        variant="contained"
                        sx={{
                            fontFamily: commonFont,
                            backgroundColor: '#075E54',
                            textTransform: 'none',
                            borderRadius: 2,
                            px: 4,
                            py: 1.3,
                            fontWeight: 'bold',
                            '&:hover': {
                                backgroundColor: '#0b7b65',
                                transform: 'scale(1.03)',
                                boxShadow: 4
                            }
                        }}
                    >
                        {loading ? <CircularProgress size={20} color="inherit" /> : 'Guardar'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={modalVerificacionOpen}
                onClose={() => {
                    setModalVerificacionOpen(false);
                    setResultadoVerificacion(null); // Limpia al cerrar
                }}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle sx={{ fontWeight: 'bold' }}>Detalles de validacion de dominio</DialogTitle>
                <DialogContent dividers>
                    {!resultadoVerificacion ? (
                        <Box textAlign="center" py={3}>
                            <CircularProgress />
                            <Typography mt={2}>Verificando registros DNS...</Typography>
                        </Box>
                    ) : resultadoVerificacion?.error ? (
                        <Typography color="error">{resultadoVerificacion.error}</Typography>
                    ) : (
                        resultadoVerificacion && (
                            <Box>
                                {resultadoVerificacion.dominio && (
                                    <Typography>
                                        <b>Dominio:</b> {resultadoVerificacion.dominio}
                                    </Typography>
                                )}
                                {['spf', 'dkim', 'dmarc'].map((key) => {
                                    const val = resultadoVerificacion[key];
                                    if (!val) return null;

                                    const labels = {
                                        spf: 'SPF (Sender Policy Framework)',
                                        dkim: 'DKIM (DomainKeys Identified Mail)',
                                        dmarc: 'DMARC (Domain-based Message Authentication, Reporting & Conformance)'
                                    };

                                    const valido = val.valido;
                                    const texto = val.valor || val.sugerencia || 'Sin información';

                                    return (
                                        <Tooltip key={key} title={labels[key]} placement="top" arrow>
                                            <Box
                                                key={key}
                                                display="flex"
                                                alignItems="start"
                                                mt={2}
                                                p={2}
                                                borderRadius={2}
                                                sx={{
                                                    bgcolor: (theme) =>
                                                        valido
                                                            ? theme.palette.mode === 'dark'
                                                                ? '#1b5e20' // verde oscuro
                                                                : '#e8f5e9' // verde claro
                                                            : theme.palette.mode === 'dark'
                                                                ? '#5c0000' // rojo oscuro
                                                                : '#ffebee', // rojo claro
                                                    color: (theme) =>
                                                        valido
                                                            ? theme.palette.mode === 'dark'
                                                                ? '#c8e6c9'
                                                                : 'inherit'
                                                            : theme.palette.mode === 'dark'
                                                                ? '#ffcdd2'
                                                                : 'inherit'
                                                }}
                                            >
                                                <Box
                                                    component="span"
                                                    fontSize="1.4rem"
                                                    mr={2}
                                                    color={valido ? 'lightgreen' : 'orange'}
                                                >
                                                    {valido ? '✅' : '⚠️'}
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                                        {getLabelTitle(key)}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                                        {texto}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Tooltip>
                                    );
                                })}
                            </Box>
                        )
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            setModalVerificacionOpen(false);
                            setResultadoVerificacion(null);
                        }}
                        sx={{ textTransform: 'none' }}
                    >
                        Cerrar
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
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle>¿Eliminar template?</DialogTitle>
                <DialogContent>
                    <Typography>
                        ¿Esta seguro que desea eliminar la cuenta "{selectedCuenta?.usuario}"? Esta acción no se puede deshacer.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)} color="secondary">
                        Cancelar
                    </Button>
                    <Button sx={{
                        px: 2,
                        py: 1,
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
                    }} onClick={handleDelete} color="primary" variant="contained">
                        Confirmar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}