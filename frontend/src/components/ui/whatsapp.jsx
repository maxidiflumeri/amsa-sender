import { Fragment } from 'react';
import { Box } from '@mui/material';
import { Check, CheckCheck, Clock, CircleAlert } from 'lucide-react';

// La burbuja de WhatsApp, una sola para toda la app (antes había tres verdes distintos en el inbox, las plantillas y
// las respuestas rápidas) y el formato de WhatsApp (*negrita*, _cursiva_, ~tachado~, ```mono```) sin innerHTML.

const PATRON = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

function formatearLinea(linea, clave) {
    const partes = linea.split(PATRON);
    return partes.map((p, i) => {
        const k = `${clave}-${i}`;
        if (!p) return null;
        if (p.startsWith('```') && p.endsWith('```') && p.length > 6) {
            return <Box component="code" key={k} sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.92em' }}>{p.slice(3, -3)}</Box>;
        }
        if (p.length > 2 && p.startsWith('*') && p.endsWith('*')) return <strong key={k}>{p.slice(1, -1)}</strong>;
        if (p.length > 2 && p.startsWith('_') && p.endsWith('_')) return <em key={k}>{p.slice(1, -1)}</em>;
        if (p.length > 2 && p.startsWith('~') && p.endsWith('~')) return <s key={k}>{p.slice(1, -1)}</s>;
        return <Fragment key={k}>{p}</Fragment>;
    });
}

/** El texto con el formato de WhatsApp, como nodos de React (seguro: no usa HTML). */
export function formatoWhatsApp(texto) {
    if (!texto) return null;
    const lineas = String(texto).split('\n');
    return lineas.map((linea, i) => (
        <Fragment key={i}>
            {formatearLinea(linea, i)}
            {i < lineas.length - 1 && <br />}
        </Fragment>
    ));
}

const ICONO_ESTADO = {
    pendiente: { Icono: Clock, etiqueta: 'Enviando' },
    enviado: { Icono: Check, etiqueta: 'Enviado' },
    entregado: { Icono: CheckCheck, etiqueta: 'Entregado' },
    leido: { Icono: CheckCheck, etiqueta: 'Leído' },
    fallido: { Icono: CircleAlert, etiqueta: 'No se envió' },
};

/**
 * Una burbuja de WhatsApp.
 * @param {object} props
 * @param {'entrante'|'saliente'} props.direccion
 * @param {React.ReactNode} props.children El contenido (texto con `formatoWhatsApp`, imagen, etc.).
 * @param {string} [props.hora]
 * @param {'pendiente'|'enviado'|'entregado'|'leido'|'fallido'} [props.estado] Solo en las salientes.
 * @param {string} [props.plantilla] El nombre de la plantilla, como rótulo arriba.
 * @param {string[]} [props.botones] Las respuestas rápidas de una plantilla, abajo.
 * @param {React.ReactNode} [props.encabezado] Algo arriba del texto (por ejemplo, "Respondió al botón").
 */
export function WaBurbuja({ direccion, children, hora, estado, plantilla, botones, encabezado, sx }) {
    const saliente = direccion === 'saliente';
    const est = estado ? ICONO_ESTADO[estado] : null;
    return (
        <Box
            sx={(theme) => ({
                alignSelf: saliente ? 'flex-end' : 'flex-start',
                maxWidth: { xs: '86%', sm: 'min(560px, 75%)' },
                minWidth: 0,
                bgcolor: saliente ? theme.palette.whatsapp.saliente : theme.palette.whatsapp.entrante,
                color: 'text.primary',
                borderRadius: '14px',
                [saliente ? 'borderTopRightRadius' : 'borderTopLeftRadius']: '4px',
                px: 1.5,
                pt: 1,
                pb: botones?.length ? 0 : 0.75,
                boxShadow: theme.palette.mode === 'light' ? '0 1px 1px rgba(15,23,42,.06)' : 'none',
                outline: estado === 'fallido' ? `1px solid ${theme.palette.error.main}` : 'none',
                fontSize: { xs: 15, sm: 14 },
                lineHeight: 1.5,
                overflowWrap: 'anywhere',
                ...(typeof sx === 'function' ? sx(theme) : sx),
            })}
        >
            {plantilla && (
                <Box sx={{ fontSize: 11.5, fontWeight: 600, color: 'text.secondary', mb: 0.25 }}>Plantilla · {plantilla}</Box>
            )}
            {encabezado}
            <Box>{children}</Box>
            {(hora || est) && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.25, fontSize: 11.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                    {hora}
                    {est && saliente && (
                        <Box
                            component="span"
                            role="img"
                            aria-label={est.etiqueta}
                            sx={(theme) => ({ display: 'inline-flex', color: estado === 'leido' ? theme.palette.whatsapp.leido : estado === 'fallido' ? 'error.main' : 'text.secondary' })}
                        >
                            <est.Icono size={15} strokeWidth={2} aria-hidden />
                        </Box>
                    )}
                </Box>
            )}
            {botones?.length > 0 && (
                <Box sx={{ mx: -1.5, mt: 0.5 }}>
                    {botones.map((b) => (
                        <Box key={b} sx={{ borderTop: 1, borderColor: 'divider', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: 'info.main', px: 1.5, textAlign: 'center' }}>
                            {b}
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
}
