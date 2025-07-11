import React, { useEffect, useState } from 'react';
import {
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Paper,
    Tabs,
    Tab,
    TableSortLabel,
    TablePagination,
    Box,
    TextField,
    Chip,
    LinearProgress,
    Tooltip,
    useMediaQuery,
    Dialog,
    DialogTitle,
    DialogContent,
    Button
} from '@mui/material';
import api from '../../api/axios';
import InboxIcon from '@mui/icons-material/Inbox';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import SubirCampañaModal from './SubirCampañaModal';

export default function VerCampañasEmail() {
    const isMobile = useMediaQuery('(max-width:768px)');
    const theme = useTheme();
    const [campanias, setCampanias] = useState([]);
    const [tab, setTab] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [order, setOrder] = useState('asc');
    const [orderBy, setOrderBy] = useState('nombre');
    const [filtroTexto, setFiltroTexto] = useState('');
    const [progresos, setProgresos] = useState({});
    const [modalNueva, setModalNueva] = useState(false);

    const cargarCampanias = async () => {
        try {
            const res = await api.get('/email/campanias');
            setCampanias(res.data);
        } catch (err) {
            console.error('Error al obtener campañas:', err);
        }
    };

    useEffect(() => {
        cargarCampanias();
    }, []);

    const agendadas = campanias.filter(c => c.estado === 'programada');
    const pendientes = campanias.filter(c => c.estado === 'pendiente');
    const procesando = campanias.filter(c => ['procesando', 'pausada', 'pausa_pendiente'].includes(c.estado));
    const enviadas = campanias.filter(c => c.estado === 'finalizada');
    const campaniasPorTab = tab === 0 ? pendientes : tab === 1 ? agendadas : tab === 2 ? procesando : enviadas;

    const campaniasMostradas = campaniasPorTab.filter((c) =>
        c.nombre.toLowerCase().includes(filtroTexto.toLowerCase())
    );

    const descendingComparator = (a, b, orderBy) => {
        let aVal = a[orderBy], bVal = b[orderBy];
        if (["createdAt", "enviadoAt"].includes(orderBy)) {
            aVal = aVal ? new Date(aVal).getTime() : 0;
            bVal = bVal ? new Date(bVal).getTime() : 0;
        }
        return bVal < aVal ? -1 : bVal > aVal ? 1 : 0;
    };

    const getComparator = (order, orderBy) =>
        order === 'desc'
            ? (a, b) => descendingComparator(a, b, orderBy)
            : (a, b) => -descendingComparator(a, b, orderBy);

    const stableSort = (array, comparator) =>
        array.map((el, index) => [el, index])
            .sort((a, b) => {
                const cmp = comparator(a[0], b[0]);
                return cmp !== 0 ? cmp : a[1] - b[1];
            })
            .map(el => el[0]);

    const campaniasOrdenadas = stableSort(campaniasMostradas, getComparator(order, orderBy));
    const campaniasPaginadas = campaniasOrdenadas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <>
            <Box sx={{ py: 3 }}>
                <Paper sx={{ p: isMobile ? 2 : 4 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">Campañas Email</Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setModalNueva(true)}
                            sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                backgroundColor: '#075E54',
                                '&:hover': {
                                    backgroundColor: '#0b7b65',
                                    transform: 'scale(1.03)',
                                    boxShadow: 4,
                                },
                            }}
                        >
                            Nueva campaña
                        </Button>
                    </Box>

                    <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)}>
                        <Tab label={`Pendientes (${pendientes.length})`} />
                        <Tab label={`Agendadas (${agendadas.length})`} />
                        <Tab label={`Procesando (${procesando.length})`} />
                        <Tab label={`Enviadas (${enviadas.length})`} />
                    </Tabs>

                    <Box my={2}>
                        <TextField
                            fullWidth
                            label="Buscar campañas"
                            value={filtroTexto}
                            onChange={(e) => setFiltroTexto(e.target.value)}
                            placeholder="Buscar por nombre..."
                        />
                    </Box>

                    <Table size={isMobile ? 'small' : 'medium'}>
                        <TableHead>
                            <TableRow>
                                <TableCell>
                                    <TableSortLabel
                                        active={orderBy === 'nombre'}
                                        direction={orderBy === 'nombre' ? order : 'asc'}
                                        onClick={() => setOrderBy('nombre')}
                                    >
                                        Nombre
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>Contactos</TableCell>
                                <TableCell>Estado</TableCell>
                                <TableCell>Creado</TableCell>
                                <TableCell>Enviado</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {campaniasPaginadas.map((c) => (
                                <TableRow key={c.id} hover>
                                    <TableCell>{c.nombre}</TableCell>
                                    <TableCell>{c.contactos.length}</TableCell>
                                    <TableCell>
                                        <Chip label={c.estado} color={
                                            c.estado === 'procesando' ? 'info' :
                                                c.estado === 'pausada' ? 'warning' :
                                                    c.estado === 'finalizada' ? 'success' :
                                                        'default'
                                        } />
                                    </TableCell>
                                    <TableCell>{c.createdAt ? new Date(c.createdAt).toLocaleString() : '–'}</TableCell>
                                    <TableCell>{c.enviadoAt ? new Date(c.enviadoAt).toLocaleString() : '–'}</TableCell>
                                </TableRow>
                            ))}
                            {campaniasPaginadas.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5}>
                                        <Box sx={{ textAlign: 'center', py: 6 }}>
                                            <InboxIcon sx={{ fontSize: 60, mb: 2 }} />
                                            <Typography variant="h6">No se encontraron campañas</Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25]}
                        component="div"
                        count={campaniasMostradas.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(_, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                    />
                </Paper>
            </Box>

            <Dialog open={modalNueva} onClose={() => setModalNueva(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Nueva campaña</DialogTitle>
                <DialogContent dividers>
                    <SubirCampañaModal
                        onUploadSuccess={() => {
                            setModalNueva(false);
                            cargarCampanias();
                            setMensaje({ tipo: 'success', texto: 'Campaña subida correctamente' });
                            setSnackbarOpen(true);
                        }}
                    />
                </DialogContent>
            </Dialog>

        </>
    );
}