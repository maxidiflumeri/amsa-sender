import { useCallback, useEffect, useState } from 'react';
import { Box, Button, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import { Eraser, MoreVertical, Plus, Smartphone, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { mensajeDeError, useFeedback } from '../context/FeedbackContext';
import { useAlReanudar, useEventoSocket } from '../context/SocketContext';
import { migasDe } from './layout/navConfig';
import { BloqueEstado, ConfirmDialog, EmptyState, PageContainer, PageHeader, StatusChip } from './ui';
import { pluralizar } from './campanias/waweb/formatos';

// Las sesiones de WhatsApp Web: una tarjeta por número conectado. "Conectar sesión" está siempre a mano; limpiar
// todas, que es lo único destructivo de la pantalla, queda en el menú "Más" y pide escribir "limpiar".

const ESTADOS = {
    conectado: { label: 'Conectada', tono: 'ok', vivo: true },
    desconectado: { label: 'Desconectada', tono: 'aviso' },
    reconectando: { label: 'Reconectando', tono: 'aviso', vivo: true },
    inicializando: { label: 'Iniciando', tono: 'info' },
    'esperando escaneo': { label: 'Esperando el escaneo', tono: 'info' },
    iniciando_sesion: { label: 'Conectando', tono: 'info', vivo: true },
};

function EsqueletoTarjeta() {
    return (
        <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2 }}>
            <Skeleton width={110} height={24} />
            <Skeleton width="60%" height={30} />
            <Skeleton width="80%" />
        </Paper>
    );
}

export default function EstadoSesiones() {
    const navigate = useNavigate();
    const feedback = useFeedback();
    const { hasPermiso } = useAuth();
    const puedeVer = hasPermiso('whatsapp.sesiones');
    const puedeConectar = hasPermiso('whatsapp.conectar');

    const [sesiones, setSesiones] = useState([]);
    const [cargando, setCargando] = useState(puedeVer);
    const [errorCarga, setErrorCarga] = useState(false);
    const [menu, setMenu] = useState(null);
    const [aEliminar, setAEliminar] = useState(null);
    const [limpiando, setLimpiando] = useState(false);
    const [confirmarLimpiar, setConfirmarLimpiar] = useState(false);
    const [trabajando, setTrabajando] = useState(false);

    const cargar = useCallback(async ({ silent = false } = {}) => {
        if (!puedeVer) return;
        if (!silent) {
            setCargando(true);
            setErrorCarga(false);
        }
        try {
            const res = await api.get('/whatsapp/sesiones/status');
            setSesiones(res.data ?? []);
        } catch {
            // Una recarga silenciosa que falla deja lo que ya se ve; solo la carga a la vista muestra el error.
            if (!silent) setErrorCarga(true);
        } finally {
            if (!silent) setCargando(false);
        }
    }, [puedeVer]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    // El QR de otra persona que está conectando una sesión no cambia esta lista; todo lo demás sí.
    useEventoSocket('estado_sesion', ({ estado }) => {
        if (estado !== 'qr') cargar({ silent: true });
    });
    useAlReanudar(() => cargar({ silent: true }));

    const eliminar = async () => {
        setTrabajando(true);
        try {
            await api.delete(`/whatsapp/sesiones/${aEliminar.id}`);
            feedback.exito('Sesión eliminada.');
            setAEliminar(null);
            await cargar({ silent: true });
        } catch (error) {
            feedback.error(mensajeDeError(error, 'No se pudo eliminar la sesión.'));
        } finally {
            setTrabajando(false);
        }
    };

    const limpiar = async () => {
        setLimpiando(true);
        try {
            await api.delete('/whatsapp/sesiones/clear');
            feedback.exito('Se limpiaron todas las sesiones.');
            setConfirmarLimpiar(false);
            await cargar({ silent: true });
        } catch (error) {
            feedback.error(mensajeDeError(error, 'No se pudieron limpiar las sesiones.'));
        } finally {
            setLimpiando(false);
        }
    };

    const irAConectar = () => navigate('/conectar');

    return (
        <PageContainer>
            <PageHeader
                title="Sesiones"
                subtitle="Los números de WhatsApp conectados para enviar campañas."
                breadcrumbs={migasDe('/sesiones')}
                actions={(
                    <>
                        {puedeVer && (
                            <Tooltip title="Más acciones">
                                <span>
                                    <IconButton
                                        aria-label="Más acciones"
                                        aria-haspopup="menu"
                                        disabled={sesiones.length === 0}
                                        onClick={(e) => setMenu(e.currentTarget)}
                                        sx={{ width: 44, height: 44, border: 1, borderColor: 'divider', borderRadius: '10px' }}
                                    >
                                        <MoreVertical size={20} strokeWidth={1.75} aria-hidden />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                        {puedeConectar && (
                            <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={irAConectar}>
                                Conectar sesión
                            </Button>
                        )}
                    </>
                )}
            />

            {!puedeVer && (
                <EmptyState
                    icon={Smartphone}
                    title="No tenés permiso para ver las sesiones"
                    description="Podés conectar una sesión nueva; para ver o eliminar las existentes pedí el permiso de Sesiones."
                />
            )}

            {puedeVer && errorCarga && <BloqueEstado estado="error" mensaje="No se pudieron cargar las sesiones." onReintentar={() => cargar()} />}

            {puedeVer && !errorCarga && (cargando || sesiones.length > 0) && (
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                    {cargando && Array.from({ length: 3 }).map((_, i) => <Box component="li" key={`esq-${i}`}><EsqueletoTarjeta /></Box>)}
                    {!cargando && sesiones.map((s) => {
                        const estado = ESTADOS[s.estado] ?? { label: s.estado ?? '—', tono: 'neutro' };
                        return (
                            <Box component="li" key={s.id}>
                                <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2, height: '100%' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                                        <StatusChip label={estado.label} tono={estado.tono} vivo={estado.vivo} />
                                        <Tooltip title="Eliminar sesión">
                                            <IconButton
                                                aria-label={`Eliminar la sesión ${s.ani || s.id}`}
                                                onClick={() => setAEliminar(s)}
                                                sx={{ width: 44, height: 44, mt: -0.75, mr: -0.75, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                                            >
                                                <Trash2 size={18} strokeWidth={1.75} aria-hidden />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                    <Typography sx={{ fontSize: 18, fontWeight: 650, mt: 0.5 }}>{s.ani || 'Sin número todavía'}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
                                        ID: {s.id}
                                    </Typography>
                                </Paper>
                            </Box>
                        );
                    })}
                </Box>
            )}

            {puedeVer && !cargando && !errorCarga && sesiones.length === 0 && (
                <EmptyState
                    icon={Smartphone}
                    title="No hay ninguna sesión conectada"
                    description="Conectá un número de WhatsApp para poder enviar campañas desde Sender."
                    action={puedeConectar ? { label: 'Conectar sesión', onClick: irAConectar } : undefined}
                />
            )}

            <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
                <MenuItem
                    sx={{ minHeight: 44, color: 'error.main' }}
                    onClick={() => {
                        setMenu(null);
                        setConfirmarLimpiar(true);
                    }}
                >
                    <ListItemIcon sx={{ color: 'inherit' }}><Eraser size={18} strokeWidth={1.75} aria-hidden /></ListItemIcon>
                    <ListItemText>Limpiar sesiones</ListItemText>
                </MenuItem>
            </Menu>

            <ConfirmDialog
                open={!!aEliminar}
                titulo="¿Eliminar la sesión?"
                mensaje={`Se va a eliminar la sesión de ${aEliminar?.ani || aEliminar?.id}. Para volver a usar ese número hay que escanear el código QR de nuevo, y las campañas que estén enviando por esta sesión dejan de enviar por ella.`}
                confirmarTexto="Eliminar"
                peligro
                cargando={trabajando}
                onConfirmar={eliminar}
                onCancelar={() => setAEliminar(null)}
            />

            <ConfirmDialog
                open={confirmarLimpiar}
                titulo="¿Limpiar todas las sesiones?"
                mensaje={`Se van a eliminar ${pluralizar(sesiones.length, 'sesión', 'sesiones')}, conectadas o no, con todo lo que tienen guardado. Para volver a enviar hay que conectar cada número de nuevo con su código QR, y las campañas que estén enviando se quedan sin sesión.`}
                confirmarTexto="Limpiar sesiones"
                peligro
                textoATipear="limpiar"
                cargando={limpiando}
                onConfirmar={limpiar}
                onCancelar={() => setConfirmarLimpiar(false)}
            />
        </PageContainer>
    );
}
