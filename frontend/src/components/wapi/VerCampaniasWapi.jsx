import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Box, Button, CircularProgress, FormControlLabel, IconButton, InputAdornment, LinearProgress, ListItemIcon,
    ListItemText, Menu, MenuItem, MenuList, Radio, RadioGroup, Tab, Tabs, TablePagination, TextField, Typography,
} from '@mui/material';
import { Ban, CalendarClock, CheckCircle2, Megaphone, MoreVertical, Pause, Plus, Radio as RadioIcon, Search, Terminal, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { useAlReanudar, useEventoSocket } from '../../context/SocketContext';
import { migasDe } from '../layout/navConfig';
import {
    BloqueEstado, ConfirmDialog, DataTableResponsive, EmptyState, PageHeader, ResponsiveDialog, SectionCard, StatusChip,
} from '../ui';
import { PESTANIAS_CAMPANIAS, estadoCampania } from '../campanias/estados';
import { cargarLineas, nombreDeLinea, pedirAvance, porcentaje } from '../campanias/wapi/datos';
import SalaEnVivo from '../campanias/wapi/SalaEnVivo';
import AgendarCampaniaDialog from '../campanias/wapi/AgendarCampaniaDialog';
import SubirCampaniaWapiModal from './SubirCampaniaWapiModal';
import CampañaLogModal from '../CampañaLogModal';

const EN_CURSO = ['procesando', 'pausada'];
const POR_PAGINA = [10, 25, 50];
// Detalles (línea de cada campaña) que se piden por pestaña: la lista del backend no trae la línea.
const MAX_DETALLES = 100;

const formatoFecha = (valor) => (valor
    ? new Date(valor).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null);

const numero = (n) => (n ?? 0).toLocaleString('es-AR');

export default function VerCampaniasWapi() {
    const navigate = useNavigate();
    const feedback = useFeedback();
    const { hasPermiso } = useAuth();
    const puedeVerReporte = hasPermiso('wapi.analitica');
    const [params, setParams] = useSearchParams();

    const [campanias, setCampanias] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState(false);
    const [avances, setAvances] = useState({}); // { [id]: { procesados, total } }
    const [detalles, setDetalles] = useState({}); // { [id]: { configId } }
    const [lineas, setLineas] = useState([]);
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(10);

    const [modalNueva, setModalNueva] = useState(false);
    const [modalLog, setModalLog] = useState(null); // { id, nombre }
    const [agendar, setAgendar] = useState(null);
    const [detalle, setDetalle] = useState(null);
    const [confirmar, setConfirmar] = useState(null); // { tipo: 'enviar'|'pausar'|'cierre'|'eliminar', c }
    const [estadoCierre, setEstadoCierre] = useState('finalizada');
    const [menu, setMenu] = useState(null); // { ancla, c }
    const [accionando, setAccionando] = useState(false);

    const tabInicial = useRef(null);
    const recargaPendiente = useRef(null);

    // ── Carga ────────────────────────────────────────────────────────────────

    // El avance de lo que está en curso sale de la base (no del socket): una campaña pausada no emite nada.
    const refrescarAvances = useCallback((lista) => {
        lista.filter((c) => EN_CURSO.includes(c.estado)).forEach(async (c) => {
            try {
                const a = await pedirAvance(c.id);
                setAvances((prev) => ({
                    ...prev,
                    [c.id]: { procesados: Math.max(prev[c.id]?.procesados ?? 0, a.procesados), total: c.contactosCount },
                }));
            } catch { /* el avance queda en "—"; el resto de la fila sigue sirviendo */ }
        });
    }, []);

    const cargar = useCallback(async (silencioso = false) => {
        if (!silencioso) setCargando(true);
        try {
            const res = await api.get('/wapi/campanias');
            const lista = res.data.map((c) => ({ ...c, contactosCount: c._count?.contactos ?? 0 }));
            setCampanias(lista);
            setErrorCarga(false);
            refrescarAvances(lista);
        } catch (err) {
            // Una recarga silenciosa que falla no tapa la lista que ya se ve.
            if (!silencioso) setErrorCarga(true);
            else feedback.error(mensajeDeError(err, 'No se pudieron actualizar las campañas.'));
        } finally {
            if (!silencioso) setCargando(false);
        }
    }, [feedback, refrescarAvances]);

    // Varios eventos juntos (arranca una, termina otra) son una sola recarga.
    const recargarPronto = useCallback(() => {
        clearTimeout(recargaPendiente.current);
        recargaPendiente.current = setTimeout(() => cargar(true), 600);
    }, [cargar]);

    useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => () => clearTimeout(recargaPendiente.current), []);
    useEffect(() => { cargarLineas().then(setLineas); }, []);

    // El Inicio enlaza a /wapi/campanias?nueva=1: abre el asistente y deja la URL limpia.
    useEffect(() => {
        if (params.get('nueva') === '1') {
            setModalNueva(true);
            const sig = new URLSearchParams(params);
            sig.delete('nueva');
            setParams(sig, { replace: true });
        }
    }, [params, setParams]);

    // ── Tiempo real ──────────────────────────────────────────────────────────

    useEventoSocket('progreso', ({ campañaId, enviados, total }) => {
        setAvances((prev) => ({ ...prev, [campañaId]: { procesados: enviados, total } }));
    });
    // Estos eventos son globales, llegan con el id solo y los ids se repiten entre canales (la campaña de email 57 no es
    // la de WhatsApp API 57): no se aplica el estado que traen, se recarga la lista, que dice el estado real.
    useEventoSocket('campania_estado', recargarPronto);
    useEventoSocket('campania_finalizada', recargarPronto);
    useEventoSocket('campania_error', recargarPronto);
    useAlReanudar(() => cargar(true));

    // ── Pestañas, búsqueda y filtro (todo en la URL) ───────────────────────────

    const conteos = useMemo(() => Object.fromEntries(
        PESTANIAS_CAMPANIAS.map((p) => [p.id, campanias.filter((c) => p.estados.includes(c.estado)).length]),
    ), [campanias]);

    // La pestaña por defecto es la primera con campañas, calculada una sola vez para que no salte sola.
    if (tabInicial.current === null && !cargando) {
        tabInicial.current = PESTANIAS_CAMPANIAS.find((p) => conteos[p.id] > 0)?.id ?? PESTANIAS_CAMPANIAS[0].id;
    }
    const tabId = PESTANIAS_CAMPANIAS.some((p) => p.id === params.get('tab')) ? params.get('tab') : (tabInicial.current ?? PESTANIAS_CAMPANIAS[0].id);
    const pestania = PESTANIAS_CAMPANIAS.find((p) => p.id === tabId);
    const busqueda = params.get('q') ?? '';
    const filtroLinea = params.get('linea') ?? '';

    const cambiarParam = (clave, valor) => {
        const sig = new URLSearchParams(params);
        if (valor) sig.set(clave, valor);
        else sig.delete(clave);
        setParams(sig, { replace: clave !== 'tab' });
        setPagina(0);
    };

    const delTab = useMemo(() => campanias.filter((c) => pestania.estados.includes(c.estado)), [campanias, pestania]);

    // La línea de cada campaña no viene en la lista: se pide el detalle de las que se ven en la pestaña.
    useEffect(() => {
        const faltan = delTab.filter((c) => c.configId === undefined && detalles[c.id] === undefined).slice(0, MAX_DETALLES);
        if (faltan.length === 0) return undefined;
        let activo = true;
        (async () => {
            for (const c of faltan) {
                try {
                    const { data } = await api.get(`/wapi/campanias/${c.id}`);
                    if (activo) setDetalles((prev) => ({ ...prev, [c.id]: { configId: data.configId ?? null } }));
                } catch { /* sin línea para esa fila */ }
            }
        })();
        return () => { activo = false; };
    }, [delTab, detalles]);

    const configIdDe = (c) => c.configId ?? detalles[c.id]?.configId ?? null;
    const lineaDe = (c) => nombreDeLinea(lineas, configIdDe(c));

    const visibles = delTab.filter((c) => {
        if (busqueda && !c.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
        if (filtroLinea && String(configIdDe(c)) !== filtroLinea) return false;
        return true;
    });
    const paginaSegura = Math.min(pagina, Math.max(Math.ceil(visibles.length / porPagina) - 1, 0));
    const filas = visibles.slice(paginaSegura * porPagina, paginaSegura * porPagina + porPagina);

    // ── Acciones ─────────────────────────────────────────────────────────────

    const ejecutar = async (peticion, mensajeOk, mensajeError) => {
        setAccionando(true);
        try {
            await peticion();
            if (mensajeOk) feedback.exito(mensajeOk);
            setConfirmar(null);
            cargar(true);
            return true;
        } catch (err) {
            feedback.error(mensajeDeError(err, mensajeError));
            return false;
        } finally {
            setAccionando(false);
        }
    };

    const enviar = (c) => ejecutar(() => api.post(`/wapi/campanias/${c.id}/enviar`), 'Envío iniciado.', 'No se pudo iniciar el envío.');
    const pausar = (c) => ejecutar(() => api.post(`/wapi/campanias/${c.id}/pausar`), 'Campaña en pausa.', 'No se pudo pausar la campaña.');
    const reanudar = (c) => ejecutar(() => api.post(`/wapi/campanias/${c.id}/reanudar`), 'Envío reanudado.', 'No se pudo reanudar la campaña.');
    const eliminar = (c) => ejecutar(() => api.delete(`/wapi/campanias/${c.id}`), 'Campaña eliminada.', 'No se pudo eliminar la campaña.');
    const cerrar = (c) => ejecutar(
        () => api.post(`/wapi/campanias/${c.id}/forzar-cierre`, { estado: estadoCierre }),
        `Campaña marcada como ${estadoCierre === 'finalizada' ? 'terminada' : 'con error'}.`,
        'No se pudo cerrar la campaña.',
    );

    const pedirConfirmacion = (tipo, c) => {
        if (tipo === 'cierre') setEstadoCierre(c.estado === 'error' ? 'finalizada' : 'error');
        setConfirmar({ tipo, c });
    };

    // Lo que falta enviar, para decir cuánto se corta o se manda.
    const faltantes = (c) => {
        const a = avances[c.id];
        return a ? Math.max(c.contactosCount - a.procesados, 0) : null;
    };

    const accionPrincipal = (c) => {
        switch (c.estado) {
            case 'pendiente': return { texto: 'Enviar', onClick: () => pedirConfirmacion('enviar', c), variant: 'contained' };
            case 'agendada': return { texto: 'Ver', onClick: () => setDetalle(c) };
            case 'procesando': return { texto: 'Ver en vivo', onClick: () => navigate(`/wapi/live?campania=${c.id}`) };
            case 'pausada': return { texto: 'Reanudar', onClick: () => reanudar(c), variant: 'contained', bloquea: true };
            default:
                return puedeVerReporte
                    ? { texto: 'Ver reporte', onClick: () => navigate('/wapi/analitica') }
                    : { texto: 'Ver log', onClick: () => setModalLog({ id: c.id, nombre: c.nombre }) };
        }
    };

    const columnas = [
        {
            key: 'nombre',
            label: 'Campaña',
            primary: true,
            render: (c) => (
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{c.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 12.5, overflowWrap: 'anywhere' }}>
                        {c.template?.metaNombre ?? 'Sin plantilla'}
                    </Typography>
                </Box>
            ),
        },
        { key: 'linea', label: 'Línea', render: (c) => lineaDe(c) ?? '—' },
        { key: 'contactos', label: 'Contactos', align: 'right', render: (c) => numero(c.contactosCount) },
        {
            key: 'avance',
            label: 'Avance',
            render: (c) => {
                if (!EN_CURSO.includes(c.estado)) return '—';
                const a = avances[c.id];
                const pct = porcentaje(a?.procesados, c.contactosCount);
                if (pct === null) return '—';
                return (
                    <Box sx={{ minWidth: 100 }}>
                        <LinearProgress
                            variant="determinate"
                            value={pct}
                            color={c.estado === 'pausada' ? 'warning' : 'primary'}
                            aria-label={`Avance de ${c.nombre}`}
                            sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
                        />
                        <Typography variant="caption" sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                            {pct}% · {numero(a.procesados)}/{numero(c.contactosCount)}
                        </Typography>
                    </Box>
                );
            },
        },
        {
            key: 'estado',
            label: 'Estado',
            render: (c) => {
                const e = estadoCampania(c.estado);
                return <StatusChip label={e.label} tono={e.tono} vivo={e.vivo} />;
            },
        },
        {
            key: 'inicio',
            label: 'Inicio o agenda',
            hideBelow: 'lg',
            render: (c) => {
                if (c.estado === 'agendada') return formatoFecha(c.agendadoAt) ?? '—';
                if (c.estado === 'pendiente') return `Creada ${formatoFecha(c.createdAt) ?? ''}`.trim();
                return formatoFecha(c.enviadoAt ?? c.createdAt) ?? '—';
            },
        },
    ];

    const acciones = (c) => {
        const p = accionPrincipal(c);
        return (
            <>
                <Button
                    size="small"
                    variant={p.variant ?? 'outlined'}
                    onClick={p.onClick}
                    disabled={p.bloquea && accionando}
                    startIcon={p.bloquea && accionando ? <CircularProgress size={14} color="inherit" /> : undefined}
                >
                    {p.texto}
                </Button>
                <IconButton
                    aria-label={`Más acciones de ${c.nombre}`}
                    aria-haspopup="menu"
                    onClick={(e) => setMenu({ ancla: e.currentTarget, c })}
                    sx={{ width: { xs: 44, md: 36 }, height: { xs: 44, md: 36 } }}
                >
                    <MoreVertical size={18} strokeWidth={1.75} aria-hidden />
                </IconButton>
            </>
        );
    };

    // El menú "Más": todo lo que no es la acción principal de la fila.
    const itemsMenu = (c) => {
        const items = [];
        if (c.estado === 'pendiente') items.push({ texto: 'Agendar', Icono: CalendarClock, onClick: () => setAgendar(c) });
        if (!['pendiente', 'agendada'].includes(c.estado)) items.push({ texto: 'Ver log', Icono: Terminal, onClick: () => setModalLog({ id: c.id, nombre: c.nombre }) });
        if (c.estado === 'procesando') items.push({ texto: 'Pausar', Icono: Pause, onClick: () => pedirConfirmacion('pausar', c) });
        if (c.estado === 'procesando') items.push({ texto: 'Forzar cierre', Icono: Ban, peligro: true, onClick: () => pedirConfirmacion('cierre', c) });
        if (c.estado === 'error') items.push({ texto: 'Marcar como terminada', Icono: CheckCircle2, onClick: () => pedirConfirmacion('cierre', c) });
        if (c.estado !== 'procesando') items.push({ texto: 'Eliminar', Icono: Trash2, peligro: true, onClick: () => pedirConfirmacion('eliminar', c) });
        return items;
    };

    const lineasUsadas = lineas.filter((l) => l.activo !== false);
    const c = confirmar?.c;
    const lineaConfirmar = c ? lineaDe(c) : null;

    return (
        <>
            {/* Una sala por cada campaña que se está enviando: así llega el avance sin recrear el socket */}
            {campanias.filter((x) => x.estado === 'procesando').map((x) => <SalaEnVivo key={x.id} id={x.id} />)}

            <PageHeader
                title="Campañas"
                subtitle="Envíos con plantillas aprobadas por Meta, por línea."
                breadcrumbs={migasDe('/wapi/campanias')}
                actions={(
                    <>
                        <Button variant="outlined" startIcon={<RadioIcon size={18} strokeWidth={1.75} aria-hidden />} onClick={() => navigate('/wapi/live')}>
                            Monitor en vivo
                        </Button>
                        <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={() => setModalNueva(true)}>
                            Nueva campaña
                        </Button>
                    </>
                )}
            />

            <Tabs
                value={tabId}
                onChange={(_, v) => cambiarParam('tab', v)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                aria-label="Estados de campaña"
                sx={{ mb: 2, minHeight: 44, '& .MuiTab-root': { minHeight: 44, textTransform: 'none' } }}
            >
                {PESTANIAS_CAMPANIAS.map((p) => (
                    <Tab key={p.id} value={p.id} label={`${p.label} (${conteos[p.id]})`} />
                ))}
            </Tabs>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 2 }}>
                <TextField
                    size="small"
                    placeholder="Buscar por nombre"
                    value={busqueda}
                    onChange={(e) => cambiarParam('q', e.target.value)}
                    inputProps={{ 'aria-label': 'Buscar campaña por nombre' }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} strokeWidth={1.75} aria-hidden /></InputAdornment> }}
                    sx={{ flex: 1, maxWidth: { sm: 360 } }}
                />
                {lineasUsadas.length > 1 && (
                    <TextField
                        select
                        size="small"
                        label="Línea"
                        value={filtroLinea}
                        onChange={(e) => cambiarParam('linea', e.target.value)}
                        sx={{ minWidth: { sm: 200 } }}
                    >
                        <MenuItem value="">Todas las líneas</MenuItem>
                        {lineasUsadas.map((l) => <MenuItem key={l.id} value={String(l.id)}>{l.nombre ?? `Línea ${l.id}`}</MenuItem>)}
                    </TextField>
                )}
            </Box>

            {errorCarga ? (
                <BloqueEstado estado="error" mensaje="No se pudieron cargar las campañas." onReintentar={() => cargar()} />
            ) : (
                <SectionCard noPadding>
                    <DataTableResponsive
                        ariaLabel={`Campañas: ${pestania.label}`}
                        columns={columnas}
                        rows={filas}
                        loading={cargando}
                        acciones={acciones}
                        empty={(
                            <EmptyState
                                icon={Megaphone}
                                title={busqueda || filtroLinea ? 'Ninguna campaña coincide con la búsqueda' : `No hay campañas en «${pestania.label}»`}
                                description={busqueda || filtroLinea ? 'Probá con otro nombre o con otra línea.' : undefined}
                                compact
                            />
                        )}
                    />
                    {!cargando && visibles.length > POR_PAGINA[0] && (
                        <TablePagination
                            component="div"
                            rowsPerPageOptions={POR_PAGINA}
                            count={visibles.length}
                            rowsPerPage={porPagina}
                            page={paginaSegura}
                            onPageChange={(_, p) => setPagina(p)}
                            onRowsPerPageChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(0); }}
                            labelRowsPerPage="Por página"
                            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                            sx={{ '.MuiTablePagination-selectLabel, .MuiTablePagination-input': { display: { xs: 'none', sm: 'flex' } } }}
                        />
                    )}
                </SectionCard>
            )}

            {/* Menú "Más" */}
            <Menu anchorEl={menu?.ancla} open={!!menu} onClose={() => setMenu(null)}>
                <MenuList dense={false} sx={{ py: 0 }}>
                    {menu && itemsMenu(menu.c).map(({ texto, Icono, onClick, peligro }) => (
                        <MenuItem
                            key={texto}
                            disabled={accionando}
                            onClick={() => { setMenu(null); onClick(); }}
                            sx={{ minHeight: 44, color: peligro ? 'error.main' : undefined }}
                        >
                            <ListItemIcon sx={{ color: 'inherit' }}><Icono size={18} strokeWidth={1.75} aria-hidden /></ListItemIcon>
                            <ListItemText>{texto}</ListItemText>
                        </MenuItem>
                    ))}
                </MenuList>
            </Menu>

            {/* Asistente de nueva campaña */}
            <SubirCampaniaWapiModal
                open={modalNueva}
                onClose={() => setModalNueva(false)}
                onCreado={(data) => {
                    setModalNueva(false);
                    const base = `Campaña creada con ${numero(data.totalContactos)} contactos`;
                    if (data.omitidosPorBaja) feedback.aviso(`${base}. Se omitieron ${numero(data.omitidosPorBaja)} por estar dados de baja.`);
                    else feedback.exito(`${base}.`);
                    cargar(true);
                }}
            />

            <AgendarCampaniaDialog campania={agendar} onClose={() => setAgendar(null)} onAgendada={() => cargar(true)} />

            {/* Lo agendado no tiene pantalla propia: acá se ve de dónde sale y cuándo */}
            <ResponsiveDialog
                open={!!detalle}
                onClose={() => setDetalle(null)}
                title={detalle?.nombre ?? ''}
                maxWidth="xs"
                cerrarConFondo
                actions={<Button onClick={() => setDetalle(null)}>Cerrar</Button>}
            >
                {detalle && (
                    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1 }}>
                        {[
                            ['Envío agendado', formatoFecha(detalle.agendadoAt) ?? '—'],
                            ['Línea', lineaDe(detalle) ?? '—'],
                            ['Plantilla', detalle.template?.metaNombre ?? '—'],
                            ['Contactos', numero(detalle.contactosCount)],
                        ].map(([k, v]) => (
                            <React.Fragment key={k}>
                                <Typography component="dt" variant="body2" color="text.secondary">{k}</Typography>
                                <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{v}</Typography>
                            </React.Fragment>
                        ))}
                    </Box>
                )}
            </ResponsiveDialog>

            {/* Confirmaciones: dicen qué y cuánto */}
            <ConfirmDialog
                open={confirmar?.tipo === 'enviar'}
                titulo="Enviar la campaña ahora"
                mensaje={c ? `Se van a enviar ${numero(c.contactosCount)} mensajes${lineaConfirmar ? ` desde la línea ${lineaConfirmar}` : ''}. Una vez que arranca, se puede pausar pero no deshacer lo ya enviado.` : ''}
                confirmarTexto="Enviar ahora"
                cargando={accionando}
                onCancelar={() => setConfirmar(null)}
                onConfirmar={() => enviar(c)}
            />
            <ConfirmDialog
                open={confirmar?.tipo === 'pausar'}
                titulo="Pausar la campaña"
                mensaje={c ? `Se deja de enviar «${c.nombre}»${faltantes(c) !== null ? `: quedan ${numero(faltantes(c))} mensajes sin enviar` : ''}. Podés reanudarla cuando quieras.` : ''}
                confirmarTexto="Pausar"
                cargando={accionando}
                onCancelar={() => setConfirmar(null)}
                onConfirmar={() => pausar(c)}
            />
            <ConfirmDialog
                open={confirmar?.tipo === 'cierre'}
                titulo="Forzar el cierre"
                peligro
                mensaje={c ? `«${c.nombre}» deja de enviar${faltantes(c) ? ` y quedan ${numero(faltantes(c))} mensajes sin mandar` : ''}. Elegí cómo queda registrada.` : ''}
                confirmarTexto="Cerrar campaña"
                cargando={accionando}
                onCancelar={() => setConfirmar(null)}
                onConfirmar={() => cerrar(c)}
            >
                <RadioGroup value={estadoCierre} onChange={(e) => setEstadoCierre(e.target.value)} aria-label="Estado final">
                    <FormControlLabel value="finalizada" control={<Radio />} label="Terminada" sx={{ minHeight: 44 }} />
                    <FormControlLabel value="error" control={<Radio />} label="Con error" sx={{ minHeight: 44 }} />
                </RadioGroup>
            </ConfirmDialog>
            <ConfirmDialog
                open={confirmar?.tipo === 'eliminar'}
                titulo="Eliminar la campaña"
                peligro
                mensaje={c ? `Se elimina «${c.nombre}» con sus ${numero(c.contactosCount)} contactos. Los reportes de lo que ya se envió se conservan.` : ''}
                confirmarTexto="Eliminar"
                cargando={accionando}
                onCancelar={() => setConfirmar(null)}
                onConfirmar={() => eliminar(c)}
            />

            <CampañaLogModal
                open={!!modalLog}
                onClose={() => setModalLog(null)}
                campañaId={modalLog?.id}
                campañaNombre={modalLog?.nombre}
                tipo="wapi"
                estadoCampaña={campanias.find((x) => x.id === modalLog?.id)?.estado}
                progreso={modalLog && avances[modalLog.id] ? { enviados: avances[modalLog.id].procesados, total: avances[modalLog.id].total } : null}
                onPausar={modalLog ? () => { const x = campanias.find((y) => y.id === modalLog.id); if (x) pausar(x); } : null}
                onForzarCierre={modalLog ? () => { const x = campanias.find((y) => y.id === modalLog.id); if (x) pedirConfirmacion('cierre', x); } : null}
            />
        </>
    );
}
