import { useState } from 'react';
import { Avatar, Box, Button, Link, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AlertCircle, MailOpen, MousePointerClick } from 'lucide-react';
import { StatusChip } from '../ui';
import { CANALES } from './comunes';

const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
};

// El backend manda los estados tal como los guarda cada canal ('open', 'delivered', 'read'…). Acá se traducen y se les
// da su tono; lo que no se conoce se muestra con la primera en mayúscula, nunca crudo en minúsculas.
const ESTADOS = {
    enviado: ['Enviado', 'ok'],
    sent: ['Enviado', 'ok'],
    success: ['Enviado', 'ok'],
    entregado: ['Entregado', 'ok'],
    delivered: ['Entregado', 'ok'],
    read: ['Leído', 'ok'],
    leido: ['Leído', 'ok'],
    pendiente: ['Pendiente', 'aviso'],
    pending: ['Pendiente', 'aviso'],
    fallido: ['Fallido', 'error'],
    failed: ['Fallido', 'error'],
    error: ['Con error', 'error'],
    rebotado: ['Rebotó', 'error'],
    bounced: ['Rebotó', 'error'],
    queja: ['Queja', 'error'],
};

const TIPOS = { envio: 'Envío', open: 'Apertura', click: 'Click', evento: 'Evento' };

const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : '');

function estadoDe(entry) {
    const crudo = entry.detalle?.estado;
    // Los eventos (apertura, click) ya dicen qué pasaron en el título: un chip "Evento" sobra.
    if (!crudo || crudo.toLowerCase() === 'evento') return null;
    const conocido = ESTADOS[crudo.toLowerCase()];
    return conocido ? { label: conocido[0], tono: conocido[1] } : { label: capitalize(crudo), tono: 'neutro' };
}

function iconoDe(entry) {
    if (entry.canal === 'email' && entry.tipo === 'open') return MailOpen;
    if (entry.canal === 'email' && entry.tipo === 'click') return MousePointerClick;
    return CANALES[entry.canal]?.Icono ?? AlertCircle;
}

const LARGO_CORTO = 140;

/** Un texto largo se recorta a tres renglones y se expande con "Ver más" (antes se cortaba a 80 caracteres para siempre). */
function TextoExpandible({ etiqueta, texto, error = false }) {
    const [abierto, setAbierto] = useState(false);
    const largo = texto.length > LARGO_CORTO || texto.split('\n').length > 3;
    return (
        <Box sx={{ mb: 0.75 }}>
            <Typography
                variant="body2"
                component="div"
                sx={{
                    color: error ? 'error.main' : 'text.primary',
                    overflowWrap: 'anywhere',
                    whiteSpace: 'pre-wrap',
                    ...(!abierto && largo ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : null),
                }}
            >
                <Box component="span" sx={{ fontWeight: 600 }}>{etiqueta}: </Box>
                {texto}
            </Typography>
            {largo && (
                <Button size="small" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} sx={{ minHeight: { xs: 44, md: 28 }, px: 0.5, ml: -0.5 }}>
                    {abierto ? 'Ver menos' : 'Ver más'}
                </Button>
            )}
        </Box>
    );
}

export default function TimelineEntry({ entry }) {
    if (!entry) return null;

    const canal = CANALES[entry.canal];
    const Icono = iconoDe(entry);
    const estado = estadoDe(entry);
    const tipo = TIPOS[String(entry.tipo).toLowerCase()] ?? capitalize(entry.tipo);
    const d = entry.detalle ?? {};

    return (
        <Paper variant="outlined" sx={{ borderRadius: '14px', p: { xs: 1.5, sm: 2 }, display: 'flex', gap: { xs: 1.25, sm: 2 }, alignItems: 'flex-start', minWidth: 0 }}>
            <Avatar
                sx={{
                    width: { xs: 32, sm: 44 },
                    height: { xs: 32, sm: 44 },
                    bgcolor: (t) => alpha(t.palette.text.secondary, 0.12),
                    color: canal?.color ?? 'text.secondary',
                    flex: 'none',
                }}
            >
                <Icono size={20} strokeWidth={1.75} aria-hidden />
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 15, overflowWrap: 'anywhere' }}>
                        {canal?.label ?? entry.canal} · {tipo}
                    </Typography>
                    {estado && <StatusChip label={estado.label} tono={estado.tono} />}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {formatDate(entry.fecha)}
                </Typography>

                {d.asunto && <TextoExpandible etiqueta="Asunto" texto={d.asunto} />}
                {d.mensaje && <TextoExpandible etiqueta="Mensaje" texto={d.mensaje} />}
                {d.templateNombre && (
                    <Typography variant="body2" sx={{ mb: 0.75, overflowWrap: 'anywhere' }}>
                        <Box component="span" sx={{ fontWeight: 600 }}>Plantilla: </Box>{d.templateNombre}
                    </Typography>
                )}
                {d.urlDestino && (
                    <Typography variant="body2" sx={{ mb: 0.75, overflowWrap: 'anywhere' }}>
                        <Box component="span" sx={{ fontWeight: 600 }}>Enlace: </Box>
                        <Link href={d.urlDestino} target="_blank" rel="noopener noreferrer">{d.urlDestino}</Link>
                    </Typography>
                )}
                {d.error && <TextoExpandible etiqueta="Error" texto={d.error} error />}

                {entry.campaniaNombre && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}>
                        Campaña: {entry.campaniaNombre}
                    </Typography>
                )}
            </Box>
        </Paper>
    );
}
