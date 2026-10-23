import { Alert, Box, Button, Chip, Stack, Switch, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Check, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePwa } from '../pwa';
import { CATALOGO_PERMISOS, TOTAL_PERMISOS } from '../permisos';
import { AvatarUsuario, PageContainer, PageHeader, SectionCard, SelectorTema } from '../components/ui';

// Mi perfil, como en AMSA Gestión: tu cuenta, lo que podés hacer, las preferencias de este dispositivo (tema y
// notificaciones) y la sesión. Todo sale de la sesión (el token y lo que devolvió el login): no hace pedidos.

const formatoHora = (seg) => (seg ? new Date(seg * 1000).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null);

function Dato({ titulo, children }) {
    return (
        <Box sx={{ bgcolor: 'background.default', borderRadius: '10px', px: 1.5, py: 1.25, minWidth: 0 }}>
            <Typography component="dt" sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>{titulo}</Typography>
            <Typography component="dd" sx={{ m: 0, mt: 0.5, fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{children}</Typography>
        </Box>
    );
}

function Notificaciones() {
    const { push, esIos, esStandalone } = usePwa();
    if (!push.soportado) {
        return (
            <Typography variant="body2" color="text.secondary">
                {esIos && !esStandalone
                    ? 'En el iPhone, las notificaciones funcionan con Sender instalada: Compartir › «Agregar a inicio», y después activalas desde acá.'
                    : 'Este navegador no permite notificaciones.'}
            </Typography>
        );
    }
    return (
        <Stack spacing={1}>
            <Box component="label" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, cursor: 'pointer', minHeight: 44 }}>
                <Box>
                    <Typography variant="body2" fontWeight={600}>Avisarme de los mensajes nuevos</Typography>
                    <Typography variant="body2" color="text.secondary">Aunque Sender esté cerrada. Llegan los de tus chats y los que nadie tomó.</Typography>
                </Box>
                <Switch
                    checked={push.suscripto}
                    disabled={push.cargando || push.permiso === 'denied'}
                    onChange={(e) => (e.target.checked ? push.activar() : push.desactivar())}
                    inputProps={{ 'aria-label': 'Avisarme de los mensajes nuevos' }}
                />
            </Box>
            {push.permiso === 'denied' && (
                <Alert severity="warning" variant="outlined">Las notificaciones están bloqueadas para Sender en este navegador. Habilitalas desde la configuración del sitio y volvé a intentar.</Alert>
            )}
            {push.error && <Alert severity="error" variant="outlined">{push.error}</Alert>}
        </Stack>
    );
}

export default function MiPerfil() {
    const theme = useTheme();
    const desdeMd = useMediaQuery(theme.breakpoints.up('md'));
    const { usuario, user, nombre, permisos, cerrarSesion } = useAuth();
    const rol = usuario?.rolObj?.nombre ?? usuario?.rol ?? user?.rol ?? '—';
    const alta = usuario?.creadoAt ? new Date(usuario.creadoAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    const secciones = CATALOGO_PERMISOS.map((s) => ({ ...s, items: s.items.filter((i) => permisos.includes(i.key)) })).filter((s) => s.items.length > 0);
    const entro = formatoHora(user?.iat);
    const vence = formatoHora(user?.exp);

    return (
        <PageContainer angosto>
            <PageHeader title="Mi perfil" subtitle="Tus datos, lo que tu rol te deja hacer y cómo ves Sender." />
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 340px) minmax(0, 1fr)' }, alignItems: 'start' }}>
                <Stack spacing={2.5}>
                    <SectionCard title="Tu cuenta">
                        <Stack spacing={2}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <AvatarUsuario nombre={nombre} foto={usuario?.foto} size={64} />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography fontWeight={650} fontSize={18} sx={{ overflowWrap: 'anywhere' }}>{nombre}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{usuario?.email ?? user?.email}</Typography>
                                </Box>
                            </Box>
                            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
                                <Dato titulo="Rol">{String(rol).toUpperCase()}</Dato>
                                <Dato titulo="Permisos">{`${permisos.length} de ${TOTAL_PERMISOS}`}</Dato>
                                {alta && <Box sx={{ gridColumn: '1 / -1' }}><Dato titulo="Alta">{alta}</Dato></Box>}
                            </Box>
                            <Typography variant="caption" color="text.secondary">El nombre y la foto vienen de tu cuenta de Google y se actualizan cada vez que entrás.</Typography>
                        </Stack>
                    </SectionCard>

                    <SectionCard title="Preferencias" action={<Chip size="small" label="En este dispositivo" />}>
                        <Stack spacing={2.5}>
                            <Box>
                                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Tema</Typography>
                                <SelectorTema />
                                <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>Sistema sigue lo que tengas configurado en la computadora o el celular.</Typography>
                            </Box>
                            <Notificaciones />
                        </Stack>
                    </SectionCard>

                    <SectionCard title="Sesión">
                        <Stack spacing={1.5}>
                            <Typography variant="body2" color="text.secondary">
                                {entro ? <>Entraste el <b>{entro}</b>.</> : 'No pudimos leer cuándo entraste.'}
                                {vence ? <> La sesión vence el <b>{vence}</b>: después hay que volver a entrar con Google.</> : null}
                            </Typography>
                            <Button variant="outlined" color="error" startIcon={<LogOut size={16} strokeWidth={1.75} aria-hidden />} onClick={cerrarSesion} sx={{ alignSelf: 'flex-start', minHeight: 44 }}>
                                Cerrar sesión
                            </Button>
                        </Stack>
                    </SectionCard>
                </Stack>

                <Stack spacing={2.5}>
                    <SectionCard title="Lo que podés hacer">
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Tu rol <b>{String(rol).toUpperCase()}</b> te da <b>{permisos.length} permisos</b>. Lo que no ves en el menú es porque tu rol no lo tiene: para cambiarlo, hablá con quien administra los usuarios.
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2.5 }}>
                            {secciones.map((s) => (
                                <Box key={s.seccion}>
                                    <Typography component="h3" sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>{s.seccion}</Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                        {s.items.map((i) => (
                                            <Chip key={i.key} size="small" icon={<Check size={13} strokeWidth={2.5} aria-hidden />} label={i.label} sx={{ '& .MuiChip-icon': { color: 'success.main' } }} />
                                        ))}
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </SectionCard>

                    {desdeMd && (
                        <SectionCard title="Atajos de teclado">
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 1.5, alignItems: 'center', fontSize: 14 }}>
                                {[
                                    [['Ctrl', 'K'], 'Buscar un deudor, una conversación o una pantalla'],
                                    [['↑', '↓'], 'Moverte entre los resultados del buscador'],
                                    [['Enter'], 'Abrir el resultado marcado'],
                                    [['Esc'], 'Cerrar el buscador o un diálogo'],
                                ].map(([teclas, texto]) => (
                                    <Box key={texto} sx={{ display: 'contents' }}>
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            {teclas.map((t) => (
                                                <Box key={t} component="kbd" sx={{ fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, px: 1, py: 0.5, borderRadius: '6px', border: 1, borderBottomWidth: 2, borderColor: 'divider', bgcolor: 'background.paper' }}>{t}</Box>
                                            ))}
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">{texto}</Typography>
                                    </Box>
                                ))}
                            </Box>
                        </SectionCard>
                    )}
                </Stack>
            </Box>
        </PageContainer>
    );
}
