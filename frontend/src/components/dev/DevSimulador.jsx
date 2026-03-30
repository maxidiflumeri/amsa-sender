import { useState } from 'react';
import {
    Box, Paper, Typography, Button, TextField, Stack, Chip,
    Alert, Snackbar, Divider, Card, CardContent, CardActions,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartButtonIcon from '@mui/icons-material/SmartButton';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ImageIcon from '@mui/icons-material/Image';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ContactsIcon from '@mui/icons-material/Contacts';
import StickerIcon from '@mui/icons-material/EmojiEmotions';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import api from '../../api/axios';

const NUMERO_DEFAULT = '5491155550001';

const ESCENARIOS = [
    {
        id: 'nuevo-cliente',
        label: 'Cliente nuevo escribe',
        color: 'primary',
        descripcion: 'Abre una nueva conversación sin asignar con mensaje de bienvenida automático.',
        payload: { numero: '5491155550001', nombre: 'Maxi Test', texto: 'Hola, quiero consultar por mi cuenta' },
        endpoint: '/dev/simular/mensaje',
    },
    {
        id: 'cliente-responde',
        label: 'Cliente existente responde',
        color: 'info',
        descripcion: 'Mensaje de un número que ya tiene conversación activa.',
        payload: { numero: '5491155550002', nombre: 'Ana García', texto: '¿Me pueden dar el saldo de mi cuenta?' },
        endpoint: '/dev/simular/mensaje',
    },
    {
        id: 'boton-inbox',
        label: 'Presiona "Hablar con asesor"',
        color: 'success',
        descripcion: 'Simula el botón INBOX de un template de campaña. Fuerza mensaje de bienvenida y ficha de contacto.',
        payload: { numero: '5491155550003', nombre: 'Carlos Ruiz', payload: 'INBOX', textoBoton: 'Hablar con asesor' },
        endpoint: '/dev/simular/boton',
    },
    {
        id: 'boton-baja',
        label: 'Presiona "Dar de baja"',
        color: 'warning',
        descripcion: 'Simula el botón de opt-out. Registra el número en la lista de bajas.',
        payload: { numero: '5491155550004', nombre: 'Laura Pérez', payload: 'BAJA', textoBoton: 'No deseo recibir mensajes' },
        endpoint: '/dev/simular/boton',
    },
    {
        id: 'imagen',
        label: 'Cliente envía imagen',
        color: 'secondary',
        descripcion: 'Imagen simulada (el mediaUrl es falso, no se podrá visualizar).',
        payload: { numero: '5491155550001', nombre: 'Maxi Test', texto: 'Foto del comprobante' },
        endpoint: '/dev/simular/imagen',
    },
    {
        id: 'contacto',
        label: 'Cliente comparte contacto',
        color: 'success',
        descripcion: 'Simula el envío de una tarjeta de contacto de WhatsApp.',
        payload: { numero: '5491155550001', nombre: 'Maxi Test', contactoNombre: 'María López', contactoTelefono: '+5491155559999', contactoEmpresa: 'Empresa SA' },
        endpoint: '/dev/simular/contacto',
    },
];

export default function DevSimulador() {
    const [numero, setNumero] = useState(NUMERO_DEFAULT);
    const [nombre, setNombre] = useState('Usuario Test');
    const [texto, setTexto] = useState('Hola, necesito ayuda');
    const [payload, setPayload] = useState('INBOX');
    const [waMessageId, setWaMessageId] = useState('');
    const [docCaption, setDocCaption] = useState('');
    const [docFilename, setDocFilename] = useState('informe.pdf');
    const [contactoNombre, setContactoNombre] = useState('Juan Pérez');
    const [contactoTelefono, setContactoTelefono] = useState('+5491155550099');
    const [contactoEmpresa, setContactoEmpresa] = useState('');
    const [reaccionEmoji, setReaccionEmoji] = useState('👍');
    const [reaccionMsgId, setReaccionMsgId] = useState('');
    const [loading, setLoading] = useState('');
    const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });

    const ok = (msg) => setSnack({ open: true, msg, sev: 'success' });
    const err = (msg) => setSnack({ open: true, msg, sev: 'error' });

    const ejecutar = async (endpoint, body) => {
        setLoading(endpoint);
        try {
            const { data } = await api.post(endpoint, body);
            ok(`✓ ${JSON.stringify(data)}`);
        } catch (e) {
            err(e?.response?.data?.message || 'Error al simular');
        } finally {
            setLoading('');
        }
    };

    return (
        <Box py={3}>
            <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
                <Box mb={3}>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Typography variant="h5" fontWeight={700}>Simulador de Webhook</Typography>
                        <Chip label="solo desarrollo" size="small" color="warning" />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        Simula eventos de WhatsApp directamente en el backend local sin pasar por Meta.
                        Los eventos se procesan igual que si vinieran de un teléfono real.
                    </Typography>
                </Box>

                {/* Escenarios rápidos */}
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Escenarios rápidos</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 4 }}>
                    {ESCENARIOS.map(e => (
                        <Card key={e.id} variant="outlined">
                            <CardContent sx={{ pb: 1 }}>
                                <Typography variant="body2" fontWeight={700} gutterBottom>{e.label}</Typography>
                                <Typography variant="caption" color="text.secondary">{e.descripcion}</Typography>
                                <Box sx={{ mt: 1 }}>
                                    <Chip label={e.payload.numero} size="small" sx={{ fontSize: 10, height: 18 }} />
                                </Box>
                            </CardContent>
                            <CardActions sx={{ pt: 0 }}>
                                <Button
                                    size="small"
                                    variant="contained"
                                    color={e.color}
                                    disabled={!!loading}
                                    onClick={() => ejecutar(e.endpoint, e.payload)}
                                >
                                    {loading === e.endpoint ? 'Enviando...' : 'Ejecutar'}
                                </Button>
                            </CardActions>
                        </Card>
                    ))}
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Formulario libre */}
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Simulación personalizada</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField label="Número (E.164)" size="small" value={numero} onChange={e => setNumero(e.target.value)} sx={{ flex: 1 }} />
                    <TextField label="Nombre contacto" size="small" value={nombre} onChange={e => setNombre(e.target.value)} sx={{ flex: 1 }} />
                </Stack>

                {/* Fila 1: Texto + Botón + Status */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    {/* Mensaje de texto */}
                    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                        <Typography variant="caption" fontWeight={700} display="block" mb={1}>
                            <SendIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Mensaje de texto
                        </Typography>
                        <TextField
                            fullWidth size="small" multiline rows={2}
                            label="Texto" value={texto}
                            onChange={e => setTexto(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        <Button
                            fullWidth variant="outlined" startIcon={<SendIcon />}
                            disabled={!!loading || !texto.trim() || !numero.trim()}
                            onClick={() => ejecutar('/dev/simular/mensaje', { numero, nombre, texto })}
                        >
                            Simular mensaje
                        </Button>
                    </Paper>

                    {/* Botón */}
                    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                        <Typography variant="caption" fontWeight={700} display="block" mb={1}>
                            <SmartButtonIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Presionar botón
                        </Typography>
                        <TextField
                            fullWidth size="small" label="Payload del botón"
                            value={payload} onChange={e => setPayload(e.target.value)}
                            helperText="INBOX, BAJA, o cualquier payload configurado"
                            sx={{ mb: 1 }}
                        />
                        <Button
                            fullWidth variant="outlined" startIcon={<SmartButtonIcon />}
                            disabled={!!loading || !payload.trim() || !numero.trim()}
                            onClick={() => ejecutar('/dev/simular/boton', { numero, nombre, payload })}
                        >
                            Simular botón
                        </Button>
                    </Paper>

                    {/* Status update */}
                    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                        <Typography variant="caption" fontWeight={700} display="block" mb={1}>
                            <DoneAllIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Status update
                        </Typography>
                        <TextField
                            fullWidth size="small" label="waMessageId"
                            value={waMessageId} onChange={e => setWaMessageId(e.target.value)}
                            helperText="ID de un mensaje enviado desde el inbox"
                            sx={{ mb: 1 }}
                        />
                        <Stack direction="row" spacing={1}>
                            <Button
                                fullWidth variant="outlined" size="small" startIcon={<DoneAllIcon />}
                                disabled={!!loading || !waMessageId.trim() || !numero.trim()}
                                onClick={() => ejecutar('/dev/simular/status', { waMessageId, status: 'delivered', numero })}
                            >
                                Entregado
                            </Button>
                            <Button
                                fullWidth variant="outlined" size="small" color="success" startIcon={<DoneAllIcon />}
                                disabled={!!loading || !waMessageId.trim() || !numero.trim()}
                                onClick={() => ejecutar('/dev/simular/status', { waMessageId, status: 'read', numero })}
                            >
                                Leído
                            </Button>
                        </Stack>
                    </Paper>
                </Stack>

                {/* Fila 2: Imagen + Audio + Documento + Contacto */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    {/* Imagen */}
                    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                        <Typography variant="caption" fontWeight={700} display="block" mb={1}>
                            <ImageIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Imagen
                        </Typography>
                        <TextField
                            fullWidth size="small" label="Caption (opcional)"
                            value={texto} onChange={e => setTexto(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        <Button
                            fullWidth variant="outlined" startIcon={<ImageIcon />}
                            disabled={!!loading || !numero.trim()}
                            onClick={() => ejecutar('/dev/simular/imagen', { numero, nombre, texto })}
                        >
                            Simular imagen
                        </Button>
                    </Paper>

                    {/* Audio */}
                    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                        <Typography variant="caption" fontWeight={700} display="block" mb={1}>
                            <AudioFileIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Audio
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, minHeight: 38 }}>
                            Simula una nota de voz (ogg/opus). El audio no es reproducible en dev.
                        </Typography>
                        <Button
                            fullWidth variant="outlined" startIcon={<AudioFileIcon />}
                            disabled={!!loading || !numero.trim()}
                            onClick={() => ejecutar('/dev/simular/audio', { numero, nombre })}
                        >
                            Simular audio
                        </Button>
                    </Paper>

                    {/* Documento */}
                    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                        <Typography variant="caption" fontWeight={700} display="block" mb={1}>
                            <InsertDriveFileIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Documento
                        </Typography>
                        <TextField
                            fullWidth size="small" label="Nombre archivo"
                            value={docFilename} onChange={e => setDocFilename(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        <TextField
                            fullWidth size="small" label="Caption (opcional)"
                            value={docCaption} onChange={e => setDocCaption(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        <Button
                            fullWidth variant="outlined" startIcon={<InsertDriveFileIcon />}
                            disabled={!!loading || !numero.trim()}
                            onClick={() => ejecutar('/dev/simular/documento', { numero, nombre, caption: docCaption, filename: docFilename })}
                        >
                            Simular documento
                        </Button>
                    </Paper>

                    {/* Contacto */}
                    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                        <Typography variant="caption" fontWeight={700} display="block" mb={1}>
                            <ContactsIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Contacto compartido
                        </Typography>
                        <TextField
                            fullWidth size="small" label="Nombre del contacto"
                            value={contactoNombre} onChange={e => setContactoNombre(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        <TextField
                            fullWidth size="small" label="Teléfono (opcional)"
                            value={contactoTelefono} onChange={e => setContactoTelefono(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        <TextField
                            fullWidth size="small" label="Empresa (opcional)"
                            value={contactoEmpresa} onChange={e => setContactoEmpresa(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        <Button
                            fullWidth variant="outlined" startIcon={<ContactsIcon />}
                            disabled={!!loading || !numero.trim() || !contactoNombre.trim()}
                            onClick={() => ejecutar('/dev/simular/contacto', { numero, nombre, contactoNombre, contactoTelefono, contactoEmpresa })}
                        >
                            Simular contacto
                        </Button>
                    </Paper>

                    {/* Sticker */}
                    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                        <Typography variant="caption" fontWeight={700} display="block" mb={1}>
                            <StickerIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Sticker
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, minHeight: 56 }}>
                            Simula un sticker WebP. No visualizable en dev (media ID falso).
                        </Typography>
                        <Button
                            fullWidth variant="outlined" startIcon={<StickerIcon />}
                            disabled={!!loading || !numero.trim()}
                            onClick={() => ejecutar('/dev/simular/sticker', { numero, nombre })}
                        >
                            Simular sticker
                        </Button>
                    </Paper>

                    {/* Reacción */}
                    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                        <Typography variant="caption" fontWeight={700} display="block" mb={1}>
                            <ThumbUpIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Reacción emoji
                        </Typography>
                        <TextField
                            fullWidth size="small" label="Emoji"
                            value={reaccionEmoji} onChange={e => setReaccionEmoji(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        <TextField
                            fullWidth size="small" label="waMessageId al que reacciona"
                            value={reaccionMsgId} onChange={e => setReaccionMsgId(e.target.value)}
                            helperText="ID de un mensaje enviado desde el inbox"
                            sx={{ mb: 1 }}
                        />
                        <Button
                            fullWidth variant="outlined" startIcon={<ThumbUpIcon />}
                            disabled={!!loading || !numero.trim() || !reaccionEmoji.trim()}
                            onClick={() => ejecutar('/dev/simular/reaccion', { numero, nombre, emoji: reaccionEmoji, waMessageId: reaccionMsgId || 'dev-msg-id' })}
                        >
                            Simular reacción
                        </Button>
                    </Paper>
                </Stack>
            </Paper>

            <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
                <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ maxWidth: 500, wordBreak: 'break-all' }}>
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
