import { useState, useEffect } from 'react';
import {
    Box, Typography, IconButton, Chip, Button, Dialog,
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
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
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
            { key: 'wapi.respuestas_rapidas', label: 'Plantillas rápidas' },
        ],
    },
    {
        seccion: 'Deudores',
        items: [
            { key: 'deudores.ver', label: 'Buscar y ver fichas' },
            { key: 'deudores.reportes', label: 'Reportes por empresa/remesa' },
        ],
    },
];

const TOTAL_PERMISOS = TODOS_LOS_PERMISOS.reduce((acc, s) => acc + s.items.length, 0);

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
        icon: <WhatsAppIcon sx={{ fontSize: 13 }} />,
        color: '#4caf50',
        bg: '#E8F5E9',
        permisos: ['whatsapp.sesiones', 'whatsapp.conectar', 'whatsapp.campanias', 'whatsapp.templates', 'whatsapp.reportes', 'whatsapp.metricas'],
    },
    {
        key: 'email',
        label: 'Email',
        icon: <MailIcon sx={{ fontSize: 13 }} />,
        color: '#1976d2',
        bg: '#E3F2FD',
        permisos: ['email.cuentas_smtp', 'email.templates', 'email.campanias', 'email.envio_manual', 'email.reportes', 'email.desuscripciones'],
    },
    {
        key: 'wapi',
        label: 'WA API',
        icon: <ApiIcon sx={{ fontSize: 13 }} />,
        color: '#00695C',
        bg: '#E0F2F1',
        permisos: ['wapi.config', 'wapi.templates', 'wapi.campanias', 'wapi.bajas', 'wapi.analitica'],
    },
    {
        key: 'inbox',
        label: 'Inbox WA',
        icon: <InboxIcon sx={{ fontSize: 13 }} />,
        color: '#E65100',
        bg: '#FFF3E0',
        permisos: ['wapi.inbox', 'wapi.inbox.admin', 'wapi.respuestas_rapidas'],
    },
    {
        key: 'deudores',
        label: 'Deudores',
        icon: <AccountBalanceIcon sx={{ fontSize: 13 }} />,
        color: '#7B1FA2',
        bg: '#F3E5F5',
        permisos: ['deudores.ver', 'deudores.reportes'],
    },
    {
        key: 'config',
        label: 'Config',
        icon: <SettingsIcon sx={{ fontSize: 13 }} />,
        color: '#607d8b',
        bg: '#ECEFF1',
        permisos: ['config.tareas_programadas'],
    },
    {
        key: 'admin',
        label: 'Admin',
        icon: <AdminPanelSettingsIcon sx={{ fontSize: 13 }} />,
        color: '#c2185b',
        bg: '#FCE4EC',
        permisos: ['admin.usuarios'],
    },
];

function RolCard({ rol, onEditar, onEliminar }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const permisos = rol.permisos || [];
    const pct = Math.min(100, Math.round((permisos.length / TOTAL_PERMISOS) * 100));
    const accentColor = pct === 100 ? '#4caf50' : pct >= 60 ? '#1976d2' : pct >= 25 ? '#f59e0b' : '#607d8b';

    return (
        <Box sx={{
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.08)',
            transition: 'box-shadow 0.2s ease, transform 0.15s ease',
            '&:hover': {
                boxShadow: isDark ? '0 6px 24px rgba(0,0,0,0.45)' : '0 6px 24px rgba(0,0,0,0.14)',
                transform: 'translateY(-2px)',
            },
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Barra de acento superior */}
            <Box sx={{
                height: 7,
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`,
            }} />

            <Box sx={{ p: { xs: 2, sm: 2.5 }, flexGrow: 1 }}>
                {/* Nombre + chip contador */}
                <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2.5} gap={1}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                        <Box sx={{
                            width: 46, height: 46, borderRadius: 2.5, flexShrink: 0,
                            background: `linear-gradient(135deg, ${accentColor}28, ${accentColor}10)`,
                            border: `1.5px solid ${accentColor}35`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <ShieldIcon sx={{ color: accentColor, fontSize: 24 }} />
                        </Box>
                        <Box>
                            <Typography fontWeight={700} fontSize={17} sx={{ textTransform: 'capitalize', lineHeight: 1.25 }}>
                                {rol.nombre}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={0.5} mt={0.25}>
                                <PeopleIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                                <Typography variant="caption" color="text.disabled" fontSize={11}>
                                    {rol.cantidadUsuarios} {rol.cantidadUsuarios === 1 ? 'usuario' : 'usuarios'}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                    <Chip
                        label={`${permisos.length} / ${TOTAL_PERMISOS}`}
                        size="small"
                        sx={{
                            fontWeight: 700, fontSize: 12, height: 26, flexShrink: 0,
                            background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}0d)`,
                            color: accentColor,
                            border: `1px solid ${accentColor}45`,
                        }}
                    />
                </Box>

                {/* Barra de progreso total */}
                <Box mb={2.5}>
                    <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                            height: 7, borderRadius: 4,
                            backgroundColor: isDark ? '#2a2a2a' : '#eeeeee',
                            '& .MuiLinearProgress-bar': {
                                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}bb)`,
                                borderRadius: 4,
                            },
                        }}
                    />
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block', fontSize: 11 }}>
                        {pct}% de acceso total
                    </Typography>
                </Box>

                {/* Grid de secciones */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                    {SECCION_META.map((s) => {
                        const habilitados = s.permisos.filter(p => permisos.includes(p)).length;
                        const activo = habilitados > 0;
                        return (
                            <Box
                                key={s.key}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 1,
                                    px: 1, py: 0.75, borderRadius: 1.5,
                                    bgcolor: activo
                                        ? (isDark ? s.color + '1a' : s.bg)
                                        : (isDark ? '#1e1e1e' : '#f5f5f5'),
                                    border: '1px solid',
                                    borderColor: activo ? s.color + '40' : 'transparent',
                                    transition: 'all 0.2s',
                                    minWidth: 0,
                                }}
                            >
                                <Box sx={{
                                    flexShrink: 0, width: 20, height: 20, borderRadius: 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: activo ? s.color : 'text.disabled',
                                }}>
                                    {s.icon}
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography fontSize={11} fontWeight={activo ? 600 : 400} color={activo ? 'text.primary' : 'text.disabled'} noWrap>
                                        {s.label}
                                    </Typography>
                                    <Typography fontSize={10} sx={{ color: activo ? s.color : 'text.disabled' }}>
                                        {habilitados}/{s.permisos.length}
                                    </Typography>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* Footer con acciones */}
            <Box sx={{
                borderTop: '1px solid', borderColor: 'divider',
                px: 2, py: 1,
                display: 'flex', justifyContent: 'flex-end', gap: 0.5,
                backgroundColor: isDark ? '#141414' : '#fafafa',
            }}>
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

    const [crearOpen, setCrearOpen] = useState(false);
    const [crearNombre, setCrearNombre] = useState('');
    const [crearPermisos, setCrearPermisos] = useState([]);
    const [crearError, setCrearError] = useState('');
    const [crearLoading, setCrearLoading] = useState(false);

    const [editarOpen, setEditarOpen] = useState(false);
    const [editarRol, setEditarRol] = useState(null);
    const [editarNombre, setEditarNombre] = useState('');
    const [editarPermisos, setEditarPermisos] = useState([]);
    const [editarError, setEditarError] = useState('');
    const [editarLoading, setEditarLoading] = useState(false);

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
        <Box py={3} sx={{ width: '100%' }}>
            <Box
                display="flex"
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                flexDirection={{ xs: 'column', sm: 'row' }}
                gap={1.5}
                mb={3}
            >
                <Typography variant="h5" fontWeight="bold">Gestión de roles</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setCrearError(''); setCrearOpen(true); }}>
                    Nuevo rol
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' },
                gap: 2.5,
                width: '100%',
            }}>
                {roles.map((r) => (
                    <RolCard key={r.id} rol={r} onEditar={abrirEditar} onEliminar={abrirEliminar} />
                ))}
                {roles.length === 0 && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                        <Typography color="text.secondary" textAlign="center">No hay roles configurados</Typography>
                    </Box>
                )}
            </Box>

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
