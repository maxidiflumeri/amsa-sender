import { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, IconButton, Chip, Button, Dialog,
    DialogTitle, DialogContent, DialogActions, TextField, Tooltip,
    CircularProgress, Alert, Checkbox, FormControlLabel, Divider,
    LinearProgress, useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import MailIcon from '@mui/icons-material/Mail';
import SettingsIcon from '@mui/icons-material/Settings';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ShieldIcon from '@mui/icons-material/Shield';
import ApiIcon from '@mui/icons-material/Api';
import InboxIcon from '@mui/icons-material/Inbox';
import api from '../../api/axios';

const TODOS_LOS_PERMISOS = [
    {
        seccion: 'WhatsApp',
        items: [
            { key: 'whatsapp.sesiones', label: 'Sesiones' },
            { key: 'whatsapp.conectar', label: 'Conectar' },
            { key: 'whatsapp.campanias', label: 'Campañas' },
            { key: 'whatsapp.templates', label: 'Templates' },
            { key: 'whatsapp.reportes', label: 'Reportes' },
            { key: 'whatsapp.metricas', label: 'Métricas' },
        ],
    },
    {
        seccion: 'Email',
        items: [
            { key: 'email.cuentas_smtp', label: 'Cuentas SMTP' },
            { key: 'email.templates', label: 'Templates' },
            { key: 'email.campanias', label: 'Campañas' },
            { key: 'email.envio_manual', label: 'Envío Manual' },
            { key: 'email.reportes', label: 'Reportes' },
            { key: 'email.desuscripciones', label: 'Desuscripciones' },
        ],
    },
    {
        seccion: 'Configuración',
        items: [
            { key: 'config.tareas_programadas', label: 'Tareas programadas' },
        ],
    },
    {
        seccion: 'Admin',
        items: [
            { key: 'admin.usuarios', label: 'Usuarios y roles' },
        ],
    },
    {
        seccion: 'WhatsApp API',
        items: [
            { key: 'wapi.config', label: 'Configuración' },
            { key: 'wapi.templates', label: 'Templates' },
            { key: 'wapi.campanias', label: 'Campañas' },
            { key: 'wapi.bajas', label: 'Bajas' },
            { key: 'wapi.analitica', label: 'Analítica y reportes' },
        ],
    },
    {
        seccion: 'Inbox WA',
        items: [
            { key: 'wapi.inbox', label: 'Ver conversaciones propias' },
            { key: 'wapi.inbox.admin', label: 'Admin inbox (todas + reasignar)' },
        ],
    },
];

function PermisosEditor({ permisos, onChange }) {
    const toggle = (key) => {
        if (permisos.includes(key)) {
            onChange(permisos.filter(p => p !== key));
        } else {
            onChange([...permisos, key]);
        }
    };

    const toggleSeccion = (items) => {
        const keys = items.map(i => i.key);
        const allChecked = keys.every(k => permisos.includes(k));
        if (allChecked) {
            onChange(permisos.filter(p => !keys.includes(p)));
        } else {
            onChange([...new Set([...permisos, ...keys])]);
        }
    };

    return (
        <Box display="flex" flexDirection="column" gap={1.5}>
            {TODOS_LOS_PERMISOS.map(({ seccion, items }) => {
                const keys = items.map(i => i.key);
                const allChecked = keys.every(k => permisos.includes(k));
                const someChecked = keys.some(k => permisos.includes(k));
                return (
                    <Box key={seccion}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={allChecked}
                                    indeterminate={someChecked && !allChecked}
                                    onChange={() => toggleSeccion(items)}
                                    size="small"
                                />
                            }
                            label={<Typography fontWeight="bold" fontSize={14}>{seccion}</Typography>}
                        />
                        <Box display="flex" flexWrap="wrap" gap={0.5} pl={3}>
                            {items.map(({ key, label }) => (
                                <FormControlLabel
                                    key={key}
                                    control={
                                        <Checkbox
                                            checked={permisos.includes(key)}
                                            onChange={() => toggle(key)}
                                            size="small"
                                        />
                                    }
                                    label={<Typography fontSize={13}>{label}</Typography>}
                                    sx={{ mr: 1 }}
                                />
                            ))}
                        </Box>
                        <Divider sx={{ mt: 1 }} />
                    </Box>
                );
            })}
        </Box>
    );
}

const SECCION_META = [
    {
        key: 'whatsapp',
        label: 'WhatsApp',
        icon: <WhatsAppIcon sx={{ fontSize: 14 }} />,
        color: '#4caf50',
        bg: '#E8F5E9',
        permisos: ['whatsapp.sesiones', 'whatsapp.conectar', 'whatsapp.campanias', 'whatsapp.templates', 'whatsapp.reportes', 'whatsapp.metricas'],
    },
    {
        key: 'email',
        label: 'Email',
        icon: <MailIcon sx={{ fontSize: 14 }} />,
        color: '#1976d2',
        bg: '#E3F2FD',
        permisos: ['email.cuentas_smtp', 'email.templates', 'email.campanias', 'email.envio_manual', 'email.reportes', 'email.desuscripciones'],
    },
    {
        key: 'config',
        label: 'Config',
        icon: <SettingsIcon sx={{ fontSize: 14 }} />,
        color: '#607d8b',
        bg: '#ECEFF1',
        permisos: ['config.tareas_programadas'],
    },
    {
        key: 'admin',
        label: 'Admin',
        icon: <AdminPanelSettingsIcon sx={{ fontSize: 14 }} />,
        color: '#c2185b',
        bg: '#FCE4EC',
        permisos: ['admin.usuarios'],
    },
    {
        key: 'wapi',
        label: 'WA API',
        icon: <ApiIcon sx={{ fontSize: 14 }} />,
        color: '#00695C',
        bg: '#E0F2F1',
        permisos: ['wapi.config', 'wapi.templates', 'wapi.campanias', 'wapi.bajas'],
    },
    {
        key: 'inbox',
        label: 'Inbox WA',
        icon: <InboxIcon sx={{ fontSize: 14 }} />,
        color: '#E65100',
        bg: '#FFF3E0',
        permisos: ['wapi.inbox', 'wapi.inbox.admin'],
    },
];

const TOTAL_PERMISOS = SECCION_META.reduce((acc, s) => acc + s.permisos.length, 0);

function RolCard({ rol, onEditar, onEliminar }) {
    const theme = useTheme();
    const permisos = rol.permisos || [];
    const pct = Math.round((permisos.length / TOTAL_PERMISOS) * 100);

    const accentColor = pct === 100 ? '#4caf50' : pct >= 50 ? '#1976d2' : '#607d8b';

    return (
        <Box
            sx={{
                borderRadius: 3,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper',
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                transition: 'box-shadow 0.2s ease',
                '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.13)' },
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header con acento */}
            <Box sx={{ height: 5, backgroundColor: accentColor }} />

            <Box sx={{ p: 2.5, flexGrow: 1 }}>
                {/* Nombre + usuarios */}
                <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                        <Box
                            sx={{
                                width: 40, height: 40, borderRadius: 2,
                                backgroundColor: accentColor + '18',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <ShieldIcon sx={{ color: accentColor, fontSize: 22 }} />
                        </Box>
                        <Box>
                            <Typography fontWeight="bold" fontSize={16} sx={{ textTransform: 'capitalize' }}>
                                {rol.nombre}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={0.5}>
                                <PeopleIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                    {rol.cantidadUsuarios} {rol.cantidadUsuarios === 1 ? 'usuario' : 'usuarios'}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                    <Chip
                        label={`${permisos.length}/${TOTAL_PERMISOS}`}
                        size="small"
                        sx={{
                            fontWeight: 'bold',
                            fontSize: 11,
                            backgroundColor: accentColor + '18',
                            color: accentColor,
                            border: `1px solid ${accentColor}40`,
                        }}
                    />
                </Box>

                {/* Barra de progreso total */}
                <Box mb={2}>
                    <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                            height: 6, borderRadius: 3,
                            backgroundColor: theme.palette.mode === 'dark' ? '#333' : '#eee',
                            '& .MuiLinearProgress-bar': { backgroundColor: accentColor, borderRadius: 3 },
                        }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {pct}% de acceso
                    </Typography>
                </Box>

                {/* Secciones */}
                <Box display="flex" flexDirection="column" gap={1}>
                    {SECCION_META.map((s) => {
                        const habilitados = s.permisos.filter(p => permisos.includes(p)).length;
                        const total = s.permisos.length;
                        const activo = habilitados > 0;
                        return (
                            <Box key={s.key} display="flex" alignItems="center" justifyContent="space-between">
                                <Box display="flex" alignItems="center" gap={1}>
                                    <Box
                                        sx={{
                                            width: 22, height: 22, borderRadius: 1,
                                            backgroundColor: activo ? s.bg : (theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5'),
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: activo ? s.color : 'text.disabled',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {s.icon}
                                    </Box>
                                    <Typography
                                        fontSize={12}
                                        color={activo ? 'text.primary' : 'text.disabled'}
                                        fontWeight={activo ? 500 : 400}
                                    >
                                        {s.label}
                                    </Typography>
                                </Box>
                                <Box display="flex" gap={0.4}>
                                    {s.permisos.map(p => (
                                        <Box
                                            key={p}
                                            sx={{
                                                width: 8, height: 8, borderRadius: '50%',
                                                backgroundColor: permisos.includes(p)
                                                    ? s.color
                                                    : (theme.palette.mode === 'dark' ? '#444' : '#ddd'),
                                                transition: 'background-color 0.2s',
                                            }}
                                        />
                                    ))}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* Footer con acciones */}
            <Box
                sx={{
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    px: 2, py: 1,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 0.5,
                    backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#fafafa',
                }}
            >
                <Tooltip title="Editar rol">
                    <IconButton size="small" onClick={() => onEditar(rol)}>
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar rol">
                    <IconButton size="small" color="error" onClick={() => onEliminar(rol)}>
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );
}

export default function GestionRoles() {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Dialog crear
    const [crearOpen, setCrearOpen] = useState(false);
    const [crearNombre, setCrearNombre] = useState('');
    const [crearPermisos, setCrearPermisos] = useState([]);
    const [crearError, setCrearError] = useState('');
    const [crearLoading, setCrearLoading] = useState(false);

    // Dialog editar
    const [editarOpen, setEditarOpen] = useState(false);
    const [editarRol, setEditarRol] = useState(null);
    const [editarNombre, setEditarNombre] = useState('');
    const [editarPermisos, setEditarPermisos] = useState([]);
    const [editarError, setEditarError] = useState('');
    const [editarLoading, setEditarLoading] = useState(false);

    // Dialog eliminar
    const [eliminarOpen, setEliminarOpen] = useState(false);
    const [eliminarRol, setEliminarRol] = useState(null);
    const [eliminarLoading, setEliminarLoading] = useState(false);
    const [eliminarError, setEliminarError] = useState('');

    const cargar = async () => {
        try {
            setLoading(true);
            const res = await api.get('/roles');
            setRoles(res.data);
        } catch {
            setError('Error al cargar roles');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    const handleCrear = async () => {
        setCrearError('');
        if (!crearNombre.trim()) { setCrearError('El nombre es obligatorio.'); return; }
        setCrearLoading(true);
        try {
            await api.post('/roles', { nombre: crearNombre.trim(), permisos: crearPermisos });
            setCrearOpen(false);
            setCrearNombre('');
            setCrearPermisos([]);
            await cargar();
        } catch (e) {
            setCrearError(e.response?.data?.message || 'Error al crear rol');
        } finally {
            setCrearLoading(false);
        }
    };

    const abrirEditar = (r) => {
        setEditarRol(r);
        setEditarNombre(r.nombre);
        setEditarPermisos(r.permisos || []);
        setEditarError('');
        setEditarOpen(true);
    };

    const handleEditar = async () => {
        setEditarError('');
        setEditarLoading(true);
        try {
            await api.patch(`/roles/${editarRol.id}`, {
                nombre: editarNombre.trim(),
                permisos: editarPermisos,
            });
            setEditarOpen(false);
            await cargar();
        } catch (e) {
            setEditarError(e.response?.data?.message || 'Error al actualizar rol');
        } finally {
            setEditarLoading(false);
        }
    };

    const abrirEliminar = (r) => {
        setEliminarRol(r);
        setEliminarError('');
        setEliminarOpen(true);
    };

    const handleEliminar = async () => {
        setEliminarError('');
        setEliminarLoading(true);
        try {
            await api.delete(`/roles/${eliminarRol.id}`);
            setEliminarOpen(false);
            await cargar();
        } catch (e) {
            setEliminarError(e.response?.data?.message || 'Error al eliminar rol');
        } finally {
            setEliminarLoading(false);
        }
    };

    if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress /></Box>;

    return (
        <Box py={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight="bold">Gestión de roles</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setCrearError(''); setCrearOpen(true); }}>
                    Nuevo rol
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Grid container spacing={2.5}>
                {roles.map((r) => (
                    <Grid item xs={12} sm={6} md={4} key={r.id}>
                        <RolCard rol={r} onEditar={abrirEditar} onEliminar={abrirEliminar} />
                    </Grid>
                ))}
                {roles.length === 0 && (
                    <Grid item xs={12}>
                        <Typography color="text.secondary" textAlign="center">No hay roles configurados</Typography>
                    </Grid>
                )}
            </Grid>

            {/* Dialog Crear */}
            <Dialog open={crearOpen} onClose={() => setCrearOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Nuevo rol</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} mt={1}>
                        {crearError && <Alert severity="error">{crearError}</Alert>}
                        <TextField
                            label="Nombre del rol"
                            value={crearNombre}
                            onChange={(e) => setCrearNombre(e.target.value)}
                            fullWidth
                        />
                        <Typography fontWeight="bold" variant="body2">Permisos</Typography>
                        <PermisosEditor permisos={crearPermisos} onChange={setCrearPermisos} />
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
            <Dialog open={editarOpen} onClose={() => setEditarOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Editar rol</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} mt={1}>
                        {editarError && <Alert severity="error">{editarError}</Alert>}
                        <TextField
                            label="Nombre del rol"
                            value={editarNombre}
                            onChange={(e) => setEditarNombre(e.target.value)}
                            fullWidth
                        />
                        <Typography fontWeight="bold" variant="body2">Permisos</Typography>
                        <PermisosEditor permisos={editarPermisos} onChange={setEditarPermisos} />
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
                <DialogTitle>Eliminar rol</DialogTitle>
                <DialogContent>
                    {eliminarError && <Alert severity="error" sx={{ mb: 1 }}>{eliminarError}</Alert>}
                    <Typography>
                        ¿Seguro que querés eliminar el rol <strong>{eliminarRol?.nombre}</strong>?
                        {eliminarRol?.cantidadUsuarios > 0 && (
                            <> Tiene <strong>{eliminarRol.cantidadUsuarios}</strong> usuario(s) asignado(s).</>
                        )}
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
