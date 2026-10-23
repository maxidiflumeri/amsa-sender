import { Box, IconButton, Typography } from '@mui/material';
import { Copy, Hash, Megaphone, Smartphone, User } from 'lucide-react';
import { AvatarUsuario, StatusChip } from '../../ui';
import { ETIQUETA_ESTADO, TONO_ESTADO, copiarAlPortapapeles, fichaDe, formatFechaHora } from './utils';

// La ficha del contacto: quién es, de qué campaña viene y los datos que dejó el sistema al abrir la conversación.
// Es una columna fija desde `lg` y un Drawer entre `md` y `lg` (y desde "Más" en el celular).

function Dato({ rotulo, children }) {
    return (
        <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'text.secondary', mb: 0.25 }}>{rotulo}</Typography>
            <Box sx={{ fontSize: 14, overflowWrap: 'anywhere' }}>{children}</Box>
        </Box>
    );
}

export default function FichaContacto({ conv, mensajes, feedback }) {
    const ficha = fichaDe(mensajes);
    const datos = Object.entries(ficha?.datos ?? {});
    const nombre = conv.nombre ?? conv.numero;
    const campaña = ficha?.campañaNombre ?? conv.campañaNombre ?? null;

    const copiar = async (texto, que) => {
        if (await copiarAlPortapapeles(texto)) feedback.exito(`${que} copiado.`);
        else feedback.error('No se pudo copiar. Copialo a mano.');
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, textAlign: 'center' }}>
                <AvatarUsuario nombre={nombre} size={64} />
                <Typography sx={{ fontSize: 17, fontWeight: 700, overflowWrap: 'anywhere' }}>{nombre}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: 14, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{conv.numero}</Typography>
                    <IconButton aria-label="Copiar número" onClick={() => copiar(conv.numero, 'Número')} sx={{ width: 44, height: 44, my: -0.75 }}>
                        <Copy size={16} strokeWidth={1.75} aria-hidden />
                    </IconButton>
                </Box>
                <StatusChip label={ETIQUETA_ESTADO[conv.estado] ?? conv.estado} tono={TONO_ESTADO[conv.estado] ?? 'neutro'} />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, borderTop: 1, borderColor: 'divider', pt: 2 }}>
                <Dato rotulo="Conversación">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Hash size={14} strokeWidth={1.75} aria-hidden />{conv.id}
                        <IconButton aria-label="Copiar el identificador" onClick={() => copiar(String(conv.id), 'Identificador')} sx={{ width: 44, height: 44, my: -1 }}>
                            <Copy size={14} strokeWidth={1.75} aria-hidden />
                        </IconButton>
                    </Box>
                </Dato>
                {conv.asignadoA && (
                    <Dato rotulo="Atiende"><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><User size={14} strokeWidth={1.75} aria-hidden />{conv.asignadoA.nombre}</Box></Dato>
                )}
                {conv.config && (
                    <Dato rotulo="Línea"><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Smartphone size={14} strokeWidth={1.75} aria-hidden />{conv.config.nombre ?? `Línea ${conv.config.id}`}</Box></Dato>
                )}
                {campaña && (
                    <Dato rotulo="Campaña de origen"><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Megaphone size={14} strokeWidth={1.75} aria-hidden />{campaña}</Box></Dato>
                )}
                {conv.ultimoMensajeAt && <Dato rotulo="Último mensaje">{formatFechaHora(conv.ultimoMensajeAt)}</Dato>}
            </Box>

            {datos.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, borderTop: 1, borderColor: 'divider', pt: 2 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Datos de la campaña</Typography>
                    {datos.map(([k, v]) => <Dato key={k} rotulo={k}>{String(v)}</Dato>)}
                </Box>
            )}
        </Box>
    );
}
