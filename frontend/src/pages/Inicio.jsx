import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { MessagesSquare, Plus, Radio, Smartphone } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import api from '../api/axios';
import { pedirAvance, porcentaje } from '../components/campanias/wapi/datos';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useEventoSocket, useSalaSocket } from '../context/SocketContext';
import useCampaniasEnCurso from '../hooks/useCampaniasEnCurso';
import { usePwa } from '../pwa';
import { AvatarUsuario, EmptyState, KpiTile, PageContainer, SectionCard, StatusChip } from '../components/ui';

// El Inicio de Sender, como el "Tu día" de AMSA Gestión: lo que espera respuesta, lo que se está enviando y los
// accesos de todos los días. Cada bloque aparece según los permisos (antes era una página de presentación sin datos).

function saludo(hora) {
    if (hora < 6) return 'Buenas noches';
    if (hora < 13) return 'Buen día';
    if (hora < 20) return 'Buenas tardes';
    return 'Buenas noches';
}

function fechaLarga(d = new Date()) {
    const s = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function hace(fecha) {
    if (!fecha) return '';
    const min = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 60000));
    if (min < 1) return 'recién';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} h${min % 60 && h < 3 ? ` ${min % 60}` : ''}`;
    return `${Math.floor(h / 24)} d`;
}

function vistaPrevia(c) {
    const m = c.mensajes?.[0];
    if (!m) return c.campañaNombre ? `Campaña ${c.campañaNombre}` : '';
    const t = m.contenido?.text || m.contenido?.buttonText || m.contenido?.caption;
    if (t) return `${m.fromMe ? 'Vos: ' : ''}${t}`;
    return { image: 'Imagen', document: 'Archivo adjunto', audio: 'Audio', video: 'Video' }[m.tipo] ?? 'Mensaje';
}

function AvisoInstalar() {
    const { puedeInstalar, instalar, descartarInstalar, esIos, esStandalone } = usePwa();
    const iosSinInstalar = esIos && !esStandalone;
    if (!puedeInstalar && !iosSinInstalar) return null;
    return (
        <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, gap: 1.5, borderColor: 'primary.main' }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <Box sx={{ color: 'primary.main', mt: 0.25 }}><Smartphone size={22} strokeWidth={1.75} aria-hidden /></Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography component="h2" sx={{ fontSize: 15, fontWeight: 650 }}>Instalá Sender en este dispositivo</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {iosSinInstalar
                            ? 'En el iPhone: tocá Compartir y después «Agregar a inicio». Así se abre como una app y te puede avisar de los mensajes nuevos.'
                            : 'Se abre como una app, sin la barra del navegador, y te puede avisar cuando llega un mensaje.'}
                    </Typography>
                </Box>
            </Box>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', '& .MuiButton-root': { minHeight: 44 } }}>
                <Button color="inherit" onClick={descartarInstalar}>Ahora no</Button>
                {puedeInstalar && <Button variant="contained" onClick={instalar}>Instalar</Button>}
            </Stack>
        </Paper>
    );
}

/**
 * El avance de una campaña: la base sale de la base de datos (lo ya enviado) y el socket lo va subiendo mientras envía.
 * Antes la barra era indeterminada y se veía "cargando" para siempre. Solo sube: un evento viejo no lo hace retroceder.
 */
function useAvance(c, canal) {
    const enviando = c.estado === 'procesando';
    const [hechos, setHechos] = useState(null);
    const [totalEvento, setTotalEvento] = useState(null);
    const [consultado, setConsultado] = useState(false);
    const subir = (n) => setHechos((h) => (typeof n === 'number' && (h === null || n > h) ? n : h));

    const esWaweb = canal === 'WhatsApp Web';

    useEffect(() => {
        let vivo = true;
        // WhatsApp Web ya trae cuántos se intentaron (sus reportes) en la lista de campañas en curso.
        if (esWaweb) {
            subir(c._count?.reportes ?? null);
            setConsultado(true);
            return () => { vivo = false; };
        }
        const pedir = canal === 'Email'
            ? api.get(`/email/reportes/campanias/${c.id}/engagement`, { params: { sizeOpen: 1, sizeClick: 1, sizeBounce: 1 } }).then((r) => r.data?.resumen?.enviados)
            : pedirAvance(c.id).then((a) => a.procesados);
        pedir
            .then((n) => { if (vivo) subir(n); })
            .catch(() => { /* sin permiso o sin datos: queda lo que llegue por el socket */ })
            .finally(() => { if (vivo) setConsultado(true); });
        return () => { vivo = false; };
    }, [c.id, canal, esWaweb, c._count?.reportes]);

    useSalaSocket('join_campaña', enviando ? c.id : null);
    // Los ids se repiten entre canales, pero el evento de email es otro (`progreso_mail`) y la sala es la de este id.
    useEventoSocket(enviando ? (canal === 'Email' ? 'progreso_mail' : 'progreso') : null, (d) => {
        if (Number(d?.campañaId) !== c.id) return;
        if (esWaweb) {
            // El worker de WhatsApp Web cuenta desde cero al reanudar (su total es lo que faltaba): lo hecho es el total
            // de la campaña menos lo que todavía le falta a este envío.
            const totalCampania = c._count?.contactos;
            if (typeof totalCampania === 'number' && typeof d.total === 'number' && typeof d.enviados === 'number') {
                subir(totalCampania - (d.total - d.enviados));
            }
            return;
        }
        subir(d.enviados);
        if (typeof d.total === 'number' && d.total > 0) setTotalEvento(d.total);
    });

    const total = totalEvento ?? c._count?.contactos ?? null;
    return { hechos, total, pct: porcentaje(hechos, total), consultado };
}

function FilaCampania({ c, canal }) {
    const enPausa = c.estado === 'pausada' || c.estado === 'pausa_pendiente';
    const { hechos, total, pct, consultado } = useAvance(c, canal);
    return (
        <Box sx={{ py: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexWrap: 'wrap' }}>
                <StatusChip label={canal} tono={canal === 'Email' ? 'info' : canal === 'WhatsApp Web' ? 'neutro' : 'acento'} />
                <Typography sx={{ flex: 1, minWidth: 120, fontWeight: 600, fontSize: 14 }} noWrap>{c.nombre}</Typography>
                <StatusChip label={enPausa ? 'En pausa' : 'Enviando'} tono={enPausa ? 'aviso' : 'ok'} vivo={!enPausa} />
            </Box>
            {pct !== null ? (
                <>
                    <LinearProgress
                        variant="determinate"
                        value={pct}
                        color={enPausa ? 'warning' : 'primary'}
                        aria-label={`Avance de ${c.nombre}: ${pct} %`}
                        sx={{ height: 6, borderRadius: 99 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {`${hechos.toLocaleString('es-AR')} de ${total.toLocaleString('es-AR')} · ${pct} %`}
                    </Typography>
                </>
            ) : (
                <Typography variant="caption" color="text.secondary">
                    {consultado ? 'Avance: —' : 'Calculando el avance…'}
                </Typography>
            )}
        </Box>
    );
}

export default function Inicio() {
    const { nombre, hasPermiso, user } = useAuth();
    const verInbox = hasPermiso('wapi.inbox');
    const verCampaniasWapi = hasPermiso('wapi.campanias');
    const verCampaniasEmail = hasPermiso('email.campanias');
    const verCampaniasWaweb = hasPermiso('whatsapp.campanias');
    const verCampanias = verCampaniasWapi || verCampaniasEmail || verCampaniasWaweb;
    const { unreadCount, unassignedCount, myActiveCount, conversations, cargado } = useNotifications();
    const { wapi, email, waweb, cargando: cargandoCampanias, error: errorCampanias, recargar } = useCampaniasEnCurso();
    const todas = [...wapi, ...email, ...waweb];
    const primerNombre = (nombre || '').trim().split(/\s+/)[0];

    const esperan = useMemo(() => {
        const miId = String(user?.sub ?? '');
        return conversations
            .filter((c) => c.estado !== 'resuelta' && ((c.unreadCount || 0) > 0 && String(c.asignadoAId) === miId || c.estado === 'sin_asignar'))
            .sort((a, b) => new Date(a.ultimoMensajeAt ?? 0) - new Date(b.ultimoMensajeAt ?? 0))
            .slice(0, 6);
    }, [conversations, user]);

    const enviando = todas.filter((c) => c.estado === 'procesando').length;
    const enPausa = todas.length - enviando;
    const masVieja = esperan[0]?.ultimoMensajeAt;

    const linea = [fechaLarga()];
    if (verCampanias && enviando > 0) linea.push(`${enviando} ${enviando === 1 ? 'campaña enviando' : 'campañas enviando'}`);
    if (verInbox && unreadCount + unassignedCount > 0) linea.push(`${unreadCount + unassignedCount} ${unreadCount + unassignedCount === 1 ? 'conversación espera' : 'conversaciones esperan'} respuesta`);

    const accesos = [
        verCampaniasWapi && { to: '/wapi/campanias?nueva=1', label: 'Nueva campaña', Icono: Plus },
        verInbox && { to: '/wapi/inbox', label: 'Conversaciones', Icono: MessagesSquare },
        verCampaniasWapi && { to: '/wapi/live', label: 'Monitor en vivo', Icono: Radio },
    ].filter(Boolean);

    return (
        <PageContainer>
            <Stack spacing={3}>
                <Box component="section" aria-label="Saludo" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' }, gap: { xs: 1.5, md: 3 }, alignItems: 'end' }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography component="h1" fontWeight={700} sx={{ fontSize: { xs: 22, sm: 26 }, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                            {saludo(new Date().getHours())}{primerNombre ? `, ${primerNombre}` : ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{linea.join(' · ')}</Typography>
                    </Box>
                    {accesos.length > 0 && (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" aria-label="Accesos rápidos" sx={{ '& .MuiButton-root': { minHeight: { xs: 44, sm: 36 } } }}>
                            {accesos.map(({ to, label, Icono }, i) => (
                                <Button key={to} component={RouterLink} to={to} size="small" variant={i === 0 ? 'contained' : 'outlined'} color={i === 0 ? 'primary' : 'inherit'} startIcon={<Icono size={16} strokeWidth={1.9} aria-hidden />}>
                                    {label}
                                </Button>
                            ))}
                        </Stack>
                    )}
                </Box>

                <AvisoInstalar />

                {(verInbox || verCampanias) && (
                    <Box component="section" aria-label="Tu día" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1.25, sm: 2 } }}>
                        {verInbox && (
                            <>
                                <KpiTile titulo="Sin leer" valor={unreadCount} unidad="tuyas" cargando={!cargado} to="/wapi/inbox" leyenda={masVieja && unreadCount > 0 ? `La más vieja: ${hace(masVieja)}` : 'Al día'} tonoLeyenda={masVieja && unreadCount > 0 ? 'error' : 'normal'} />
                                <KpiTile titulo="Sin asignar" valor={unassignedCount} unidad="para tomar" cargando={!cargado} to="/wapi/inbox?filtro=sin_asignar" />
                                <KpiTile titulo="Tus chats" valor={myActiveCount} unidad="activos" cargando={!cargado} to="/wapi/inbox" />
                            </>
                        )}
                        {verCampanias && (
                            <KpiTile titulo="Campañas en curso" valor={todas.length} cargando={cargandoCampanias} leyenda={enPausa > 0 ? `${enviando} enviando, ${enPausa} en pausa` : `${enviando} enviando`} to={verCampaniasWapi ? '/wapi/live' : verCampaniasEmail ? '/email/campanias' : '/campanias'} />
                        )}
                    </Box>
                )}

                <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: verInbox && verCampanias ? 'minmax(0, 1.2fr) minmax(0, 1fr)' : 'minmax(0, 1fr)' }, alignItems: 'start' }}>
                    {verCampanias && (
                        <SectionCard
                            title="Campañas en curso"
                            action={<Button component={RouterLink} to={verCampaniasWapi ? '/wapi/campanias' : verCampaniasEmail ? '/email/campanias' : '/campanias'} size="small" sx={{ minHeight: 36 }}>Ver todas</Button>}
                        >
                            {errorCampanias ? (
                                <Alert severity="error" variant="outlined" action={<Button color="inherit" size="small" onClick={recargar}>Reintentar</Button>}>No se pudieron cargar las campañas.</Alert>
                            ) : todas.length === 0 ? (
                                <EmptyState compact title="No hay campañas enviando" description="Cuando arranque una, vas a ver acá su avance." />
                            ) : (
                                <Box sx={{ mt: -1.5 }}>
                                    {wapi.map((c) => <FilaCampania key={`w-${c.id}`} c={c} canal="WhatsApp API" />)}
                                    {email.map((c) => <FilaCampania key={`e-${c.id}`} c={c} canal="Email" />)}
                                    {waweb.map((c) => <FilaCampania key={`ww-${c.id}`} c={c} canal="WhatsApp Web" />)}
                                </Box>
                            )}
                        </SectionCard>
                    )}

                    {verInbox && (
                        <SectionCard
                            title="Esperan respuesta"
                            noPadding
                            action={<Button component={RouterLink} to="/wapi/inbox" size="small" sx={{ minHeight: 36 }}>Ir a Conversaciones</Button>}
                        >
                            {esperan.length === 0 ? (
                                <EmptyState compact icon={MessagesSquare} title="Nada pendiente" description="No hay conversaciones tuyas sin leer ni chats sin asignar." />
                            ) : (
                                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, pb: 1 }}>
                                    {esperan.map((c) => {
                                        const min = c.ultimoMensajeAt ? (Date.now() - new Date(c.ultimoMensajeAt).getTime()) / 60000 : 0;
                                        return (
                                            <Box component="li" key={c.id}>
                                                <Box
                                                    component={RouterLink}
                                                    to={`/wapi/inbox?c=${c.id}`}
                                                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, sm: 2.5 }, py: 1.25, minHeight: 56, textDecoration: 'none', color: 'inherit', borderTop: 1, borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}
                                                >
                                                    <AvatarUsuario nombre={c.nombre || '#'} size={38} sx={{ bgcolor: 'action.hover', color: 'text.secondary' }} />
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                                                            <Typography fontWeight={600} fontSize={14} noWrap sx={{ flex: 1 }}>{c.nombre || c.numero}</Typography>
                                                            <Typography variant="caption" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: min > 120 ? 'error.main' : min > 60 ? 'warning.dark' : 'text.secondary' }}>
                                                                {hace(c.ultimoMensajeAt)}
                                                            </Typography>
                                                        </Box>
                                                        <Typography variant="body2" color="text.secondary" noWrap>
                                                            {c.estado === 'sin_asignar' ? 'Sin asignar · ' : ''}{vistaPrevia(c)}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )}
                        </SectionCard>
                    )}
                </Box>

                {!verInbox && !verCampanias && (
                    <EmptyState title="Bienvenido a Sender" description="Usá el menú para ir a las pantallas que tu rol tiene habilitadas." />
                )}
            </Stack>
        </PageContainer>
    );
}
