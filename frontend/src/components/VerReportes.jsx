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
        api.get('/campanias-con-reportes')
            .then(res => setCampañas(res.data))
            .catch(err => console.error('Error cargando campañas', err));
    }, []);

    useEffect(() => {
        if (!campañaSeleccionada) {
            setReportes([]);
            return;
        }

        api.get(`/reports?campañaId=${campañaSeleccionada.id}`)
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
        const encabezado = 'Número,Mensaje,Estado,Campaña,Fecha de Envío\n';
        const filas = reportes.map(r =>
            `${r.numero},"${r.mensaje.replace(/"/g, '""')}",${r.estado},${r.campaña?.nombre || ''},${r.campaña?.enviadoAt || ''}`
        );
        const csv = encabezado + filas.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `reporte_campaña_${campañaSeleccionada?.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const reportesPaginados = reportes.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Box px={isMobile ? 1 : 3}>
            <Paper sx={{ p: isMobile ? 1 : 2 }}>
                <Box display="flex" flexDirection={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'flex-start' : 'center'} gap={2}>
                    <Typography variant="h6">Reportes de Envío</Typography>
                    <Button
                        variant="contained"
                        onClick={exportarCSV}
                        disabled={reportes.length === 0}
                        sx={{ backgroundColor: '#075E54', fontFamily: commonFont, textTransform: 'none' }}
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
                                <TableCell>Número</TableCell>
                                <TableCell>Mensaje</TableCell>
                                <TableCell>Estado</TableCell>
                                <TableCell>Campaña</TableCell>
                                <TableCell>Fecha de Envío</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {reportesPaginados.map((r, i) => (
                                <TableRow key={i}>
                                    <TableCell>{r.numero}</TableCell>
                                    <TableCell>{r.mensaje}</TableCell>
                                    <TableCell>{getEstadoChip(r.estado)}</TableCell>
                                    <TableCell>{r.campaña?.nombre || '–'}</TableCell>
                                    <TableCell>
                                        {r.enviadoAt ? new Date(r.enviadoAt).toLocaleString() : '–'}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {reportesPaginados.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5}>
                                        <Typography variant="body2" color="text.secondary">
                                            No hay reportes para esta campaña.
                                        </Typography>
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