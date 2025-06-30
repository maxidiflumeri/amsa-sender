import { useEffect, useState } from 'react';
import {
    Paper,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Chip,
    TablePagination,
    Box,
    Button,
    TextField,
    Autocomplete,
    useMediaQuery,
    Tabs,
    Tab,
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import api from '../api/axios';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';

export default function VerReportes() {
    const theme = useTheme();
    const isMobile = useMediaQuery('(max-width:768px)');
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [campañas, setCampañas] = useState([]);
    const [campañaSeleccionada, setCampañaSeleccionada] = useState(null);
    const [reportes, setReportes] = useState([]);
    const [mensajes, setMensajes] = useState([]);
    const [tab, setTab] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [mensajesContacto, setMensajesContacto] = useState([]);
    const [numeroActual, setNumeroActual] = useState(null);
    const [busquedaNumero, setBusquedaNumero] = useState('');

    useEffect(() => {
        api.get('/whatsapp/reportes/campanias-con-reportes')
            .then(res => setCampañas(res.data))
            .catch(err => console.error('Error cargando campañas', err));
    }, []);

    useEffect(() => {
        if (!campañaSeleccionada) {
            setReportes([]);
            setMensajes([]);
            return;
        }

        api.get(`/whatsapp/reportes?campañaId=${campañaSeleccionada.id}`)
            .then(res => setReportes(res.data))
            .catch(err => console.error('Error cargando reportes', err));
        api.get(`/whatsapp/mensajes?campañaId=${campañaSeleccionada.id}`)
            .then(res => setMensajes(res.data))
            .catch(err => console.error('Error cargando reportes', err));
    }, [campañaSeleccionada]);

    const abrirModalMensajes = async (numero) => {
        try {
            const res = await api.get('/whatsapp/mensajes/por-campania', {
                params: {
                    campaniaId: campañaSeleccionada.id,
                    numero,
                },
            });

            setMensajesContacto(res.data);
            setNumeroActual(numero);
            setModalAbierto(true);
        } catch (error) {
            console.error('Error al obtener mensajes del contacto:', error);
        }
    };

    const handleCloseModal = () => setModalAbierto(false);

    const datosFiltrados = (tab === 0 ? reportes : mensajes).filter((item) =>
        item.numero.toLowerCase().includes(busquedaNumero.toLowerCase())
    );

    const datosPaginados = datosFiltrados.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const getEstadoChip = (estado) => {
        switch (estado) {
            case 'enviado': return <Chip label="Enviado" color="success" />;
            case 'fallido': return <Chip label="Fallido" color="error" />;
            case 'pendiente': return <Chip label="Pendiente" color="default" />;
            default: return <Chip label={estado} />;
        }
    };

    const exportarCSV = () => {
        if (!reportes.length) return;

        // 1. Reunir todas las claves únicas del campo "datos"
        const clavesDatos = new Set();
        reportes.forEach(r => {
            if (r.datos) {
                Object.keys(r.datos).forEach(k => clavesDatos.add(k));
            }
        });
        const columnasDatos = Array.from(clavesDatos);

        // 2. Armar encabezados
        const headers = [
            'Número',
            'Mensaje',
            'Estado',
            'Campaña',
            'Línea Móvil Origen',
            'Fecha de Envío',
            ...columnasDatos
        ];

        // 3. Armar filas
        const filas = reportes.map(r => {
            const base = [
                r.numero,
                r.mensaje,
                r.estado,
                r.campaña?.nombre || '',
                r.aniEnvio || '',
                r.enviadoAt ? new Date(r.enviadoAt).toLocaleString() : ''
            ];
            const extras = columnasDatos.map(k => r.datos?.[k] ?? '');
            return [...base, ...extras];
        });

        const escapeCSV = (valor) =>
            `"${String(valor).replace(/\r?\n/g, '\\n').replace(/"/g, '""')}"`;

        const contenidoCSV = [
            headers.map(escapeCSV).join(','),
            ...filas.map(fila => fila.map(escapeCSV).join(','))
        ].join('\r\n');

        const blob = new Blob(["\uFEFF" + contenidoCSV], {
            type: 'text/csv;charset=utf-8;'
        });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `reporte_campaña_${campañaSeleccionada?.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportarMensajesCSV = () => {
        const escapeCSV = (valor) => `"${String(valor).replace(/\r?\n/g, '\\n').replace(/"/g, '""')}"`;
        if (!mensajes.length) return;

        const headers = ['Tipo', 'Número', 'Mensaje', 'Fecha'];
        const filas = mensajes.map(m => [
            m.fromMe ? 'Enviado' : 'Recibido',
            m.numero,
            m.mensaje,
            new Date(m.fecha).toLocaleString()
        ]);

        const contenidoCSV = [
            headers.map(escapeCSV).join(','),
            ...filas.map(f => f.map(escapeCSV).join(','))
        ].join('\r\n');

        const blob = new Blob(["\uFEFF" + contenidoCSV], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `mensajes_campaña_${campañaSeleccionada?.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Box sx={{ py: 3 }}>
            <Paper elevation={1} sx={{ width: '100%', overflowX: 'auto', maxWidth: 'none', p: isMobile ? 1 : 3, boxShadow: 'none' }}>
                <Typography variant="h6">Reportes de Envío</Typography>
                <Box display="flex" flexDirection={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'flex-start' : 'center'} gap={2}>
                    <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)} textColor="primary" indicatorColor="primary" sx={{ mb: 2 }}>
                        <Tab label="Reportes" />
                        <Tab label="Mensajes" />
                    </Tabs>

                    {tab === 0 && <Button
                        variant="contained"
                        onClick={exportarCSV}
                        disabled={reportes.length === 0}
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
                        Exportar reporte a CSV
                    </Button>
                    }

                    {tab === 1 && <Button
                        variant="contained"
                        onClick={exportarMensajesCSV}
                        disabled={reportes.length === 0}
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
                        Exportar mensajes a CSV
                    </Button>
                    }

                </Box>

                <Autocomplete
                    options={campañas}
                    getOptionLabel={(option) => option.nombre}
                    value={campañaSeleccionada}
                    onChange={(_, newValue) => setCampañaSeleccionada(newValue)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Buscar campaña"
                            placeholder="Ej: Campaña verano"
                            sx={{ mb: 3, minWidth: isMobile ? '100%' : 300 }}
                        />
                    )}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                />

                <Box sx={{ mb: 3 }}>
                    <TextField
                        label="Buscar número"
                        variant="outlined"
                        size="small"
                        value={busquedaNumero}
                        onChange={(e) => setBusquedaNumero(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ width: { xs: '100%', sm: 250 } }}
                    />
                </Box>

                {tab === 0 && (
                    <>
                        <Table size={isMobile ? 'small' : 'medium'}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Número</TableCell>
                                    <TableCell>Mensaje</TableCell>
                                    <TableCell>Estado</TableCell>
                                    <TableCell>Campaña</TableCell>
                                    <TableCell>Fecha</TableCell>
                                    <TableCell>Datos</TableCell>
                                    <TableCell>Historial</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {datosPaginados.map((r, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{r.numero}</TableCell>
                                        <TableCell>{r.mensaje}</TableCell>
                                        <TableCell>{getEstadoChip(r.estado)}</TableCell>
                                        <TableCell>{r.campaña?.nombre || '–'}</TableCell>
                                        <TableCell>{r.enviadoAt ? new Date(r.enviadoAt).toLocaleString() : '–'}</TableCell>
                                        <TableCell>
                                            {r.datos ? (
                                                <Box sx={{ backgroundColor: theme.palette.mode === 'dark' ? '#263238' : '#f5f5f5', borderRadius: 2, px: 2, py: 1, fontSize: '0.85rem', fontFamily: 'monospace', maxHeight: 120, overflowY: 'auto' }}>
                                                    {Object.entries(r.datos).map(([key, val]) => (
                                                        <div key={key}><strong>{key}:</strong> {String(val)}</div>
                                                    ))}
                                                </Box>
                                            ) : '–'}
                                        </TableCell>
                                        <TableCell>
                                            <IconButton onClick={() => abrirModalMensajes(r.numero)}>
                                                <ChatIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </>
                )}

                {tab === 1 && (
                    <Table size={isMobile ? 'small' : 'medium'}>
                        <TableHead>
                            <TableRow>
                                <TableCell>Tipo</TableCell>
                                <TableCell>Número</TableCell>
                                <TableCell>Mensaje</TableCell>
                                <TableCell>Fecha</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {datosPaginados.map((m, i) => (
                                <TableRow key={i}>
                                    <TableCell>
                                        <Chip
                                            label={m.fromMe ? 'Enviado' : 'Recibido'}
                                            color={m.fromMe ? 'primary' : 'secondary'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>{m.numero}</TableCell>
                                    <TableCell>{m.mensaje}</TableCell>
                                    <TableCell>{new Date(m.fecha).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}

                <TablePagination
                    component="div"
                    count={datosFiltrados.length}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={e => setRowsPerPage(parseInt(e.target.value, 10))}
                    rowsPerPageOptions={[5, 10, 25, 50, 100]}
                    labelRowsPerPage="Filas por página"
                />
            </Paper>

            <Dialog open={modalAbierto} onClose={handleCloseModal} maxWidth="sm" fullWidth>
                <DialogTitle>
                    Conversación con {numeroActual}
                    <IconButton onClick={handleCloseModal} sx={{ position: 'absolute', right: 8, top: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Box display="flex" flexDirection="column" gap={2}>
                        {mensajesContacto.map((m, i) => (
                            <Box
                                key={i}
                                sx={{
                                    display: 'flex',
                                    justifyContent: m.fromMe ? 'flex-end' : 'flex-start'
                                }}
                            >
                                <Box
                                    sx={{
                                        backgroundColor: m.fromMe
                                            ? theme.palette.mode === 'dark' ? '#005c4b' : '#dcf8c6'
                                            : theme.palette.mode === 'dark' ? '#2a2f32' : '#fff',
                                        color: m.fromMe
                                            ? theme.palette.mode === 'dark' ? '#fff' : '#000'
                                            : theme.palette.mode === 'dark' ? '#e9edef' : '#000',
                                        borderRadius: '16px',
                                        px: 2,
                                        py: 1.5,
                                        maxWidth: '75%',
                                        boxShadow: 3,
                                        fontSize: '1rem',
                                        fontFamily: commonFont,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        position: 'relative'
                                    }}
                                >
                                    <Typography variant="body2">{m.mensaje}</Typography>
                                    <Box sx={{ fontSize: '0.75rem', color: theme.palette.mode === 'dark' ? '#ccd' : '#555', textAlign: 'right', mt: 1 }}>
                                        {new Date(m.fecha).toLocaleString()}
                                    </Box>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </DialogContent>
            </Dialog>
        </Box>
    );
}