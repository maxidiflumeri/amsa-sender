import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, CircularProgress, FormControl, FormControlLabel, FormHelperText, IconButton, InputAdornment,
    InputLabel, MenuItem, Select, Switch, TablePagination, TextField, Typography,
} from '@mui/material';
import { Pencil, Plus, Search, Trash2, UserX, Users, X } from 'lucide-react';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import {
    AvatarUsuario, BloqueEstado, ConfirmDialog, DataTableResponsive, EmptyState, PageContainer, PageHeader,
    ResponsiveDialog, SectionCard, StatusChip,
} from '../ui';
import MenuMas from './MenuMas';

const POR_PAGINA = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORM_CREAR = { email: '', nombre: '', rolId: '' };

export default function GestionUsuarios() {
    const feedback = useFeedback();
    const [usuarios, setUsuarios] = useState([]);
    const [roles, setRoles] = useState([]);
    const [estado, setEstado] = useState('cargando'); // cargando | listo | error

    const [crearOpen, setCrearOpen] = useState(false);
    const [crearForm, setCrearForm] = useState(FORM_CREAR);
    const [crearErrores, setCrearErrores] = useState({});
    const [crearError, setCrearError] = useState('');
    const [crearLoading, setCrearLoading] = useState(false);

    const [editarUsuario, setEditarUsuario] = useState(null);
    const [editarForm, setEditarForm] = useState({ nombre: '', rolId: '', activo: true });
    const [editarInicial, setEditarInicial] = useState(null);
    const [editarError, setEditarError] = useState('');
    const [editarLoading, setEditarLoading] = useState(false);

    const [busqueda, setBusqueda] = useState('');
    const [page, setPage] = useState(0);

    const [eliminarUsuario, setEliminarUsuario] = useState(null);
    const [eliminarLoading, setEliminarLoading] = useState(false);
    const [eliminarError, setEliminarError] = useState('');

    const cargar = useCallback(async () => {
        setEstado((e) => (e === 'listo' ? e : 'cargando'));
        try {
            const [uRes, rRes] = await Promise.all([api.get('/usuarios'), api.get('/roles')]);
            setUsuarios(Array.isArray(uRes.data) ? uRes.data : []);
            setRoles(Array.isArray(rRes.data) ? rRes.data : []);
            setEstado('listo');
        } catch {
            setEstado('error');
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const filtrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return usuarios;
        return usuarios.filter((u) => u.nombre?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }, [usuarios, busqueda]);
    const pagina = filtrados.slice(page * POR_PAGINA, (page + 1) * POR_PAGINA);

    const abrirCrear = () => {
        setCrearForm(FORM_CREAR);
        setCrearErrores({});
        setCrearError('');
        setCrearOpen(true);
    };

    const handleCrear = async () => {
        const e = {};
        if (!EMAIL_RE.test(crearForm.email.trim())) e.email = 'Escribí un email válido.';
        if (!crearForm.nombre.trim()) e.nombre = 'Falta el nombre.';
        if (!crearForm.rolId) e.rolId = 'Elegí un rol.';
        setCrearErrores(e);
        if (Object.keys(e).length > 0) return;

        setCrearError('');
        setCrearLoading(true);
        try {
            await api.post('/usuarios', { ...crearForm, email: crearForm.email.trim(), rolId: Number(crearForm.rolId) });
            setCrearOpen(false);
            feedback.exito('Usuario creado. Ya puede entrar con Google.');
            await cargar();
        } catch (err) {
            setCrearError(mensajeDeError(err, 'No se pudo crear el usuario.'));
        } finally {
            setCrearLoading(false);
        }
    };

    const abrirEditar = (u) => {
        const base = { nombre: u.nombre || '', rolId: u.rolId || '', activo: u.activo };
        setEditarUsuario(u);
        setEditarForm(base);
        setEditarInicial(base);
        setEditarError('');
    };

    const handleEditar = async () => {
        setEditarError('');
        setEditarLoading(true);
        try {
            await api.patch(`/usuarios/${editarUsuario.id}`, {
                nombre: editarForm.nombre,
                rolId: Number(editarForm.rolId),
                activo: editarForm.activo,
            });
            setEditarUsuario(null);
            feedback.exito('Cambios guardados.');
            await cargar();
        } catch (err) {
            setEditarError(mensajeDeError(err, 'No se pudo actualizar el usuario.'));
        } finally {
            setEditarLoading(false);
        }
    };

    const handleEliminar = async () => {
        setEliminarError('');
        setEliminarLoading(true);
        try {
            await api.delete(`/usuarios/${eliminarUsuario.id}`);
            setEliminarUsuario(null);
            feedback.exito('Usuario eliminado.');
            await cargar();
        } catch (err) {
            // Se queda abierto el diálogo con el motivo, para que no se pierda detrás de nada.
            setEliminarError(mensajeDeError(err, 'No se pudo eliminar el usuario.'));
        } finally {
            setEliminarLoading(false);
        }
    };

    const rolDe = (u) => u.rolObj?.nombre || u.rol || '—';

    const columns = [
        {
            key: 'nombre',
            label: 'Nombre',
            primary: true,
            render: (u) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                    <AvatarUsuario nombre={u.nombre || u.email} foto={u.foto} size={32} />
                    <span>{u.nombre || '—'}</span>
                </Box>
            ),
        },
        { key: 'email', label: 'Email', secondary: true },
        { key: 'rol', label: 'Rol', render: (u) => <StatusChip label={rolDe(u)} tono="acento" /> },
        { key: 'activo', label: 'Estado', render: (u) => <StatusChip label={u.activo ? 'Activo' : 'Suspendido'} tono={u.activo ? 'ok' : 'neutro'} /> },
    ];

    const sucioEditar = !!editarInicial && JSON.stringify(editarForm) !== JSON.stringify(editarInicial);

    return (
        <PageContainer>
            <PageHeader
                title="Usuarios"
                subtitle="Quiénes pueden entrar a Sender y con qué rol."
                breadcrumbs={migasDe('/admin/usuarios')}
                actions={
                    <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={abrirCrear}>
                        Nuevo usuario
                    </Button>
                }
            />

            {estado === 'error' ? (
                <BloqueEstado estado="error" mensaje="No se pudieron cargar los usuarios." onReintentar={cargar} />
            ) : (
                <SectionCard noPadding>
                    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                        <TextField
                            fullWidth
                            placeholder="Buscar por nombre o email"
                            value={busqueda}
                            onChange={(e) => { setBusqueda(e.target.value); setPage(0); }}
                            sx={{ maxWidth: 420 }}
                            slotProps={{
                                htmlInput: { 'aria-label': 'Buscar por nombre o email' },
                                input: {
                                    startAdornment: <InputAdornment position="start"><Search size={18} strokeWidth={1.75} aria-hidden /></InputAdornment>,
                                    endAdornment: busqueda ? (
                                        <InputAdornment position="end">
                                            <IconButton aria-label="Limpiar la búsqueda" edge="end" onClick={() => { setBusqueda(''); setPage(0); }} sx={{ width: 44, height: 44 }}>
                                                <X size={18} strokeWidth={1.75} aria-hidden />
                                            </IconButton>
                                        </InputAdornment>
                                    ) : undefined,
                                },
                            }}
                        />
                    </Box>
                    <DataTableResponsive
                        ariaLabel="Usuarios"
                        columns={columns}
                        rows={pagina}
                        rowKey={(u) => u.id}
                        loading={estado === 'cargando'}
                        acciones={(u) => (
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                <Button startIcon={<Pencil size={16} strokeWidth={1.75} aria-hidden />} onClick={() => abrirEditar(u)}>
                                    Editar
                                </Button>
                                <MenuMas items={[{ label: 'Eliminar', icon: Trash2, peligro: true, onClick: () => { setEliminarError(''); setEliminarUsuario(u); } }]} />
                            </Box>
                        )}
                        empty={
                            busqueda ? (
                                <EmptyState compact icon={UserX} title="Sin resultados" description={`Ningún usuario coincide con "${busqueda}".`} />
                            ) : (
                                <EmptyState compact icon={Users} title="Todavía no hay usuarios" action={{ label: 'Nuevo usuario', onClick: abrirCrear }} />
                            )
                        }
                    />
                    {estado === 'listo' && filtrados.length > POR_PAGINA && (
                        <TablePagination
                            component="div"
                            count={filtrados.length}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            rowsPerPage={POR_PAGINA}
                            rowsPerPageOptions={[POR_PAGINA]}
                            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                        />
                    )}
                </SectionCard>
            )}

            <ResponsiveDialog
                open={crearOpen}
                onClose={() => setCrearOpen(false)}
                maxWidth="xs"
                sucio={JSON.stringify(crearForm) !== JSON.stringify(FORM_CREAR) && !crearLoading}
                title="Nuevo usuario"
                actions={
                    <>
                        <Button onClick={() => setCrearOpen(false)} disabled={crearLoading}>Cancelar</Button>
                        <Button
                            variant="contained"
                            onClick={handleCrear}
                            disabled={crearLoading}
                            startIcon={crearLoading ? <CircularProgress size={16} color="inherit" /> : null}
                        >
                            {crearLoading ? 'Creando…' : 'Crear usuario'}
                        </Button>
                    </>
                }
            >
                <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); handleCrear(); }} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
                    {crearError && <Alert severity="error" role="alert">{crearError}</Alert>}
                    <Alert severity="info">La persona entra con Google usando este email.</Alert>
                    <TextField
                        label="Email"
                        type="email"
                        value={crearForm.email}
                        onChange={(e) => { setCrearForm((f) => ({ ...f, email: e.target.value })); setCrearErrores((x) => ({ ...x, email: undefined })); }}
                        fullWidth
                        required
                        error={!!crearErrores.email}
                        helperText={crearErrores.email}
                        slotProps={{ htmlInput: { inputMode: 'email', autoCapitalize: 'off' } }}
                    />
                    <TextField
                        label="Nombre"
                        value={crearForm.nombre}
                        onChange={(e) => { setCrearForm((f) => ({ ...f, nombre: e.target.value })); setCrearErrores((x) => ({ ...x, nombre: undefined })); }}
                        fullWidth
                        required
                        error={!!crearErrores.nombre}
                        helperText={crearErrores.nombre ?? 'Se actualiza con el nombre de Google cuando entre.'}
                    />
                    <FormControl fullWidth required error={!!crearErrores.rolId}>
                        <InputLabel id="crear-rol">Rol</InputLabel>
                        <Select
                            labelId="crear-rol"
                            value={crearForm.rolId}
                            label="Rol"
                            onChange={(e) => { setCrearForm((f) => ({ ...f, rolId: e.target.value })); setCrearErrores((x) => ({ ...x, rolId: undefined })); }}
                        >
                            {roles.map((r) => <MenuItem key={r.id} value={r.id} sx={{ minHeight: 44 }}>{r.nombre}</MenuItem>)}
                        </Select>
                        {crearErrores.rolId && <FormHelperText>{crearErrores.rolId}</FormHelperText>}
                    </FormControl>
                </Box>
            </ResponsiveDialog>

            <ResponsiveDialog
                open={!!editarUsuario}
                onClose={() => setEditarUsuario(null)}
                maxWidth="xs"
                sucio={sucioEditar && !editarLoading}
                title="Editar usuario"
                actions={
                    <>
                        <Button onClick={() => setEditarUsuario(null)} disabled={editarLoading}>Cancelar</Button>
                        <Button
                            variant="contained"
                            onClick={handleEditar}
                            disabled={editarLoading || !editarForm.rolId}
                            startIcon={editarLoading ? <CircularProgress size={16} color="inherit" /> : null}
                        >
                            {editarLoading ? 'Guardando…' : 'Guardar'}
                        </Button>
                    </>
                }
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
                    {editarError && <Alert severity="error" role="alert">{editarError}</Alert>}
                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{editarUsuario?.email}</Typography>
                    <TextField
                        label="Nombre"
                        value={editarForm.nombre}
                        onChange={(e) => setEditarForm((f) => ({ ...f, nombre: e.target.value }))}
                        fullWidth
                    />
                    <FormControl fullWidth>
                        <InputLabel id="editar-rol">Rol</InputLabel>
                        <Select
                            labelId="editar-rol"
                            value={editarForm.rolId}
                            label="Rol"
                            onChange={(e) => setEditarForm((f) => ({ ...f, rolId: e.target.value }))}
                        >
                            {roles.map((r) => <MenuItem key={r.id} value={r.id} sx={{ minHeight: 44 }}>{r.nombre}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        sx={{ minHeight: 44, mx: 0 }}
                        control={
                            <Switch
                                checked={editarForm.activo}
                                onChange={(e) => setEditarForm((f) => ({ ...f, activo: e.target.checked }))}
                                color="success"
                            />
                        }
                        label={editarForm.activo ? 'Activo' : 'Suspendido: no puede entrar'}
                    />
                </Box>
            </ResponsiveDialog>

            <ConfirmDialog
                open={!!eliminarUsuario}
                titulo="¿Eliminar el usuario?"
                mensaje={<>Se elimina a <strong>{eliminarUsuario?.nombre || eliminarUsuario?.email}</strong> y deja de poder entrar. Esta acción no se puede deshacer.</>}
                confirmarTexto="Eliminar"
                peligro
                cargando={eliminarLoading}
                onConfirmar={handleEliminar}
                onCancelar={() => setEliminarUsuario(null)}
            >
                {eliminarError && <Alert severity="error" role="alert">{eliminarError}</Alert>}
            </ConfirmDialog>
        </PageContainer>
    );
}
