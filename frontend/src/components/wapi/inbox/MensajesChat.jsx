import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Dialog, IconButton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Building2, Download, FileText, Info, Lock, Phone, RotateCw, X } from 'lucide-react';
import { AvatarUsuario, WaBurbuja, formatoWhatsApp } from '../../ui';
import { estadoBurbuja, formatHora, formatSeparador } from './utils';

// Los mensajes del chat. Todas las burbujas son `WaBurbuja`; acá se arma el contenido de cada tipo, los separadores
// de día, los marcadores de cierre, la ficha del sistema y las burbujas que no se pudieron enviar.

function Cargando({ ancho = 200, alto = 110 }) {
    return (
        <Box sx={{ width: ancho, maxWidth: '100%', height: alto, bgcolor: 'action.hover', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={20} />
        </Box>
    );
}

function ErrorMedia({ onReintentar, etiqueta }) {
    return (
        <Button size="small" variant="outlined" color="inherit" startIcon={<RotateCw size={15} aria-hidden />} onClick={onReintentar} sx={{ minHeight: 44, textTransform: 'none' }}>
            {etiqueta}
        </Button>
    );
}

function Adjunto({ icono, nombre, media, mediaId, nombreDescarga }) {
    const Icono = icono;
    const { url, estado } = media.obtener(mediaId);
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box sx={{ color: 'text.secondary', display: 'inline-flex', flex: 'none' }}><Icono size={20} strokeWidth={1.75} aria-hidden /></Box>
            <Typography sx={{ fontSize: 14, minWidth: 0, overflowWrap: 'anywhere' }}>{nombre}</Typography>
            {estado === 'listo' && (
                <Button size="small" variant="outlined" href={url} download={nombreDescarga} startIcon={<Download size={15} aria-hidden />} sx={{ minHeight: 44, flex: 'none', textTransform: 'none' }}>
                    Descargar
                </Button>
            )}
            {estado === 'cargando' && <CircularProgress size={16} />}
            {estado === 'error' && <ErrorMedia etiqueta="Reintentar" onReintentar={() => media.reintentar(mediaId)} />}
        </Box>
    );
}

/** El contenido de un mensaje según su tipo, para meter adentro de la burbuja. */
function ContenidoMensaje({ msg, media, onImagen, alCargarMedia }) {
    const c = msg.contenido ?? {};
    switch (msg.tipo) {
        case 'text':
            return <>{formatoWhatsApp(c.text ?? '')}</>;
        case 'button':
            return (
                <>
                    {formatoWhatsApp(c.buttonText ?? '')}
                    {c.buttonPayload && c.buttonPayload !== c.buttonText && (
                        <Typography component="div" sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>{c.buttonPayload}</Typography>
                    )}
                </>
            );
        case 'image': {
            const { url, estado } = media.obtener(c.mediaUrl);
            return (
                <Box>
                    {estado === 'listo' ? (
                        <Box
                            component="img"
                            src={url}
                            alt="Imagen recibida"
                            onLoad={alCargarMedia}
                            onClick={() => onImagen(url)}
                            sx={{ display: 'block', maxWidth: '100%', maxHeight: 300, borderRadius: '8px', cursor: 'zoom-in', objectFit: 'contain' }}
                        />
                    ) : estado === 'error' ? (
                        <ErrorMedia etiqueta="No se pudo cargar la imagen. Reintentar" onReintentar={() => media.reintentar(c.mediaUrl)} />
                    ) : (
                        <Cargando />
                    )}
                    {c.caption && <Box sx={{ mt: 0.5 }}>{formatoWhatsApp(c.caption)}</Box>}
                </Box>
            );
        }
        case 'audio': {
            const { url, estado } = media.obtener(c.mediaUrl);
            if (estado === 'listo') return <Box component="audio" controls src={url} sx={{ display: 'block', width: 260, maxWidth: '100%' }} />;
            if (estado === 'error') return <ErrorMedia etiqueta="No se pudo cargar el audio. Reintentar" onReintentar={() => media.reintentar(c.mediaUrl)} />;
            return <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CircularProgress size={16} /><Typography sx={{ fontSize: 13 }}>Cargando audio…</Typography></Box>;
        }
        case 'document':
            return <Adjunto icono={FileText} nombre={c.filename || c.caption || 'Documento'} media={media} mediaId={c.mediaUrl} nombreDescarga={c.filename || c.caption || 'documento'} />;
        case 'video':
            return <Adjunto icono={FileText} nombre={c.caption || 'Video'} media={media} mediaId={c.mediaUrl} nombreDescarga={c.caption || 'video'} />;
        case 'sticker': {
            const { url, estado } = media.obtener(c.mediaUrl ?? c.raw?.sticker?.id);
            if (estado === 'listo') return <Box component="img" src={url} alt="Sticker" onLoad={alCargarMedia} sx={{ display: 'block', width: 140, maxWidth: '100%', height: 140, objectFit: 'contain' }} />;
            return <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Sticker</Typography>;
        }
        case 'contacts': {
            const lista = c.contacts ?? (c.raw?.contacts ?? []).map((ct) => ({
                nombre: ct.name?.formatted_name ?? ct.name?.first_name ?? 'Contacto',
                telefonos: (ct.phones ?? []).map((p) => p.phone),
                emails: (ct.emails ?? []).map((e) => e.email),
                empresa: ct.org?.company ?? null,
            }));
            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {lista.map((ct, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, border: 1, borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
                            <AvatarUsuario nombre={ct.nombre} size={36} />
                            <Box sx={{ minWidth: 0 }}>
                                <Typography noWrap sx={{ fontSize: 14, fontWeight: 700 }}>{ct.nombre}</Typography>
                                {ct.telefonos?.[0] && (
                                    <Typography component="div" noWrap sx={{ fontSize: 12.5, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Phone size={13} strokeWidth={1.75} aria-hidden />{ct.telefonos[0]}
                                    </Typography>
                                )}
                                {ct.empresa && (
                                    <Typography component="div" noWrap sx={{ fontSize: 12.5, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Building2 size={13} strokeWidth={1.75} aria-hidden />{ct.empresa}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    ))}
                </Box>
            );
        }
        default:
            return <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Mensaje de un tipo que Sender todavía no muestra ({msg.tipo}).</Typography>;
    }
}

/** El marcador de cierre en la línea de tiempo (antes estaba copiado dos veces). */
function MarcadorCierre({ cierre, resaltado, registrar }) {
    const nota = cierre.nota ? ` · "${cierre.nota.length > 40 ? `${cierre.nota.slice(0, 40)}…` : cierre.nota}"` : '';
    return (
        <Box
            ref={(el) => registrar(cierre.id, el)}
            sx={(theme) => ({ display: 'flex', alignItems: 'center', gap: 1.5, my: 1.5, px: 1, borderRadius: '10px', transition: 'background-color .4s', bgcolor: resaltado ? alpha(theme.palette.warning.main, 0.18) : 'transparent' })}
        >
            <Box sx={(theme) => ({ flex: 1, height: '1px', bgcolor: alpha(theme.palette.warning.main, 0.35) })} />
            <Box sx={(theme) => ({ display: 'flex', alignItems: 'center', gap: 0.75, bgcolor: alpha(theme.palette.warning.main, 0.12), border: 1, borderColor: alpha(theme.palette.warning.main, 0.35), borderRadius: '10px', px: 1.25, py: 0.5, color: 'warning.dark', minWidth: 0 })}>
                <Lock size={13} strokeWidth={2} aria-hidden />
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'inherit', overflowWrap: 'anywhere' }}>
                    Cerrado por {cierre.usuario?.nombre ?? 'Sistema'}{nota}
                </Typography>
            </Box>
            <Box sx={(theme) => ({ flex: 1, height: '1px', bgcolor: alpha(theme.palette.warning.main, 0.35) })} />
        </Box>
    );
}

function FichaSistema({ msg }) {
    const c = msg.contenido ?? {};
    const datos = Object.entries(c.datos ?? {});
    return (
        <Box sx={(theme) => ({ alignSelf: 'center', width: '100%', maxWidth: 560, my: 0.5, px: 2, py: 1.25, borderRadius: '12px', border: 1, borderColor: 'warning.main', bgcolor: alpha(theme.palette.warning.main, 0.08) })}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, color: 'warning.dark' }}>
                <Info size={15} strokeWidth={2} aria-hidden />
                <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'inherit' }}>Ficha de contacto · generada por el sistema</Typography>
            </Box>
            {c.nombre && <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>{c.nombre}</Typography>}
            {datos.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                    {datos.map(([k, v]) => (
                        <Typography key={k} sx={{ fontSize: 14, color: 'text.secondary', overflowWrap: 'anywhere' }}>
                            <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{k}:</Box> {String(v)}
                        </Typography>
                    ))}
                </Box>
            )}
            {c.campañaNombre && <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>Campaña: {c.campañaNombre}</Typography>}
        </Box>
    );
}

function Separador({ ts }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 1.5 }}>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
            <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500, whiteSpace: 'nowrap', userSelect: 'none' }}>{formatSeparador(ts)}</Typography>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
        </Box>
    );
}

/** Un mensaje que no salió: se queda en el chat con el texto y el adjunto para reintentar, editar o descartar. */
function BurbujaFallida({ fallido, onReintentar, onEditar, onDescartar, deshabilitado }) {
    return (
        <Box sx={{ alignSelf: 'flex-end', maxWidth: { xs: '86%', sm: 'min(560px, 75%)' }, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <Box
                component="button"
                type="button"
                onClick={() => !deshabilitado && onReintentar(fallido)}
                aria-label="No se envió. Tocá para reintentar"
                sx={{ border: 0, p: 0, bgcolor: 'transparent', font: 'inherit', textAlign: 'left', cursor: deshabilitado ? 'default' : 'pointer', display: 'flex', maxWidth: '100%' }}
            >
                <WaBurbuja direccion="saliente" estado="fallido" hora={formatHora(fallido.creadoAt)} sx={{ maxWidth: '100%' }}>
                    {fallido.file && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: fallido.texto ? 0.5 : 0, color: 'text.secondary' }}>
                            <FileText size={16} strokeWidth={1.75} aria-hidden />
                            <Typography component="span" sx={{ fontSize: 13, overflowWrap: 'anywhere' }}>{fallido.file.name}</Typography>
                        </Box>
                    )}
                    {fallido.texto && formatoWhatsApp(fallido.texto)}
                </WaBurbuja>
            </Box>
            <Typography sx={{ fontSize: 12.5, color: 'error.main', fontWeight: 600, textAlign: 'right' }}>No se envió. Tocá para reintentar</Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button size="small" onClick={() => onEditar(fallido)} disabled={deshabilitado} sx={{ minHeight: 44, textTransform: 'none' }}>Editar</Button>
                <Button size="small" color="inherit" onClick={() => onDescartar(fallido)} disabled={deshabilitado} sx={{ minHeight: 44, textTransform: 'none' }}>Descartar</Button>
            </Box>
        </Box>
    );
}

function Visor({ url, onClose }) {
    return (
        <Dialog open={!!url} onClose={onClose} fullScreen sx={{ '& .MuiDialog-paper': { bgcolor: 'rgba(0,0,0,0.92)' } }}>
            <IconButton aria-label="Cerrar" onClick={onClose} sx={{ position: 'absolute', top: 'calc(8px + env(safe-area-inset-top))', right: 8, width: 44, height: 44, color: 'common.white', bgcolor: 'rgba(255,255,255,0.12)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
                <X size={22} strokeWidth={1.75} aria-hidden />
            </IconButton>
            <Box onClick={onClose} sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, minHeight: 0 }}>
                {url && <Box component="img" src={url} alt="Imagen ampliada" sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
            </Box>
        </Dialog>
    );
}

/**
 * @param {object} props
 * @param {object[]} props.mensajes
 * @param {object[]} props.cierres
 * @param {Record<string,string>} props.estados Estados de entrega que llegaron por el socket.
 * @param {object[]} props.fallidos Los mensajes de esta conversación que no se pudieron enviar.
 * @param {boolean} props.escribiendo
 * @param {number|string|null} props.resaltadoId Un cierre al que se acaba de saltar.
 * @param {(id: number, el: HTMLElement|null) => void} props.registrarCierre
 * @param {object} props.media Lo que devuelve `useMediaBlobs`.
 */
export default function MensajesChat({
    convId, mensajes, cierres, estados, fallidos, escribiendo, resaltadoId, registrarCierre, media, onReintentar, onEditar, onDescartar, deshabilitado,
}) {
    const [imagen, setImagen] = useState(null);
    const contenedor = useRef(null);
    const pegadoAbajo = useRef(true);
    const ultimaConv = useRef(null);

    const bajar = (suave) => {
        const el = contenedor.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
    };

    // Abrir una conversación baja de golpe al final; un mensaje nuevo baja solo si ya se estaba leyendo lo último (o
    // si es de uno mismo), para no arrancar al asesor de un mensaje viejo que está releyendo.
    useLayoutEffect(() => {
        if (ultimaConv.current !== convId) {
            ultimaConv.current = convId;
            pegadoAbajo.current = true;
            bajar(false);
            return;
        }
        const ultimo = mensajes[mensajes.length - 1];
        if (pegadoAbajo.current || ultimo?.fromMe) bajar(true);
    }, [convId, mensajes, fallidos.length, escribiendo]);

    // Las imágenes cargan después del primer dibujo y empujan todo hacia abajo.
    const alCargarMedia = () => {
        if (pegadoAbajo.current) bajar(false);
    };

    useEffect(() => () => setImagen(null), [convId]);

    const reacciones = useMemo(() => {
        const mapa = {};
        for (const m of mensajes) {
            if (m.tipo !== 'reaction') continue;
            const objetivo = m.contenido?.messageId ?? m.contenido?.raw?.reaction?.message_id;
            const emoji = m.contenido?.emoji ?? m.contenido?.raw?.reaction?.emoji;
            if (objetivo && emoji) mapa[objetivo] = emoji;
        }
        return mapa;
    }, [mensajes]);

    // Mensajes y cierres en una sola línea de tiempo, y un separador cada vez que cambia el día.
    const linea = useMemo(() => {
        const eventos = [
            ...mensajes.filter((m) => m.tipo !== 'reaction').map((m) => ({ ts: new Date(m.timestamp).getTime(), msg: m })),
            ...cierres.map((c) => ({ ts: new Date(c.creadoAt).getTime(), cierre: c })),
        ];
        // Con la misma hora, el cierre va antes: así lo ordenaba la versión anterior.
        eventos.sort((a, b) => a.ts - b.ts || (a.cierre ? -1 : 0) - (b.cierre ? -1 : 0));
        return eventos;
    }, [mensajes, cierres]);

    const items = [];
    let ultimoDia = null;
    for (const ev of linea) {
        if (ev.cierre) {
            items.push(<MarcadorCierre key={`cierre-${ev.cierre.id}`} cierre={ev.cierre} resaltado={resaltadoId === ev.cierre.id} registrar={registrarCierre} />);
            continue;
        }
        const msg = ev.msg;
        const dia = msg.timestamp ? new Date(msg.timestamp).toDateString() : null;
        if (dia && dia !== ultimoDia) {
            items.push(<Separador key={`dia-${dia}`} ts={msg.timestamp} />);
            ultimoDia = dia;
        }
        if (msg.tipo === 'sistema') {
            items.push(<FichaSistema key={msg.id} msg={msg} />);
            continue;
        }
        const reaccion = reacciones[msg.waMessageId];
        const burbuja = (
            <WaBurbuja
                direccion={msg.fromMe ? 'saliente' : 'entrante'}
                hora={formatHora(msg.timestamp)}
                estado={msg.fromMe ? estadoBurbuja(msg, estados) : undefined}
                sx={reaccion ? { maxWidth: 'none' } : undefined}
            >
                <ContenidoMensaje msg={msg} media={media} onImagen={setImagen} alCargarMedia={alCargarMedia} />
            </WaBurbuja>
        );
        items.push(reaccion ? (
            <Box key={msg.id} sx={{ alignSelf: msg.fromMe ? 'flex-end' : 'flex-start', position: 'relative', display: 'flex', maxWidth: { xs: '86%', sm: 'min(560px, 75%)' }, minWidth: 0, mb: 2 }}>
                {burbuja}
                <Box aria-label={`Reacción ${reaccion}`} sx={{ position: 'absolute', bottom: -18, [msg.fromMe ? 'right' : 'left']: 8, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: '12px', px: 0.75, fontSize: 14, lineHeight: 1.7 }}>
                    {reaccion}
                </Box>
            </Box>
        ) : <Fragment key={msg.id}>{burbuja}</Fragment>);
    }

    return (
        <Box
            ref={contenedor}
            onScroll={(e) => {
                const el = e.currentTarget;
                pegadoAbajo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
            }}
            sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', px: { xs: 1.5, md: 3 }, py: 2, display: 'flex', flexDirection: 'column', gap: 0.75, bgcolor: 'whatsapp.fondo' }}
        >
            {items}
            {fallidos.map((f) => (
                <BurbujaFallida key={f.id} fallido={f} onReintentar={onReintentar} onEditar={onEditar} onDescartar={onDescartar} deshabilitado={deshabilitado} />
            ))}
            {escribiendo && (
                <Box sx={{ alignSelf: 'flex-start' }}>
                    <WaBurbuja direccion="entrante"><Box component="span" sx={{ fontStyle: 'italic', color: 'text.secondary', fontSize: 14 }}>escribiendo…</Box></WaBurbuja>
                </Box>
            )}
            <Visor url={imagen} onClose={() => setImagen(null)} />
        </Box>
    );
}
