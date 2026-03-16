import { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, IconButton, Chip, Button, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
    InputLabel, Tooltip, CircularProgress, Alert, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../api/axios';

export default function GestionUsuarios() {
    const [usuarios, setUsuarios] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Dialog crear
    const [crearOpen, setCrearOpen] = useState(false);
    const [crearForm, setCrearForm] = useState({ email: '', nombre: '', rolId: '' });
    const [crearError, setCrearError] = useState('');
    const [crearLoading, setCrearLoading] = useState(false);

    // Dialog editar
    const [editarOpen, setEditarOpen] = useState(false);
    const [editarUsuario, setEditarUsuario] = useState(null);
    const [editarForm, setEditarForm] = useState({ nombre: '', rolId: '', activo: true });
    const [editarError, setEditarError] = useState('');
    const [editarLoading, setEditarLoading] = useState(false);

    // Dialog eliminar
    const [eliminarOpen, setEliminarOpen] = useState(false);
    const [eliminarUsuario, setEliminarUsuario] = useState(null);
    const [eliminarLoading, setEliminarLoading] = useState(false);
    const [eliminarError, setEliminarError] = useState('');

    const cargar = async () => {
        try {
            setLoading(true);
            const [uRes, rRes] = await Promise.all([api.get('/usuarios'), api.get('/roles')]);
            setUsuarios(uRes.data);
            setRoles(rRes.data);
        } catch {
            setError('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    const handleCrear = async () => {
        setCrearError('');
        if (!crearForm.email || !crearForm.nombre || !crearForm.rolId) {
            setCrearError('Todos los campos son obligatorios.');
            return;
        }
        setCrearLoading(true);
        try {
            await api.post('/usuarios', { ...crearForm, rolId: Number(crearForm.rolId) });
            setCrearOpen(false);
            setCrearForm({ email: '', nombre: '', rolId: '' });
            await cargar();
        } catch (e) {
            setCrearError(e.response?.data?.message || 'Error al crear usuario');
        } finally {
            setCrearLoading(false);
        }
    };

    const abrirEditar = (u) => {
        setEditarUsuario(u);
        setEditarForm({ nombre: u.nombre || '', rolId: u.rolId || '', activo: u.activo });
        setEditarError('');
        setEditarOpen(true);
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
            setEditarOpen(false);
            await cargar();
        } catch (e) {
            setEditarError(e.response?.data?.message || 'Error al actualizar usuario');
        } finally {
            setEditarLoading(false);
        }
    };

    const abrirEliminar = (u) => {
        setEliminarUsuario(u);
        setEliminarError('');
        setEliminarOpen(true);
    };

    const handleEliminar = async () => {
        setEliminarError('');
        setEliminarLoading(true);
        try {
            await api.delete(`/usuarios/${eliminarUsuario.id}`);
            setEliminarOpen(false);
            await cargar();
        } catch (e) {
            setEliminarError(e.response?.data?.message || 'Error al eliminar usuario');
        } finally {
            setEliminarLoading(false);
        }
    };

    if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress /></Box>;

    return (
        <Box py={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight="bold">Gestión de usuarios</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setCrearError(''); setCrearOpen(true); }}>
                    Nuevo usuario
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Nombre</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Rol</TableCell>
                            <TableCell>Estado</TableCell>
                            <TableCell align="right">Acciones</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {usuarios.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell>{u.nombre || '—'}</TableCell>
                                <TableCell>{u.email}</TableCell>
                                <TableCell>
                                    <Chip label={u.rolObj?.nombre || u.rol || '—'} size="small" />
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={u.activo ? 'Activo' : 'Suspendido'}
                                        color={u.activo ? 'success' : 'default'}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell align="right">
                                    <Tooltip title="Editar">
                                        <IconButton size="small" onClick={() => abrirEditar(u)}>
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Eliminar">
                                        <IconButton size="small" color="error" onClick={() => abrirEliminar(u)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                        {usuarios.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} align="center">No hay usuarios</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Dialog Crear */}
            <Dialog open={crearOpen} onClose={() => setCrearOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Nuevo usuario</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} mt={1}>
                        {crearError && <Alert severity="error">{crearError}</Alert>}
                        <TextField
                            label="Email"
                            value={crearForm.email}
                            onChange={(e) => setCrearForm(f => ({ ...f, email: e.target.value }))}
                            type="email"
                            fullWidth
                        />
                        <TextField
                            label="Nombre"
                            value={crearForm.nombre}
                            onChange={(e) => setCrearForm(f => ({ ...f, nombre: e.target.value }))}
                            fullWidth
                        />
                        <FormControl fullWidth>
                            <InputLabel>Rol</InputLabel>
                            <Select
                                value={crearForm.rolId}
                                label="Rol"
                                onChange={(e) => setCrearForm(f => ({ ...f, rolId: e.target.value }))}
                            >
                                {roles.map(r => (
                                    <MenuItem key={r.id} value={r.id}>{r.nombre}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCrearOpen(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={handleCrear} disabled={crearLoading}>
                        {crearLoading ? <CircularProgress size={18} /> : 'Crear'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Editar */}
            <Dialog open={editarOpen} onClose={() => setEditarOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Editar usuario</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} mt={1}>
                        {editarError && <Alert severity="error">{editarError}</Alert>}
                        <TextField
                            label="Nombre"
                            value={editarForm.nombre}
                            onChange={(e) => setEditarForm(f => ({ ...f, nombre: e.target.value }))}
                            fullWidth
                        />
                        <FormControl fullWidth>
                            <InputLabel>Rol</InputLabel>
                            <Select
                                value={editarForm.rolId}
                                label="Rol"
                                onChange={(e) => setEditarForm(f => ({ ...f, rolId: e.target.value }))}
                            >
                                {roles.map(r => (
                                    <MenuItem key={r.id} value={r.id}>{r.nombre}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={editarForm.activo}
                                    onChange={(e) => setEditarForm(f => ({ ...f, activo: e.target.checked }))}
                                    color="success"
                                />
                            }
                            label={editarForm.activo ? 'Activo' : 'Suspendido'}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditarOpen(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={handleEditar} disabled={editarLoading}>
                        {editarLoading ? <CircularProgress size={18} /> : 'Guardar'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Eliminar */}
            <Dialog open={eliminarOpen} onClose={() => setEliminarOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Eliminar usuario</DialogTitle>
                <DialogContent>
                    {eliminarError && <Alert severity="error" sx={{ mb: 1 }}>{eliminarError}</Alert>}
                    <Typography>
                        ¿Seguro que querés eliminar a <strong>{eliminarUsuario?.nombre || eliminarUsuario?.email}</strong>?
                        Esta acción no se puede deshacer.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEliminarOpen(false)}>Cancelar</Button>
                    <Button variant="contained" color="error" onClick={handleEliminar} disabled={eliminarLoading}>
                        {eliminarLoading ? <CircularProgress size={18} /> : 'Eliminar'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
