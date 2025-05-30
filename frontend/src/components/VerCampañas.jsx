import React, { useEffect, useState } from 'react';
import {
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Button,
    Alert,
    Chip,
    TablePagination,
    Tabs,
    Tab,
    TableSortLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import api from '../api/axios';
import SubirCampaña from './SubirCampaña';
import EnviarMensajesModal from './EnviarMensajes';

export default function VerCampañas() {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';

    // Estado campañas y modales
    const [campañas, setCampañas] = useState([]);
    const [campañaSeleccionada, setCampañaSeleccionada] = useState(null);
    const [modalNueva, setModalNueva] = useState(false);
    const [modalEnvio, setModalEnvio] = useState(false);
    const [campañaAEnviar, setCampañaAEnviar] = useState(null);
    const [mensaje, setMensaje] = useState(null);

    // Estado pestañas: 0 = Pendientes, 1 = Enviadas
    const [tab, setTab] = useState(0);

    // Paginación y orden para cada tabla
    const [pagePendientes, setPagePendientes] = useState(0);
    const [rowsPerPagePendientes, setRowsPerPagePendientes] = useState(5);
    const [orderPendientes, setOrderPendientes] = useState('asc');
    const [orderByPendientes, setOrderByPendientes] = useState('nombre');

    const [pageEnviadas, setPageEnviadas] = useState(0);
    const [rowsPerPageEnviadas, setRowsPerPageEnviadas] = useState(5);
    const [orderEnviadas, setOrderEnviadas] = useState('asc');
    const [orderByEnviadas, setOrderByEnviadas] = useState('nombre');

    // Carga campañas
    const cargarCampañas = async () => {
        try {
            const res = await api.get('/campanias');
            setCampañas(res.data);
        } catch (err) {
            console.error('Error al obtener campañas:', err);
        }
    };

    useEffect(() => {
        cargarCampañas();
    }, []);

    // Funciones de ordenamiento
    function descendingComparator(a, b, orderBy) {
        let aValue = a[orderBy];
        let bValue = b[orderBy];

        // Para fechas (createdAt, enviadoAt), comparo como timestamp
        if (orderBy === 'createdAt' || orderBy === 'enviadoAt') {
            aValue = aValue ? new Date(aValue).getTime() : 0;
            bValue = bValue ? new Date(bValue).getTime() : 0;
        }

        // Para contactos.length
        if (orderBy === 'contactos') {
            aValue = a.contactos ? a.contactos.length : 0;
            bValue = b.contactos ? b.contactos.length : 0;
        }

        if (bValue < aValue) return -1;
        if (bValue > aValue) return 1;
        return 0;
    }

    function getComparator(order, orderBy) {
        return order === 'desc'
            ? (a, b) => descendingComparator(a, b, orderBy)
            : (a, b) => -descendingComparator(a, b, orderBy);
    }

    function stableSort(array, comparator) {
        const stabilizedThis = array.map((el, index) => [el, index]);
        stabilizedThis.sort((a, b) => {
            const order = comparator(a[0], b[0]);
            if (order !== 0) return order;
            return a[1] - b[1];
        });
        return stabilizedThis.map(el => el[0]);
    }

    // Dividir campañas en enviadas y pendientes
    const pendientes = campañas.filter(c => !c.enviadoAt);
    const enviadas = campañas.filter(c => c.enviadoAt);

    // Variables de paginacion y orden segun pestaña
    const campañasMostradas = tab === 0 ? pendientes : enviadas;
    const page = tab === 0 ? pagePendientes : pageEnviadas;
    const rowsPerPage = tab === 0 ? rowsPerPagePendientes : rowsPerPageEnviadas;
    const order = tab === 0 ? orderPendientes : orderEnviadas;
    const orderBy = tab === 0 ? orderByPendientes : orderByEnviadas;

    // Ordenar campañas según estado
    const campañasOrdenadas = stableSort(campañasMostradas, getComparator(order, orderBy));

    // Slicing para paginacion
    const campañasPaginadas = campañasOrdenadas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    // Handlers
    const handleChangeTab = (event, newValue) => {
        setTab(newValue);
    };

    const handleRequestSort = (property) => {
        if (tab === 0) {
            const isAsc = orderByPendientes === property && orderPendientes === 'asc';
            setOrderPendientes(isAsc ? 'desc' : 'asc');
            setOrderByPendientes(property);
        } else {
            const isAsc = orderByEnviadas === property && orderEnviadas === 'asc';
            setOrderEnviadas(isAsc ? 'desc' : 'asc');
            setOrderByEnviadas(property);
        }
    };

    const handleChangePage = (event, newPage) => {
        if (tab === 0) {
            setPagePendientes(newPage);
        } else {
            setPageEnviadas(newPage);
        }
    };

    const handleChangeRowsPerPage = (event) => {
        const newRows = parseInt(event.target.value, 10);
        if (tab === 0) {
            setRowsPerPagePendientes(newRows);
            setPagePendientes(0);
        } else {
            setRowsPerPageEnviadas(newRows);
            setPageEnviadas(0);
        }
    };

    return (
        <>
            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Campañas</Typography>

                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setModalNueva(true)}
                    sx={{ mb: 2, backgroundColor: '#075E54', fontFamily: commonFont, textTransform: 'none' }}
                >
                    Nueva campaña
                </Button>

                <Tabs value={tab} onChange={handleChangeTab} sx={{ mb: 2 }}>
                    <Tab label={`Pendientes (${pendientes.length})`} />
                    <Tab label={`Enviadas (${enviadas.length})`} />
                </Tabs>

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sortDirection={orderBy === 'nombre' ? order : false}>
                                <TableSortLabel
                                    active={orderBy === 'nombre'}
                                    direction={orderBy === 'nombre' ? order : 'asc'}
                                    onClick={() => handleRequestSort('nombre')}
                                >
                                    Nombre
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sortDirection={orderBy === 'contactos' ? order : false} align="right">
                                <TableSortLabel
                                    active={orderBy === 'contactos'}
                                    direction={orderBy === 'contactos' ? order : 'asc'}
                                    onClick={() => handleRequestSort('contactos')}
                                >
                                    Contactos
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sortDirection={orderBy === 'createdAt' ? order : false}>
                                <TableSortLabel
                                    active={orderBy === 'createdAt'}
                                    direction={orderBy === 'createdAt' ? order : 'asc'}
                                    onClick={() => handleRequestSort('createdAt')}
                                >
                                    Creado
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sortDirection={orderBy === 'enviadoAt' ? order : false}>
                                <TableSortLabel
                                    active={orderBy === 'enviadoAt'}
                                    direction={orderBy === 'enviadoAt' ? order : 'asc'}
                                    onClick={() => handleRequestSort('enviadoAt')}
                                >
                                    Enviado
                                </TableSortLabel>
                            </TableCell>
                            <TableCell>Acciones</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {campañasPaginadas.length > 0 ? campañasPaginadas.map(c => {
                            const creado = c.createdAt ? new Date(c.createdAt).toLocaleString() : '–';
                            const enviado = c.enviadoAt ? new Date(c.enviadoAt).toLocaleString() : '–';

                            return (
                                <TableRow key={c.id}>
                                    <TableCell
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => setCampañaSeleccionada(c)}
                                    >
                                        {c.nombre}
                                    </TableCell>
                                    <TableCell align="right">{c.contactos.length}</TableCell>
                                    <TableCell>{creado}</TableCell>
                                    <TableCell>{enviado}</TableCell>
                                    <TableCell>
                                        {c.enviadoAt ? (
                                            <Chip label="Enviado" color="success" />
                                        ) : (
                                            <Button
                                                variant="outlined"
                                                startIcon={<SendIcon />}
                                                onClick={() => {
                                                    setCampañaAEnviar(c);
                                                    setModalEnvio(true);
                                                }}
                                                sx={{
                                                    color: '#075E54',
                                                    borderColor: '#075E54',
                                                    '&:hover': {
                                                        borderColor: '#06493e',
                                                        backgroundColor: 'rgba(7, 94, 84, 0.08)',
                                                    }
                                                }}
                                            >
                                                Enviar campaña
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        }) : (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    No hay campañas para mostrar.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={campañasMostradas.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </Paper>

            {mensaje && (
                <Alert
                    severity={mensaje.tipo}
                    onClose={() => setMensaje(null)}
                    sx={{ mt: 2 }}
                >
                    {mensaje.texto}
                </Alert>
            )}

            <Dialog open={modalNueva} onClose={() => setModalNueva(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Nueva campaña</DialogTitle>
                <DialogContent dividers>
                    <SubirCampaña
                        onUploadSuccess={() => {
                            setModalNueva(false);
                            cargarCampañas();
                            setMensaje({ tipo: 'success', texto: 'Campaña subida correctamente' });
                        }}
                        setMensaje={setMensaje}
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!campañaSeleccionada}
                onClose={() => setCampañaSeleccionada(null)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Contactos de "{campañaSeleccionada?.nombre}"
                    <IconButton
                        aria-label="cerrar"
                        onClick={() => setCampañaSeleccionada(null)}
                        sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <List>
                        {campañaSeleccionada?.contactos.map((contacto, idx) => (
                            <ListItem key={idx}>
                                <ListItemText
                                    primary={`Número: ${contacto.numero}`}
                                    secondary={`Mensaje: ${contacto.mensaje}`}
                                />
                            </ListItem>
                        ))}
                        {campañaSeleccionada?.contactos.length === 0 && (
                            <Typography variant="body2">No hay contactos en esta campaña.</Typography>
                        )}
                    </List>
                </DialogContent>
            </Dialog>

            {campañaAEnviar && (
                <EnviarMensajesModal
                    open={modalEnvio}
                    onClose={() => {
                        cargarCampañas();
                        setModalEnvio(false);
                    }}
                    campaña={campañaAEnviar}
                />
            )}
        </>
    );
}