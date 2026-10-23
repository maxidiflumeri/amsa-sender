import { useRef, useState } from 'react';
import { Box, Collapse, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Lock } from 'lucide-react';
import { BloqueEstado } from '../../ui';
import EncabezadoChat from './EncabezadoChat';
import MensajesChat from './MensajesChat';
import { fichaDe, formatFechaHora } from './utils';

const SIN_CIERRES = [];

// La columna del chat: encabezado, panel de notas de cierre, mensajes y (como `children`) el compositor.

function PanelCierres({ cierres, abierto, onIr }) {
    return (
        <Collapse in={abierto} unmountOnExit>
            <Box sx={(theme) => ({ borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.warning.main, 0.07), maxHeight: 220, overflowY: 'auto' })}>
                {cierres.slice().reverse().map((cierre) => (
                    <Box
                        key={cierre.id}
                        component="button"
                        type="button"
                        onClick={() => onIr(cierre.id)}
                        sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%', minHeight: 44, px: 2, py: 1.25, border: 0, borderBottom: 1, borderColor: 'divider', bgcolor: 'transparent', textAlign: 'left', font: 'inherit', color: 'text.primary', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, '&:last-of-type': { borderBottom: 0 } }}
                    >
                        <Box sx={{ color: 'warning.dark', mt: 0.35, flex: 'none', display: 'inline-flex' }}><Lock size={15} strokeWidth={1.75} aria-hidden /></Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'warning.dark' }}>{cierre.usuario?.nombre ?? 'Sistema'}</Typography>
                                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{formatFechaHora(cierre.creadoAt)}</Typography>
                            </Box>
                            <Typography sx={{ fontSize: 13, color: cierre.nota ? 'text.primary' : 'text.secondary', fontStyle: cierre.nota ? 'normal' : 'italic', mt: 0.25, overflowWrap: 'anywhere' }}>
                                {cierre.nota ?? 'Sin nota'}
                            </Typography>
                        </Box>
                    </Box>
                ))}
            </Box>
        </Collapse>
    );
}

export default function Chat({
    conv, mensajes, estados, fallidos, escribiendo, cargando, errorCarga, onReintentarCarga, media, cantidadLineas, esAdmin, esLg, ocupado, resumiendo,
    onVolver, onTomar, onResolver, onAsignar, onResumir, onMarcarNoLeida, onCopiarNumero, onCopiarId, onVerFicha,
    onReintentarEnvio, onEditarFallido, onDescartarFallido, enviando, children,
}) {
    const [cierresAbiertos, setCierresAbiertos] = useState(false);
    const [resaltadoId, setResaltadoId] = useState(null);
    const refsCierre = useRef({});

    const irACierre = (id) => {
        const el = refsCierre.current[id];
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setResaltadoId(id);
        setTimeout(() => setResaltadoId(null), 1200);
    };

    return (
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <EncabezadoChat
                conv={conv}
                campañaNombre={fichaDe(mensajes)?.campañaNombre ?? conv.campañaNombre ?? null}
                cantidadLineas={cantidadLineas}
                esAdmin={esAdmin}
                esLg={esLg}
                ocupado={ocupado}
                resumiendo={resumiendo}
                cierresAbiertos={cierresAbiertos}
                onToggleCierres={() => setCierresAbiertos((v) => !v)}
                onVolver={onVolver}
                onTomar={onTomar}
                onResolver={onResolver}
                onAsignar={onAsignar}
                onResumir={onResumir}
                onMarcarNoLeida={onMarcarNoLeida}
                onCopiarNumero={onCopiarNumero}
                onCopiarId={onCopiarId}
                onVerFicha={onVerFicha}
            />
            <PanelCierres cierres={conv.cierres ?? []} abierto={cierresAbiertos} onIr={irACierre} />

            {cargando ? (
                <Box sx={{ flex: 1, bgcolor: 'whatsapp.fondo' }}><BloqueEstado estado="cargando" mensaje="Cargando mensajes…" /></Box>
            ) : errorCarga ? (
                <Box sx={{ flex: 1, bgcolor: 'whatsapp.fondo', p: 2 }}><BloqueEstado estado="error" mensaje="No se pudieron cargar los mensajes." onReintentar={onReintentarCarga} /></Box>
            ) : (
                <MensajesChat
                    convId={conv.id}
                    mensajes={mensajes}
                    cierres={conv.cierres ?? SIN_CIERRES}
                    estados={estados}
                    fallidos={fallidos}
                    escribiendo={escribiendo}
                    resaltadoId={resaltadoId}
                    registrarCierre={(id, el) => { refsCierre.current[id] = el; }}
                    media={media}
                    onReintentar={onReintentarEnvio}
                    onEditar={onEditarFallido}
                    onDescartar={onDescartarFallido}
                    deshabilitado={enviando}
                />
            )}
            {children}
        </Box>
    );
}
