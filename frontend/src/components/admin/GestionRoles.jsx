import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, LinearProgress, Paper, Skeleton, TextField, Typography,
} from '@mui/material';
import {
    Inbox, Landmark, Mail, MessageCircle, Pencil, Plus, Settings, Shield, ShieldCheck, Smartphone, Trash2, Users,
} from 'lucide-react';
import api from '../../api/axios';
import { CATALOGO_PERMISOS, TOTAL_PERMISOS } from '../../permisos';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import {
    BloqueEstado, ConfirmDialog, EmptyState, PageContainer, PageHeader, ResponsiveDialog, SectionCard, StatusChip,
} from '../ui';
import MenuMas from './MenuMas';

// Un ícono por sección del catálogo. Una sección que se sume y no esté acá cae en el escudo.
const ICONOS_SECCION = {
    Conversaciones: Inbox,
    'WhatsApp API': MessageCircle,
    Email: Mail,
    'WhatsApp Web': Smartphone,
    Deudores: Landmark,
    Configuración: Settings,
    Otros: Shield,
};

const CLAVES_CATALOGO = new Set(CATALOGO_PERMISOS.flatMap((s) => s.items.map((i) => i.key)));

/** Las claves que tiene un rol y el catálogo no conoce (un permiso viejo o uno que el backend sumó antes que el front). */
const clavesOtras = (permisos) => (permisos || []).filter((p) => !CLAVES_CATALOGO.has(p));

/** El catálogo, más una sección "Otros" con las claves sueltas que traiga el rol, para que no queden invisibles. */
function seccionesCon(permisos) {
    const otras = clavesOtras(permisos);
    return otras.length > 0
        ? [...CATALOGO_PERMISOS, { seccion: 'Otros', items: otras.map((key) => ({ key, label: key })) }]
        : CATALOGO_PERMISOS;
}

function PermisosEditor({ permisos, onChange }) {
    // Las "otras" se calculan sobre lo que el rol traía al abrir: si se destildan, la sección no desaparece de golpe.
    const [secciones] = useState(() => seccionesCon(permisos));

    const toggle = (key) => onChange(permisos.includes(key) ? permisos.filter((p) => p !== key) : [...permisos, key]);

    const toggleSeccion = (items) => {
        const keys = items.map((i) => i.key);
        const todas = keys.every((k) => permisos.includes(k));
        onChange(todas ? permisos.filter((p) => !keys.includes(p)) : [...new Set([...permisos, ...keys])]);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {secciones.map(({ seccion, items }) => {
                const keys = items.map((i) => i.key);
                const marcadas = keys.filter((k) => permisos.includes(k)).length;
                const todas = marcadas === keys.length;
                return (
                    <Paper key={seccion} variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
                        <FormControlLabel
                            sx={{ m: 0, px: 1.5, minHeight: 48, width: '100%', bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}
                            control={
                                <Checkbox
                                    checked={todas}
                                    indeterminate={marcadas > 0 && !todas}
                                    onChange={() => toggleSeccion(items)}
                                    sx={{ p: 1.25 }}
                                />
                            }
                            label={
                                <Typography sx={{ fontWeight: 650, fontSize: 14.5 }}>
                                    {seccion} <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: 13 }}>({marcadas}/{keys.length})</Box>
                                </Typography>
                            }
                        />
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                            {items.map(({ key, label }) => (
                                <FormControlLabel
                                    key={key}
                                    sx={{ m: 0, pl: 3, pr: 1.5, minHeight: 44 }}
                                    control={<Checkbox checked={permisos.includes(key)} onChange={() => toggle(key)} sx={{ p: 1.25 }} />}
                                    label={<Typography sx={{ fontSize: 14, overflowWrap: 'anywhere' }}>{label}</Typography>}
                                />
                            ))}
                        </Box>
                    </Paper>
                );
            })}
        </Box>
    );
}

function RolCard({ rol, onEditar, onEliminar }) {
    const permisos = rol.permisos || [];
    const enCatalogo = permisos.filter((p) => CLAVES_CATALOGO.has(p)).length;
    const otras = clavesOtras(permisos).length;
    const pct = Math.min(100, Math.round((enCatalogo / TOTAL_PERMISOS) * 100));
    const tono = pct === 100 ? 'ok' : pct >= 60 ? 'acento' : pct >= 25 ? 'aviso' : 'neutro';
    const usuarios = rol.cantidadUsuarios ?? 0;

    return (
        <Paper component="li" variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Box sx={{ p: 2, flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: '12px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', color: 'primary.main' }}>
                            <ShieldCheck size={20} strokeWidth={1.75} aria-hidden />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography component="h2" sx={{ fontWeight: 650, fontSize: 16, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{rol.nombre}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', mt: 0.25 }}>
                                <Users size={14} strokeWidth={1.75} aria-hidden />
                                <Typography variant="body2" sx={{ fontSize: 13 }}>
                                    {usuarios} {usuarios === 1 ? 'usuario' : 'usuarios'}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                    <StatusChip label={`${enCatalogo} / ${TOTAL_PERMISOS}`} tono={tono} />
                </Box>

                <LinearProgress
                    variant="determinate"
                    value={pct}
                    aria-label={`${pct}% de los permisos`}
                    sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { borderRadius: 3 } }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5, fontSize: 12.5 }}>
                    {pct}% de los permisos{otras > 0 ? ` · ${otras} fuera del catálogo` : ''}
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75 }}>
                    {CATALOGO_PERMISOS.map((s) => {
                        const habilitados = s.items.filter((i) => permisos.includes(i.key)).length;
                        const activo = habilitados > 0;
                        const Icono = ICONOS_SECCION[s.seccion] ?? Shield;
                        return (
                            <Box
                                key={s.seccion}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, minWidth: 0, borderRadius: '10px',
                                    border: 1, borderColor: activo ? 'primary.main' : 'divider',
                                    color: activo ? 'text.primary' : 'text.secondary',
                                }}
                            >
                                <Box sx={{ flex: 'none', display: 'flex', color: activo ? 'primary.main' : 'text.disabled' }}>
                                    <Icono size={16} strokeWidth={1.75} aria-hidden />
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography noWrap sx={{ fontSize: 12.5, fontWeight: activo ? 600 : 400 }}>{s.seccion}</Typography>
                                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{habilitados}/{s.items.length}</Typography>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            <Box sx={{ borderTop: 1, borderColor: 'divider', px: 2, py: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
                <Button variant="outlined" startIcon={<Pencil size={16} strokeWidth={1.75} aria-hidden />} onClick={() => onEditar(rol)} sx={{ minHeight: { xs: 44, md: 36 } }}>
                    Editar
                </Button>
                <MenuMas items={[{ label: 'Eliminar', icon: Trash2, peligro: true, onClick: () => onEliminar(rol) }]} />
            </Box>
        </Paper>
    );
}

export default function GestionRoles() {
    const feedback = useFeedback();
    const [roles, setRoles] = useState([]);
    const [estado, setEstado] = useState('cargando');

    const [crearOpen, setCrearOpen] = useState(false);
    const [crearNombre, setCrearNombre] = useState('');
    const [crearPermisos, setCrearPermisos] = useState([]);
    const [crearErrorNombre, setCrearErrorNombre] = useState('');
    const [crearError, setCrearError] = useState('');
    const [crearLoading, setCrearLoading] = useState(false);

    const [editarRol, setEditarRol] = useState(null);
    const [editarNombre, setEditarNombre] = useState('');
    const [editarPermisos, setEditarPermisos] = useState([]);
    const [editarErrorNombre, setEditarErrorNombre] = useState('');
    const [editarError, setEditarError] = useState('');
    const [editarLoading, setEditarLoading] = useState(false);

    const [eliminarRol, setEliminarRol] = useState(null);
    const [eliminarLoading, setEliminarLoading] = useState(false);
    const [eliminarError, setEliminarError] = useState('');

    const cargar = useCallback(async () => {
        setEstado((e) => (e === 'listo' ? e : 'cargando'));
        try {
            const res = await api.get('/roles');
            setRoles(Array.isArray(res.data) ? res.data : []);
            setEstado('listo');
        } catch {
            setEstado('error');
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const abrirCrear = () => {
        setCrearNombre('');
        setCrearPermisos([]);
        setCrearErrorNombre('');
        setCrearError('');
        setCrearOpen(true);
    };

    const handleCrear = async () => {
        if (!crearNombre.trim()) { setCrearErrorNombre('Poné un nombre para el rol.'); return; }
        setCrearErrorNombre('');
        setCrearError('');
        setCrearLoading(true);
        try {
            await api.post('/roles', { nombre: crearNombre.trim(), permisos: crearPermisos });
            setCrearOpen(false);
            feedback.exito('Rol creado.');
            await cargar();
        } catch (e) {
            setCrearError(mensajeDeError(e, 'No se pudo crear el rol.'));
        } finally {
            setCrearLoading(false);
        }
    };

    const abrirEditar = (r) => {
        setEditarRol(r);
        setEditarNombre(r.nombre);
        setEditarPermisos(r.permisos || []);
        setEditarErrorNombre('');
        setEditarError('');
    };

    const sucioEditar = useMemo(() => {
        if (!editarRol) return false;
        const a = [...(editarRol.permisos || [])].sort().join('|');
        const b = [...editarPermisos].sort().join('|');
        return a !== b || editarNombre !== editarRol.nombre;
    }, [editarRol, editarNombre, editarPermisos]);

    const handleEditar = async () => {
        if (!editarNombre.trim()) { setEditarErrorNombre('Poné un nombre para el rol.'); return; }
        setEditarErrorNombre('');
        setEditarError('');
        setEditarLoading(true);
        try {
            await api.patch(`/roles/${editarRol.id}`, { nombre: editarNombre.trim(), permisos: editarPermisos });
            setEditarRol(null);
            feedback.exito('Rol actualizado.');
            await cargar();
        } catch (e) {
            setEditarError(mensajeDeError(e, 'No se pudo actualizar el rol.'));
        } finally {
            setEditarLoading(false);
        }
    };

    const handleEliminar = async () => {
        setEliminarError('');
        setEliminarLoading(true);
        try {
            await api.delete(`/roles/${eliminarRol.id}`);
            setEliminarRol(null);
            feedback.exito('Rol eliminado.');
            await cargar();
        } catch (e) {
            setEliminarError(mensajeDeError(e, 'No se pudo eliminar el rol.'));
        } finally {
            setEliminarLoading(false);
        }
    };

    const botonesDialogo = (cancelar, guardar, cargando, textoCargando, texto) => (
        <>
            <Button onClick={cancelar} disabled={cargando}>Cancelar</Button>
            <Button
                variant="contained"
                onClick={guardar}
                disabled={cargando}
                startIcon={cargando ? <CircularProgress size={16} color="inherit" /> : null}
            >
                {cargando ? textoCargando : texto}
            </Button>
        </>
    );

    return (
        <PageContainer>
            <PageHeader
                title="Roles"
                subtitle="Qué puede hacer cada grupo de usuarios."
                breadcrumbs={migasDe('/admin/roles')}
                actions={
                    <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={abrirCrear}>
                        Nuevo rol
                    </Button>
                }
            />

            {estado === 'error' && <BloqueEstado estado="error" mensaje="No se pudieron cargar los roles." onReintentar={cargar} />}

            {estado === 'cargando' && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
                    {[0, 1, 2].map((i) => (
                        <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: '14px' }}>
                            <Skeleton width="50%" height={28} />
                            <Skeleton variant="rounded" height={6} sx={{ my: 1.5 }} />
                            <Skeleton height={60} />
                        </Paper>
                    ))}
                </Box>
            )}

            {estado === 'listo' && roles.length === 0 && (
                <SectionCard>
                    <EmptyState compact icon={Shield} title="Todavía no hay roles" action={{ label: 'Nuevo rol', onClick: abrirCrear }} />
                </SectionCard>
            )}

            {estado === 'listo' && roles.length > 0 && (
                <Box
                    component="ul"
                    sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}
                >
                    {roles.map((r) => (
                        <RolCard key={r.id} rol={r} onEditar={abrirEditar} onEliminar={(rol) => { setEliminarError(''); setEliminarRol(rol); }} />
                    ))}
                </Box>
            )}

            <ResponsiveDialog
                open={crearOpen}
                onClose={() => setCrearOpen(false)}
                maxWidth="md"
                sucio={(!!crearNombre || crearPermisos.length > 0) && !crearLoading}
                title="Nuevo rol"
                actions={botonesDialogo(() => setCrearOpen(false), handleCrear, crearLoading, 'Creando…', 'Crear rol')}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
                    {crearError && <Alert severity="error" role="alert">{crearError}</Alert>}
                    <TextField
                        label="Nombre del rol"
                        value={crearNombre}
                        onChange={(e) => { setCrearNombre(e.target.value); setCrearErrorNombre(''); }}
                        fullWidth
                        required
                        error={!!crearErrorNombre}
                        helperText={crearErrorNombre}
                    />
                    <Typography component="h3" sx={{ fontWeight: 650, fontSize: 15 }}>Permisos</Typography>
                    <PermisosEditor permisos={crearPermisos} onChange={setCrearPermisos} />
                </Box>
            </ResponsiveDialog>

            <ResponsiveDialog
                open={!!editarRol}
                onClose={() => setEditarRol(null)}
                maxWidth="md"
                sucio={sucioEditar && !editarLoading}
                title={`Editar rol${editarRol ? `: ${editarRol.nombre}` : ''}`}
                actions={botonesDialogo(() => setEditarRol(null), handleEditar, editarLoading, 'Guardando…', 'Guardar')}
            >
                {editarRol && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
                        {editarError && <Alert severity="error" role="alert">{editarError}</Alert>}
                        <TextField
                            label="Nombre del rol"
                            value={editarNombre}
                            onChange={(e) => { setEditarNombre(e.target.value); setEditarErrorNombre(''); }}
                            fullWidth
                            required
                            error={!!editarErrorNombre}
                            helperText={editarErrorNombre}
                        />
                        <Typography component="h3" sx={{ fontWeight: 650, fontSize: 15 }}>Permisos</Typography>
                        <PermisosEditor permisos={editarPermisos} onChange={setEditarPermisos} />
                    </Box>
                )}
            </ResponsiveDialog>

            <ConfirmDialog
                open={!!eliminarRol}
                titulo="¿Eliminar el rol?"
                mensaje={
                    <>
                        Se elimina el rol <strong>{eliminarRol?.nombre}</strong>. Esta acción no se puede deshacer.
                        {eliminarRol?.cantidadUsuarios > 0 && (
                            <> Tiene <strong>{eliminarRol.cantidadUsuarios}</strong> {eliminarRol.cantidadUsuarios === 1 ? 'usuario asignado' : 'usuarios asignados'}.</>
                        )}
                    </>
                }
                confirmarTexto="Eliminar"
                peligro
                cargando={eliminarLoading}
                onConfirmar={handleEliminar}
                onCancelar={() => setEliminarRol(null)}
            >
                {eliminarError && <Alert severity="error" role="alert">{eliminarError}</Alert>}
            </ConfirmDialog>
        </PageContainer>
    );
}
