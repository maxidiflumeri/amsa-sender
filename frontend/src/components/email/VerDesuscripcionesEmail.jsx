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
    useMediaQuery
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
    const isMobile = useMediaQuery('(max-width:768px)');
    const isTablet = useMediaQuery('(max-width:1024px)');

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
                avatar={<UnsubscribeIcon sx={{ fontSize: { xs: 26, md: 32 } }} />}
                title="Desuscripciones"
                titleTypographyProps={{
                    variant: isMobile ? 'h6' : 'h5',
                    sx: {
                        fontWeight: 'bold',
                        fontSize: { xs: 20, sm: 22, md: 26 },
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    },
                }}
                subheader="Listado de emails desuscriptos (globales y por campaña)"
                subheaderTypographyProps={{
                    sx: {
                        display: { xs: 'none', sm: 'block' }, // 👈 oculto en XS
                        whiteSpace: 'normal',
                    },
                }}
                sx={{
                    '& .MuiCardHeader-content': { minWidth: 0, gridArea: { xs: 'content' } },
                    '& .MuiCardHeader-avatar': { gridArea: { xs: 'avatar' } },
                    '& .MuiCardHeader-action': {
                        gridArea: { xs: 'action' },
                        alignSelf: { xs: 'stretch', sm: 'center' },
                        ml: { xs: 0, sm: 1 },
                        mt: { xs: 1, sm: 0 },
                        width: { xs: '100%', sm: 'auto' },
                    },
                    display: { xs: 'grid', sm: 'flex' },              // 👈 grid en XS
                    gridTemplateColumns: { xs: 'auto 1fr' },
                    gridTemplateAreas: { xs: `"avatar content" "action action"` },
                    alignItems: { xs: 'start', sm: 'center' },
                    rowGap: { xs: 0.5, sm: 0 },
                }}
                action={
                    <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        flexWrap="wrap"
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                        <Tooltip title="Agregar desuscripción manual">
                            <span>
                                <Button
                                    size="small"                // 👈 más compacto en móvil
                                    fullWidth={isMobile}        // 👈 ocupa todo el ancho en XS
                                    variant="contained"
                                    sx={{
                                        borderRadius: 2,
                                        textTransform: 'none',
                                        backgroundColor: '#075E54',
                                        '&:hover': {
                                            backgroundColor: '#0b7b65',
                                            transform: { md: 'scale(1.03)' },
                                            boxShadow: 4,
                                        },
                                    }}
                                    startIcon={<AddIcon />}
                                    onClick={() => setOpenAdd(true)}
                                >
                                    Agregar
                                </Button>
                            </span>
                        </Tooltip>

                        <Tooltip title="Limpiar todas las desuscripciones">
                            <span>
                                <Button
                                    size="small"                // 👈 compacto
                                    fullWidth={isMobile}        // 👈 ocupa todo el ancho en XS
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
            {/* Subheader solo XS para que no se corte */}
            <Box
                sx={{
                    display: { xs: 'block', sm: 'none' },
                    px: 2,
                    mt: -0.5,
                    mb: 1,
                    color: 'text.secondary',
                    fontSize: 14,
                }}
            >
                Listado de emails desuscriptos (globales y por campaña)
            </Box>
            <Divider />
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={2}>
                    <TextField
                        fullWidth
                        size={isMobile ? 'small' : 'medium'}
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
                        {loading && <LinearProgress sx={{ position: 'absolute', top: -8, left: 0, right: 0, borderRadius: 1 }} />}

                        {/* Contenedor con scroll horizontal y header sticky */}
                        <TableContainer
                            component={Box}
                            sx={{
                                overflowX: 'auto',
                                borderRadius: 2,
                                border: (theme) => `1px solid ${theme.palette.divider}`
                            }}
                        >
                            <Table size={isMobile ? 'small' : 'small'} stickyHeader sx={{ minWidth: 800 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ minWidth: 220 }}>Email</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Scope</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Campaña</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Motivo</TableCell>
                                        <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Fuente</TableCell>
                                        <TableCell sx={{ minWidth: 170 }}>Fecha</TableCell>
                                        <TableCell align="right" sx={{ minWidth: 110 }}>Acciones</TableCell>
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
                                            <TableCell sx={{ maxWidth: { xs: 260, sm: 'unset' } }}>
                                                <Box sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{r.email}</Box>

                                                {/* Sub-info compacta solo en mobile cuando ocultamos columnas */}
                                                <Box sx={{ display: { xs: 'block', sm: 'none' }, mt: 0.5 }}>
                                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                                                        <Chip size="small" variant="outlined" label={r.scope === 'campaign' ? 'campaign' : 'global'} />
                                                        {r.scope === 'campaign' && (
                                                            <Chip size="small" variant="outlined" label={`Campaña ${r.campaignId || '—'}`} />
                                                        )}
                                                    </Stack>
                                                    <Box sx={{ mt: 0.25, color: 'text.secondary', fontSize: 12 }}>
                                                        {new Date(r.createdAt).toLocaleString('es-AR')}
                                                    </Box>
                                                </Box>
                                            </TableCell>

                                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                                <Chip size="small" label={r.scope === 'campaign' ? 'campaign' : 'global'} variant="outlined" />
                                            </TableCell>

                                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {r.scope === 'campaign' ? (r.campaignId || '—') : '—'}
                                            </TableCell>

                                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {r.reason || '—'}
                                            </TableCell>

                                            <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {r.source || '—'}
                                            </TableCell>

                                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                                {new Date(r.createdAt).toLocaleString('es-AR')}
                                            </TableCell>

                                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                <Tooltip title="Eliminar desuscripción">
                                                    <IconButton
                                                        color="error"
                                                        size={isMobile ? 'small' : 'medium'}
                                                        onClick={() => setConfirmDeleteId(r.id)}
                                                    >
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
                            rowsPerPageOptions={isMobile ? [10, 25, 50] : [10, 25, 50, 100]}
                            labelRowsPerPage="Filas por página"
                            sx={{
                                '.MuiTablePagination-toolbar': { px: { xs: 0.5, sm: 2 } },
                                '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                                    fontSize: { xs: 12, sm: 14 }
                                }
                            }}
                        />
                    </Box>
                </Stack>
            </CardContent>

            {/* Dialog Eliminar */}
            <Dialog
                open={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { maxHeight: { xs: '90vh', md: '80vh' } } }}
            >
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
            <Dialog
                open={confirmClearAll}
                onClose={() => setConfirmClearAll(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { maxHeight: { xs: '90vh', md: '80vh' } } }}
            >
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
            <Dialog
                open={openAdd}
                onClose={() => setOpenAdd(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { maxHeight: { xs: '92vh', md: '85vh' } } }}
            >
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
                            size={isMobile ? 'small' : 'medium'}
                        />

                        {/* Fila 2: Scope centrado */}
                        <FormControl sx={{ width: '100%' }}>
                            <FormLabel sx={{ textAlign: 'center', mb: 1 }}>Scope</FormLabel>
                            <RadioGroup
                                row
                                value={addScope}
                                onChange={(_, v) => setAddScope(v)}
                                sx={{ justifyContent: 'center' }}
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
                                size={isMobile ? 'small' : 'medium'}
                            />
                        )}
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 } }}>
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