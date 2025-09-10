// src/components/email/TabDesuscripciones.jsx
import { useEffect, useRef, useState } from 'react';
import {
    Box,
    Card,
    CardHeader,
    CardContent,
    Stack,
    TextField,
    InputAdornment,
    IconButton,
    Tooltip,
    Button,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TableContainer,
    TablePagination,
    LinearProgress,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Grid,
    Snackbar,
    Alert,
    Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import CloseIcon from '@mui/icons-material/Close';
import UnsubscribeIcon from '@mui/icons-material/Unsubscribe';

// Si ya tenés un cliente axios con auth, reemplazá por tu import:
// import { api } from '@/services/api';
import api from '../../api/axios';

export default function VerDesuscripcionesEmail({ tenantId, pageSizeDefault = 25 }) {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(pageSizeDefault);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const [snack, setSnack] = useState({ open: false, msg: '', sev: 'info' });

    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [confirmClearAll, setConfirmClearAll] = useState(false);
    const [openAdd, setOpenAdd] = useState(false);

    const [addEmail, setAddEmail] = useState('');
    const [addScope, setAddScope] = useState('global');
    const [addCampaignId, setAddCampaignId] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // debounce búsqueda
    const debounceRef = useRef(null);
    const [debouncedQuery, setDebouncedQuery] = useState('');

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedQuery(query.trim());
            setPage(0);
        }, 350);
        return () => debounceRef.current && clearTimeout(debounceRef.current);
    }, [query]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = { page, size: rowsPerPage };
            if (debouncedQuery) params.q = debouncedQuery;
            if (tenantId) params.tenantId = tenantId;

            const { data } = await api.get('/email/desuscripciones/unsubscribes', { params });
            setRows(data.items || []);
            setTotal(data.total ?? 0);
        } catch (e) {
            setSnack({
                open: true,
                msg: e?.response?.data?.message || 'Error al cargar desuscripciones',
                sev: 'error',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, debouncedQuery]);

    const onChangeQuery = (v) => setQuery(v);

    const handleDelete = async (id) => {
        try {
            await api.delete(`/email/desuscripciones/unsubscribes/${id}`, {
                params: tenantId ? { tenantId } : undefined,
            });
            setSnack({ open: true, msg: 'Desuscripción eliminada', sev: 'success' });
            const newCount = total - 1;
            const newLastPage = Math.max(0, Math.ceil(newCount / rowsPerPage) - 1);
            if (page > newLastPage) setPage(newLastPage);
            await fetchData();
        } catch (e) {
            setSnack({
                open: true,
                msg: e?.response?.data?.message || 'Error eliminando desuscripción',
                sev: 'error',
            });
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const handleClearAll = async () => {
        try {
            await api.delete('/email/desuscripciones/unsubscribes', {
                params: tenantId ? { tenantId } : undefined,
            });
            setSnack({
                open: true,
                msg: 'Se limpiaron todas las desuscripciones',
                sev: 'success',
            });
            setPage(0);
            await fetchData();
        } catch (e) {
            setSnack({
                open: true,
                msg: e?.response?.data?.message || 'Error limpiando desuscripciones',
                sev: 'error',
            });
        } finally {
            setConfirmClearAll(false);
        }
    };

    const handleAdd = async () => {
        if (!addEmail.trim()) {
            setSnack({ open: true, msg: 'Ingresá un email válido', sev: 'error' });
            return;
        }
        if (addScope === 'campaign' && !addCampaignId.trim()) {
            setSnack({ open: true, msg: 'Para "campaign" necesitás CampaignId', sev: 'error' });
            return;
        }

        setSubmitting(true);
        try {
            const body = {
                email: addEmail.trim(),
                scope: addScope,
                reason: 'admin_add',
                source: 'manual',
                campaignId: addScope === 'campaign' ? addCampaignId.trim() : '',
            };

            await api.post('/email/desuscripciones/unsubscribes', body, {
                params: tenantId ? { tenantId } : undefined,
            });

            setSnack({ open: true, msg: 'Desuscripción agregada', sev: 'success' });
            setOpenAdd(false);
            setAddEmail('');
            setAddScope('global');
            setAddCampaignId('');
            setPage(0);
            await fetchData();
        } catch (e) {
            setSnack({
                open: true,
                msg: e?.response?.data?.message || 'Error agregando desuscripción',
                sev: 'error',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card sx={{ my: 3 }} elevation={3}>
            <CardHeader
                avatar={<UnsubscribeIcon sx={{ fontSize: 32 }} />}
                title="Desuscripciones"
                titleTypographyProps={{
                    variant: 'h5', // h4/h5/h6 según prefieras
                    sx: {
                        fontWeight: "bold",
                        fontSize: { xs: 22, sm: 24, md: 26 }, // tamaño responsive                      
                    },
                }}
                subheader="Listado de emails desuscriptos (globales y por campaña)"
                action={
                    <Stack direction="row" spacing={1}>
                        <Tooltip title="Agregar desuscripción manual">
                            <span>
                                <Button
                                    variant="contained"
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
                                    startIcon={<AddIcon />}
                                    onClick={() => setOpenAdd(true)}>
                                    Agregar
                                </Button>
                            </span>
                        </Tooltip>
                        <Tooltip title="Limpiar todas las desuscripciones">
                            <span>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    startIcon={<CleaningServicesIcon />}
                                    onClick={() => setConfirmClearAll(true)}
                                >
                                    Limpiar todas
                                </Button>
                            </span>
                        </Tooltip>
                    </Stack>
                }
            />
            <Divider />
            <CardContent>
                <Stack spacing={2}>
                    <TextField
                        fullWidth
                        placeholder="Buscar por email…"
                        value={query}
                        onChange={(e) => onChangeQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                            endAdornment: query ? (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => onChangeQuery('')}>
                                        <CloseIcon />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        }}
                    />

                    <Box position="relative">
                        {loading && <LinearProgress sx={{ position: 'absolute', top: -8, left: 0, right: 0 }} />}
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Scope</TableCell>
                                        <TableCell>Campaña</TableCell>
                                        <TableCell>Motivo</TableCell>
                                        <TableCell>Fuente</TableCell>
                                        <TableCell>Fecha</TableCell>
                                        <TableCell align="right">Acciones</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                No hay desuscripciones.
                                            </TableCell>
                                        </TableRow>
                                    )}

                                    {rows.map((r) => (
                                        <TableRow key={r.id} hover>
                                            <TableCell>{r.email}</TableCell>
                                            <TableCell>
                                                <Chip size="small" label={r.scope === 'campaign' ? 'campaign' : 'global'} variant="outlined" />
                                            </TableCell>
                                            <TableCell>{r.scope === 'campaign' ? (r.campaignId || '—') : '—'}</TableCell>
                                            <TableCell>{r.reason || '—'}</TableCell>
                                            <TableCell>{r.source || '—'}</TableCell>
                                            <TableCell>{new Date(r.createdAt).toLocaleString('es-AR')}</TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Eliminar desuscripción">
                                                    <IconButton color="error" onClick={() => setConfirmDeleteId(r.id)}>
                                                        <DeleteOutlineIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <TablePagination
                            component="div"
                            count={total}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(e) => {
                                setRowsPerPage(parseInt(e.target.value, 10));
                                setPage(0);
                            }}
                            rowsPerPageOptions={[10, 25, 50, 100]}
                            labelRowsPerPage="Filas por página"
                        />
                    </Box>
                </Stack>
            </CardContent>

            {/* Dialog Eliminar */}
            <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Eliminar desuscripción</DialogTitle>
                <DialogContent>¿Seguro que querés eliminar esta desuscripción?</DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
                    <Button color="error" variant="contained" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Limpiar todas */}
            <Dialog open={confirmClearAll} onClose={() => setConfirmClearAll(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Limpiar todas las desuscripciones</DialogTitle>
                <DialogContent>Esto eliminará todas las desuscripciones del tenant actual. ¿Deseás continuar?</DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmClearAll(false)}>Cancelar</Button>
                    <Button color="error" variant="contained" onClick={handleClearAll}>
                        Limpiar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Agregar manual */}
            <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Agregar desuscripción</DialogTitle>

                <DialogContent sx={{ pt: 1 }}>
                    <Stack spacing={2}>
                        {/* Fila 1: Email full width */}
                        <TextField
                            fullWidth
                            label="Email"
                            value={addEmail}
                            onChange={(e) => setAddEmail(e.target.value)}
                            placeholder="usuario@dominio.com"
                            autoFocus
                        />

                        {/* Fila 2: Scope centrado */}
                        <FormControl sx={{ width: '100%' }}>
                            <FormLabel sx={{ textAlign: 'center', mb: 1 }}>Scope</FormLabel>
                            <RadioGroup
                                row
                                value={addScope}
                                onChange={(_, v) => setAddScope(v)}
                                sx={{ justifyContent: 'center' }}  // centra horizontalmente
                            >
                                <FormControlLabel value="global" control={<Radio />} label="Global" />
                                <FormControlLabel value="campaign" control={<Radio />} label="Por campaña" />
                            </RadioGroup>
                        </FormControl>

                        {/* Fila 3 (opcional): Campaign ID full width */}
                        {addScope === 'campaign' && (
                            <TextField
                                fullWidth
                                label="Campaign ID"
                                value={addCampaignId}
                                onChange={(e) => setAddCampaignId(e.target.value)}
                            />
                        )}
                    </Stack>
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setOpenAdd(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={handleAdd} disabled={submitting}>
                        {submitting ? 'Guardando…' : 'Guardar'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snack.sev} sx={{ width: '100%' }}>
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Card>
    );
}