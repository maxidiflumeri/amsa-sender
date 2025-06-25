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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import api from '../api/axios';
import InboxIcon from '@mui/icons-material/Inbox';

export default function VerReportes() {
    const theme = useTheme();
    const isMobile = useMediaQuery('(max-width:768px)');
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const [campañas, setCampañas] = useState([]);
    const [campañaSeleccionada, setCampañaSeleccionada] = useState(null);
    const [reportes, setReportes] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    useEffect(() => {
        api.get('/reportes/campanias-con-reportes')
            .then(res => setCampañas(res.data))
            .catch(err => console.error('Error cargando campañas', err));
    }, []);

    useEffect(() => {
        if (!campañaSeleccionada) {
            setReportes([]);
            return;
        }

        api.get(`/reportes?campañaId=${campañaSeleccionada.id}`)
            .then(res => setReportes(res.data))
            .catch(err => console.error('Error cargando reportes', err));
    }, [campañaSeleccionada]);

    const handleChangePage = (_, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const getEstadoChip = (estado) => {
        switch (estado) {
            case 'enviado':
                return <Chip label="Enviado" color="success" />;
            case 'fallido':
                return <Chip label="Fallido" color="error" />;
            case 'pendiente':
                return <Chip label="Pendiente" color="default" />;
            default:
                return <Chip label={estado} />;
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

    const reportesPaginados = reportes.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Box
            sx={{
                py: 3
            }}
        >
            <Paper
                elevation={1}
                sx={{
                    width: '100%',
                    overflowX: 'auto',
                    maxWidth: 'none',
                    p: isMobile ? 1 : 3,
                    boxShadow: 'none',
                }}
            >
                <Box display="flex" flexDirection={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'flex-start' : 'center'} gap={2}>
                    <Typography variant="h6">Reportes de Envío</Typography>
                    <Button
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
                        Exportar CSV
                    </Button>
                </Box>

                <Box mt={2} mb={2}>
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
                                sx={{ minWidth: isMobile ? '100%' : 300 }}
                            />
                        )}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                    />
                </Box>

                <Box overflow="auto">
                    <Table size={isMobile ? 'small' : 'medium'}>
                        <TableHead>
                            <TableRow>
                                <TableCell>Línea Movil</TableCell>
                                <TableCell>Mensaje</TableCell>
                                <TableCell>Estado</TableCell>
                                <TableCell>Campaña</TableCell>
                                <TableCell>Línea Movil Origen</TableCell>
                                <TableCell>Fecha de Envío</TableCell>
                                <TableCell>Datos Adicionales</TableCell> {/* 👈 NUEVO */}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {reportesPaginados.map((r, i) => (
                                <TableRow key={i}>
                                    <TableCell>{r.numero}</TableCell>
                                    <TableCell>{r.mensaje}</TableCell>
                                    <TableCell>{getEstadoChip(r.estado)}</TableCell>
                                    <TableCell>{r.campaña?.nombre || '–'}</TableCell>
                                    <TableCell>{r.aniEnvio || '–'}</TableCell>
                                    <TableCell>{r.enviadoAt ? new Date(r.enviadoAt).toLocaleString() : '–'}</TableCell>
                                    <TableCell>
                                        {r.datos ? (
                                            <Box
                                                sx={{
                                                    backgroundColor: theme.palette.mode === 'dark' ? '#263238' : '#f5f5f5',
                                                    borderRadius: 2,
                                                    px: 2,
                                                    py: 1,
                                                    fontSize: '0.85rem',
                                                    fontFamily: 'monospace',
                                                    maxHeight: 120,
                                                    overflowY: 'auto',
                                                }}
                                            >
                                                {Object.entries(r.datos).map(([key, val]) => (
                                                    <div key={key}><strong>{key}:</strong> {String(val)}</div>
                                                ))}
                                            </Box>
                                        ) : '–'}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {reportesPaginados.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8}>
                                        <Box
                                            sx={{
                                                textAlign: 'center',
                                                py: 6,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                color: 'text.secondary'
                                            }}
                                        >
                                            <InboxIcon sx={{ fontSize: 60, mb: 2 }} />
                                            <Typography variant="h6" gutterBottom>
                                                No hay reportes para esta campaña.
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Box>

                <TablePagination
                    component="div"
                    count={reportes.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50, 100]}
                    labelRowsPerPage="Filas por página"
                />
            </Paper>
        </Box>
    );
}