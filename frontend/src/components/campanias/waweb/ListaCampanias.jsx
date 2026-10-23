import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box, Button, Divider, FormControlLabel, IconButton, InputAdornment, LinearProgress, ListItemIcon, ListItemText, Menu, MenuItem, Radio,
    RadioGroup, Tab, Tabs, TablePagination, TextField, Tooltip, Typography,
} from '@mui/material';
import { Ban, CalendarClock, CircleCheck, MoreVertical, Pause, Play, Plus, Search, Send, Terminal, Trash2, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../api/axios';
import { mensajeDeError, useFeedback } from '../../../context/FeedbackContext';
import { migasDe } from '../../layout/navConfig';
import { BloqueEstado, ConfirmDialog, DataTableResponsive, EmptyState, PageContainer, PageHeader, SectionCard, StatusChip } from '../../ui';
import CampañaLogModal from '../../CampañaLogModal';
import { PESTANIAS_CAMPANIAS } from '../estados';
import DialogoContactos from './DialogoContactos';
import { chipDeEstado, estadoNormalizado, fechaCorta, pluralizar } from './formatos';
import SalasCampanias from './SalasCampanias';
import useCampaniasEnVivo from './useCampaniasEnVivo';

// La lista de campañas de Email y de WhatsApp Web, que son la misma pantalla con otro backend. Cada canal le pasa
// sus rutas, su diálogo de subida y su diálogo de envío; todo lo demás (pestañas, buscador, acciones por estado,
// confirmaciones, tiempo real) es común, así que no se puede desalinear entre los dos.

const ESTADOS_CON_LOG = ['procesando', 'pausada', 'pausa_pendiente', 'error', 'finalizada'];
const ESTADOS_ELIMINABLES = ['pendiente', 'programada', 'pausada', 'finalizada', 'error'];

const VACIOS = {
    'en-curso': { title: 'No hay campañas en curso', description: 'Las que estén enviando o en pausa aparecen acá.' },
    agendadas: { title: 'No hay campañas agendadas', description: 'Agendá un borrador para que salga solo a la hora que elijas.' },
    borradores: { title: 'No hay borradores', description: 'Subí un CSV para crear una campaña; después la enviás o la agendás.' },
    terminadas: { title: 'Todavía no terminó ninguna campaña' },
};

function ordenar(lista, pestania) {
    const fecha = (c, campo) => (c[campo] ? new Date(c[campo]).getTime() : 0);
    // Lo próximo a salir primero en las agendadas; en el resto, lo más reciente primero.
    if (pestania === 'agendadas') return [...lista].sort((a, b) => fecha(a, 'agendadoAt') - fecha(b, 'agendadoAt'));
    return [...lista].sort((a, b) => fecha(b, 'createdAt') - fecha(a, 'createdAt'));
}

/**
 * @param {object} props
 * @param {string} props.ruta Ruta de la pantalla (para las migas de pan).
 * @param {string} props.subtitulo
 * @param {string} props.urlLista GET que devuelve las campañas.
 * @param {(c: any) => any} props.normalizar Deja `contactosCount` en cada campaña. Tiene que ser una función estable.
 * @param {string} props.apiBase Base de las rutas de la campaña (`/email/campanias`, `/whatsapp/campanias`).
 * @param {string} props.eventoProgreso Evento del socket con el avance.
 * @param {'email'|'whatsapp'} props.tipoLog
 * @param {boolean} props.puedePausar El canal sabe pausar y reanudar (Email no).
 * @param {{singular: string, plural: string}} props.unidad Lo que se envía: mail o mensaje.
 * @param {React.ComponentType<any>} props.SubirDialogo
 * @param {React.ComponentType<any>} props.EnviarDialogo
 * @param {(c: any) => Promise<any[]>|any[]} props.cargarContactos
 * @param {'email'|'numero'} props.campoContacto
 * @param {string} props.etiquetaContacto
 */
export default function ListaCampanias({
    ruta, subtitulo, urlLista, normalizar, apiBase, eventoProgreso, tipoLog, puedePausar, unidad,
    SubirDialogo, EnviarDialogo, cargarContactos, campoContacto, etiquetaContacto,
}) {
    const feedback = useFeedback();
    const [params, setParams] = useSearchParams();
    const pestania = PESTANIAS_CAMPANIAS.find((p) => p.id === params.get('tab')) ?? PESTANIAS_CAMPANIAS[0];
    const busqueda = params.get('q') ?? '';

    const [campanias, setCampanias] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState(false);
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(10);

    const [menu, setMenu] = useState(null); // { anchor, c }
    const [modalNueva, setModalNueva] = useState(false);
    const [envio, setEnvio] = useState(null); // { c, agendar }
    const [log, setLog] = useState(null); // { id, nombre }
    const [confirmar, setConfirmar] = useState(null); // { tipo, c }
    const [estadoFinal, setEstadoFinal] = useState('finalizada');
    const [trabajando, setTrabajando] = useState(false);
    const [ocupados, setOcupados] = useState(() => new Set());
    const [contactosDe, setContactosDe] = useState(null);
    const [contactos, setContactos] = useState({ lista: [], cargando: false, error: null });

    const normalizarRef = useRef(normalizar);
    normalizarRef.current = normalizar;

    const cargar = useCallback(async ({ silent = false } = {}) => {
        if (!silent) {
            setCargando(true);
            setErrorCarga(false);
        }
        try {
            const res = await api.get(urlLista);
            setCampanias(res.data.map(normalizarRef.current));
        } catch {
            // Una recarga silenciosa (la dispara el socket) que falla deja lo que ya se ve; solo la carga a la vista
            // muestra el error.
            if (!silent) setErrorCarga(true);
        } finally {
            if (!silent) setCargando(false);
        }
    }, [urlLista]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const { progresos, bloqueadas } = useCampaniasEnVivo({ campanias, eventoProgreso, recargar: cargar });

    // ── Pestañas, búsqueda y página ──
    const cambiarPestania = (_, id) => {
        setPagina(0);
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', id);
            return next;
        });
    };

    const cambiarBusqueda = (valor) => {
        setPagina(0);
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (valor) next.set('q', valor);
            else next.delete('q');
            return next;
        }, { replace: true });
    };

    const irAPestania = (id) => {
        setPagina(0);
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', id);
            return next;
        });
    };

    const porPestania = useMemo(() => {
        const mapa = {};
        for (const p of PESTANIAS_CAMPANIAS) mapa[p.id] = campanias.filter((c) => p.estados.includes(estadoNormalizado(c.estado)));
        return mapa;
    }, [campanias]);

    const filtradas = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        const base = porPestania[pestania.id] ?? [];
        return ordenar(q ? base.filter((c) => c.nombre.toLowerCase().includes(q)) : base, pestania.id);
    }, [porPestania, pestania.id, busqueda]);

    const ultimaPagina = Math.max(0, Math.ceil(filtradas.length / porPagina) - 1);
    const paginaVisible = Math.min(pagina, ultimaPagina);
    const visibles = filtradas.slice(paginaVisible * porPagina, paginaVisible * porPagina + porPagina);

    // ── Acciones ──
    const marcarOcupado = (id, valor) => setOcupados((prev) => {
        const next = new Set(prev);
        if (valor) next.add(id);
        else next.delete(id);
        return next;
    });

    const abrirContactos = async (c) => {
        setContactosDe(c);
        setContactos({ lista: [], cargando: true, error: null });
        try {
            const lista = await cargarContactos(c);
            setContactos({ lista: Array.isArray(lista) ? lista : [], cargando: false, error: null });
        } catch (e) {
            setContactos({ lista: [], cargando: false, error: mensajeDeError(e, 'No se pudieron cargar los contactos.') });
        }
    };

    const reanudar = async (c) => {
        marcarOcupado(c.id, true);
        try {
            await api.post(`${apiBase}/${c.id}/reanudar`);
            feedback.exito(`Se reanudó «${c.nombre}».`);
            await cargar({ silent: true });
        } catch (e) {
            feedback.error(mensajeDeError(e, 'No se pudo reanudar la campaña.'));
        } finally {
            marcarOcupado(c.id, false);
        }
    };

    const pedir = (tipo, c) => {
        setEstadoFinal('finalizada');
        setConfirmar({ tipo, c });
    };

    const ejecutarConfirmacion = async () => {
        const { tipo, c } = confirmar;
        setTrabajando(true);
        try {
            if (tipo === 'eliminar') {
                await api.delete(`${apiBase}/${c.id}`);
                feedback.exito(`Se eliminó «${c.nombre}».`);
            } else if (tipo === 'pausar') {
                await api.post(`${apiBase}/${c.id}/pausar`);
                feedback.info(`Pausa pedida para «${c.nombre}»: se detiene en unos instantes.`);
            } else {
                const estado = tipo === 'finalizar' ? 'finalizada' : estadoFinal;
                await api.post(`${apiBase}/${c.id}/forzar-cierre`, { estado });
                feedback.exito(`«${c.nombre}» quedó como ${estado === 'finalizada' ? 'terminada' : 'con error'}.`);
            }
            setConfirmar(null);
            await cargar({ silent: true });
        } catch (e) {
            const generico = {
                eliminar: 'No se pudo eliminar la campaña.',
                pausar: 'No se pudo pausar la campaña.',
            }[tipo] ?? 'No se pudo forzar el cierre.';
            feedback.error(mensajeDeError(e, generico));
        } finally {
            setTrabajando(false);
        }
    };

    const faltan = (c) => {
        const p = progresos[c.id];
        return p ? Math.max(0, p.total - p.enviados) : c.contactosCount;
    };

    const textoConfirmacion = (tipo, c) => {
        if (tipo === 'eliminar') {
            return {
                titulo: '¿Eliminar la campaña?',
                confirmarTexto: 'Eliminar',
                peligro: true,
                mensaje: `Se va a eliminar «${c.nombre}» con sus ${pluralizar(c.contactosCount, 'contacto', 'contactos')}. Los reportes se conservan.`,
            };
        }
        if (tipo === 'pausar') {
            return {
                titulo: '¿Pausar el envío?',
                confirmarTexto: 'Pausar',
                mensaje: `«${c.nombre}» deja de enviar y quedan en espera ${pluralizar(faltan(c), unidad.singular, unidad.plural)}. Después podés reanudarla desde donde quedó.`,
            };
        }
        if (tipo === 'finalizar') {
            return {
                titulo: '¿Marcar como terminada?',
                confirmarTexto: 'Marcar terminada',
                mensaje: `«${c.nombre}» pasa a Terminada. Lo que ya salió no se deshace y lo que faltaba no se va a enviar.`,
            };
        }
        return {
            titulo: 'Forzar el cierre',
            confirmarTexto: 'Forzar cierre',
            peligro: true,
            mensaje: `«${c.nombre}» figura enviando pero hace rato que no avanza. Se corta el seguimiento: faltan ${pluralizar(faltan(c), unidad.singular, unidad.plural)} por enviar y no se van a enviar. Si el proceso sigue vivo en el servidor, termina solo y corrige el estado.`,
        };
    };

    const accionPrincipal = (c) => {
        switch (c.estado) {
            case 'pendiente':
                return { texto: 'Enviar', icono: Send, onClick: () => setEnvio({ c, agendar: false }) };
            case 'procesando':
                return bloqueadas.has(c.id)
                    ? { texto: 'Forzar cierre', icono: Ban, color: 'error', clave: 'cierre', onClick: () => pedir('cierre', c) }
                    : { texto: 'Ver log', icono: Terminal, clave: 'log', onClick: () => setLog({ id: c.id, nombre: c.nombre }) };
            case 'pausa_pendiente':
                return { texto: 'Ver log', icono: Terminal, clave: 'log', onClick: () => setLog({ id: c.id, nombre: c.nombre }) };
            case 'pausada':
                return puedePausar
                    ? { texto: 'Reanudar', icono: Play, onClick: () => reanudar(c) }
                    : { texto: 'Ver log', icono: Terminal, clave: 'log', onClick: () => setLog({ id: c.id, nombre: c.nombre }) };
            case 'error':
                return { texto: 'Marcar terminada', icono: CircleCheck, clave: 'finalizar', onClick: () => pedir('finalizar', c) };
            default:
                return { texto: 'Ver contactos', icono: Users, clave: 'contactos', onClick: () => abrirContactos(c) };
        }
    };

    const itemsDelMenu = (c) => {
        const principal = accionPrincipal(c).clave;
        const items = [];
        if (c.estado === 'pendiente') items.push({ texto: 'Agendar envío', icono: CalendarClock, onClick: () => setEnvio({ c, agendar: true }) });
        if (principal !== 'contactos') items.push({ texto: 'Ver contactos', icono: Users, onClick: () => abrirContactos(c) });
        if (principal !== 'log' && ESTADOS_CON_LOG.includes(c.estado)) items.push({ texto: 'Ver log', icono: Terminal, onClick: () => setLog({ id: c.id, nombre: c.nombre }) });
        if (c.estado === 'procesando' && puedePausar) items.push({ texto: 'Pausar', icono: Pause, onClick: () => pedir('pausar', c) });
        if (c.estado === 'procesando' && principal !== 'cierre') items.push({ texto: 'Forzar cierre', icono: Ban, onClick: () => pedir('cierre', c) });
        if (ESTADOS_ELIMINABLES.includes(c.estado)) items.push({ texto: 'Eliminar', icono: Trash2, peligro: true, separar: true, onClick: () => pedir('eliminar', c) });
        return items;
    };

    // ── Tabla ──
    const columnas = [
        { key: 'nombre', label: 'Campaña', primary: true, render: (c) => <Box component="span" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{c.nombre}</Box> },
        {
            key: 'estado',
            label: 'Estado',
            secondary: true,
            render: (c) => {
                const chip = chipDeEstado(c.estado);
                const p = progresos[c.id];
                const porcentaje = p?.total ? Math.min(100, (p.enviados / p.total) * 100) : 0;
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'flex-start', minWidth: 0, width: '100%' }}>
                        <StatusChip label={chip.label} tono={chip.tono} vivo={chip.vivo} />
                        {c.estado === 'procesando' && (
                            <Box sx={{ width: { xs: '100%', md: 170 } }}>
                                <LinearProgress
                                    variant={p ? 'determinate' : 'indeterminate'}
                                    value={porcentaje}
                                    aria-label={`Avance de ${c.nombre}`}
                                    sx={{ height: 6, borderRadius: 3 }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                    {p ? `${p.enviados.toLocaleString('es-AR')} de ${p.total.toLocaleString('es-AR')}` : 'Esperando el primer envío…'}
                                </Typography>
                            </Box>
                        )}
                        {bloqueadas.has(c.id) && c.estado === 'procesando' && (
                            <Typography variant="caption" sx={{ color: 'warning.dark' }}>Hace más de 5 min que no avanza</Typography>
                        )}
                    </Box>
                );
            },
        },
        { key: 'contactos', label: 'Contactos', align: 'right', render: (c) => c.contactosCount.toLocaleString('es-AR') },
        {
            key: 'fecha',
            label: 'Fecha',
            render: (c) => {
                const estado = estadoNormalizado(c.estado);
                if (estado === 'agendada') return `Agendada: ${fechaCorta(c.agendadoAt)}`;
                if (c.enviadoAt && (estado === 'finalizada' || c.estado === 'error')) return `Enviada: ${fechaCorta(c.enviadoAt)}`;
                return `Creada: ${fechaCorta(c.createdAt)}`;
            },
        },
    ];

    const acciones = (c) => {
        const p = accionPrincipal(c);
        const Icono = p.icono;
        return (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Button
                    size="small"
                    variant="outlined"
                    color={p.color ?? 'primary'}
                    startIcon={<Icono size={16} strokeWidth={1.75} aria-hidden />}
                    disabled={ocupados.has(c.id)}
                    onClick={p.onClick}
                >
                    {p.texto}
                </Button>
                <Tooltip title="Más acciones">
                    <IconButton
                        aria-label={`Más acciones de ${c.nombre}`}
                        aria-haspopup="menu"
                        onClick={(e) => setMenu({ anchor: e.currentTarget, c })}
                        sx={{ width: { xs: 44, md: 36 }, height: { xs: 44, md: 36 } }}
                    >
                        <MoreVertical size={18} strokeWidth={1.75} aria-hidden />
                    </IconButton>
                </Tooltip>
            </Box>
        );
    };

    const vacio = busqueda
        ? <EmptyState compact icon={Search} title={`Ninguna campaña coincide con «${busqueda}»`} description="Revisá el nombre o probá en otra pestaña." />
        : (
            <EmptyState
                compact
                icon={Send}
                title={VACIOS[pestania.id].title}
                description={VACIOS[pestania.id].description}
                action={pestania.id === 'borradores' ? { label: 'Nueva campaña', onClick: () => setModalNueva(true) } : undefined}
            />
        );

    const confirmacion = confirmar ? textoConfirmacion(confirmar.tipo, confirmar.c) : null;
    const itemsActuales = menu ? itemsDelMenu(menu.c) : [];

    return (
        <PageContainer>
            <SalasCampanias campanias={campanias} />
            <PageHeader
                title="Campañas"
                subtitle={subtitulo}
                breadcrumbs={migasDe(ruta)}
                actions={(
                    <Button variant="contained" startIcon={<Plus size={18} strokeWidth={1.75} aria-hidden />} onClick={() => setModalNueva(true)}>
                        Nueva campaña
                    </Button>
                )}
            />

            <SectionCard noPadding>
                <Tabs
                    value={pestania.id}
                    onChange={cambiarPestania}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    aria-label="Estado de las campañas"
                    sx={{ borderBottom: 1, borderColor: 'divider', px: { xs: 0.5, sm: 1.5 }, '& .MuiTab-root': { textTransform: 'none', minHeight: 48 } }}
                >
                    {PESTANIAS_CAMPANIAS.map((p) => (
                        <Tab key={p.id} value={p.id} label={`${p.label} (${porPestania[p.id]?.length ?? 0})`} />
                    ))}
                </Tabs>

                <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
                    <TextField
                        fullWidth
                        size="small"
                        value={busqueda}
                        onChange={(e) => cambiarBusqueda(e.target.value)}
                        placeholder="Buscar por nombre"
                        slotProps={{ htmlInput: { 'aria-label': 'Buscar campañas por nombre' }, input: { startAdornment: <InputAdornment position="start"><Search size={18} strokeWidth={1.75} aria-hidden /></InputAdornment> } }}
                        sx={{ maxWidth: { md: 420 } }}
                    />
                </Box>

                {errorCarga && campanias.length === 0 ? (
                    <Box sx={{ px: 2, pb: 2 }}>
                        <BloqueEstado estado="error" mensaje="No se pudieron cargar las campañas." onReintentar={() => cargar()} />
                    </Box>
                ) : (
                    <>
                        <DataTableResponsive
                            ariaLabel="Campañas"
                            columns={columnas}
                            rows={visibles}
                            rowKey={(c) => c.id}
                            onRowClick={abrirContactos}
                            acciones={acciones}
                            loading={cargando}
                            empty={vacio}
                        />
                        {!cargando && filtradas.length > 0 && (
                            <TablePagination
                                component="div"
                                count={filtradas.length}
                                page={paginaVisible}
                                onPageChange={(_, p) => setPagina(p)}
                                rowsPerPage={porPagina}
                                onRowsPerPageChange={(e) => {
                                    setPorPagina(parseInt(e.target.value, 10));
                                    setPagina(0);
                                }}
                                rowsPerPageOptions={[10, 25, 50]}
                                labelRowsPerPage="Por página"
                                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                                sx={{ borderTop: 1, borderColor: 'divider' }}
                            />
                        )}
                    </>
                )}
            </SectionCard>

            <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
                {itemsActuales.flatMap((it) => [
                    it.separar ? <Divider key={`${it.texto}-sep`} /> : null,
                    <MenuItem
                        key={it.texto}
                        sx={{ minHeight: 44, color: it.peligro ? 'error.main' : undefined }}
                        onClick={() => {
                            setMenu(null);
                            it.onClick();
                        }}
                    >
                        <ListItemIcon sx={{ color: 'inherit' }}><it.icono size={18} strokeWidth={1.75} aria-hidden /></ListItemIcon>
                        <ListItemText>{it.texto}</ListItemText>
                    </MenuItem>,
                ])}
            </Menu>

            <SubirDialogo
                open={modalNueva}
                onClose={() => setModalNueva(false)}
                onUploadSuccess={() => {
                    setModalNueva(false);
                    feedback.exito('Campaña creada. Quedó en Borradores, lista para enviar.');
                    irAPestania('borradores');
                    cargar({ silent: true });
                }}
            />

            {envio && (
                <EnviarDialogo
                    open
                    campaña={envio.c}
                    mostrarCalendario={envio.agendar}
                    onClose={() => setEnvio(null)}
                    onSendSuccess={() => {
                        const agendado = envio.agendar;
                        setEnvio(null);
                        feedback.exito(agendado ? 'Campaña agendada.' : 'Envío iniciado en segundo plano.');
                        irAPestania(agendado ? 'agendadas' : 'en-curso');
                        cargar({ silent: true });
                    }}
                />
            )}

            <ConfirmDialog
                open={!!confirmar}
                titulo={confirmacion?.titulo}
                mensaje={confirmacion?.mensaje}
                confirmarTexto={confirmacion?.confirmarTexto}
                peligro={confirmacion?.peligro}
                cargando={trabajando}
                onConfirmar={ejecutarConfirmacion}
                onCancelar={() => setConfirmar(null)}
            >
                {confirmar?.tipo === 'cierre' && (
                    <RadioGroup value={estadoFinal} onChange={(e) => setEstadoFinal(e.target.value)} aria-label="Cómo queda la campaña">
                        <FormControlLabel value="finalizada" control={<Radio />} label="Dejarla como terminada" />
                        <FormControlLabel value="error" control={<Radio />} label="Dejarla con error" />
                    </RadioGroup>
                )}
            </ConfirmDialog>

            <DialogoContactos
                open={!!contactosDe}
                onClose={() => setContactosDe(null)}
                campania={contactosDe?.nombre ?? ''}
                contactos={contactos.lista}
                campo={campoContacto}
                etiqueta={etiquetaContacto}
                cargando={contactos.cargando}
                error={contactos.error}
                onReintentar={() => contactosDe && abrirContactos(contactosDe)}
            />

            <CampañaLogModal
                open={!!log}
                onClose={() => setLog(null)}
                campañaId={log?.id}
                campañaNombre={log?.nombre}
                tipo={tipoLog}
                estadoCampaña={campanias.find((c) => c.id === log?.id)?.estado}
                progreso={progresos[log?.id] ?? null}
                onPausar={puedePausar ? () => {
                    const c = campanias.find((x) => x.id === log?.id);
                    if (c) pedir('pausar', c);
                } : undefined}
                onForzarCierre={() => {
                    const c = campanias.find((x) => x.id === log?.id);
                    if (c) pedir('cierre', c);
                }}
            />
        </PageContainer>
    );
}
