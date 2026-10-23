import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { Check, QrCode, TriangleAlert } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { mensajeDeError } from '../context/FeedbackContext';
import { useEventoSocket } from '../context/SocketContext';
import { BloqueEstado, PageContainer, PageHeader, SectionCard } from './ui';

// Conectar un número de WhatsApp Web: se pide la sesión, el servidor manda el código QR por el socket y se escanea
// con el teléfono. Los eventos `estado_sesion` son de todos los que estén conectando a la vez: cada uno se queda solo
// con los de su propia sesión (el POST devuelve su `sessionId`).

// WhatsApp renueva el QR por su cuenta cada ~20 s unas cuantas veces; si pasa más de un minuto sin uno nuevo, ya no
// hay nada que escanear y hay que pedir otra sesión.
const ESPERA_QR_MS = 60_000;
const ESPERA_VENCE_QR_MS = 60_000;
const ESPERA_CONEXION_MS = 90_000;

const PASOS = [
    'Abrí WhatsApp en el teléfono del número que querés conectar.',
    'Entrá a Ajustes › Dispositivos vinculados › Vincular un dispositivo.',
    'Escaneá el código QR de esta pantalla con la cámara del teléfono.',
];

const MIGAS = [{ label: 'Envíos' }, { label: 'WhatsApp Web' }, { label: 'Sesiones', to: '/sesiones' }, { label: 'Conectar sesión' }];

export default function ConectarSesion() {
    const navigate = useNavigate();
    const [fase, setFase] = useState('inicial'); // inicial | pidiendo | qr | vencido | autenticando | conectado | error
    const [qr, setQr] = useState(null);
    const [version, setVersion] = useState(0); // cuenta los QR recibidos, para reiniciar el reloj del vencimiento
    const [ani, setAni] = useState('');
    const [errorTexto, setErrorTexto] = useState('');

    const sesionRef = useRef(null);
    const faseRef = useRef(fase);
    faseRef.current = fase;
    const pendientes = useRef([]);

    const descartarSesion = useCallback(async (id) => {
        // Una sesión que nunca llegó a conectarse queda "esperando escaneo" en la lista de todos: se borra. Pero la fase
        // de esta pantalla sale de eventos del socket, que se pierden si la conexión se cortó justo al escanear (o si
        // `ready` tarda): antes de borrar se pregunta el estado real, y ante la duda no se borra. Borrar una sesión
        // conectada desvincula la línea y hay que volver a escanear.
        if (!id) return;
        try {
            const { data } = await api.get(`/whatsapp/sesiones/status/${id}`);
            if (!['qr', 'inicializando', 'fallo_autenticacion', 'desconectado'].includes(data?.estado)) return;
            await api.delete(`/whatsapp/sesiones/${id}`);
        } catch {
            /* sin estado (404, red, permiso): no se toca */
        }
    }, []);

    const aplicar = useCallback((evento) => {
        const { estado, qr: codigo, ani: numero, mensaje } = evento;
        if (estado === 'qr') {
            setQr(codigo);
            setVersion((v) => v + 1);
            setFase('qr');
        } else if (estado === 'iniciando_sesion') {
            setQr(null);
            setFase('autenticando');
        } else if (estado === 'conectado') {
            setQr(null);
            setAni(numero || '');
            setFase('conectado');
        } else if (estado === 'fallo_autenticacion') {
            setQr(null);
            setErrorTexto(mensaje || 'WhatsApp no pudo autenticar la sesión.');
            setFase('error');
        } else if (estado === 'desconectado' && ['pidiendo', 'qr', 'autenticando', 'vencido'].includes(faseRef.current)) {
            setQr(null);
            setErrorTexto('La sesión se desconectó antes de terminar de conectarse.');
            setFase('error');
        }
    }, []);

    useEventoSocket('estado_sesion', (evento) => {
        if (!evento?.sessionId) return;
        if (sesionRef.current === null && faseRef.current === 'pidiendo') {
            // El POST todavía no devolvió el id de nuestra sesión: se guarda y se mira después.
            pendientes.current.push(evento);
            return;
        }
        if (evento.sessionId === sesionRef.current) aplicar(evento);
    });

    const conectar = async () => {
        descartarSesion(faseRef.current === 'conectado' ? null : sesionRef.current);
        sesionRef.current = null;
        pendientes.current = [];
        setQr(null);
        setErrorTexto('');
        setFase('pidiendo');
        try {
            const res = await api.post('/whatsapp/sesiones/conectar');
            sesionRef.current = res.data.sessionId;
            for (const evento of pendientes.current) {
                if (evento.sessionId === sesionRef.current) aplicar(evento);
            }
            pendientes.current = [];
        } catch (error) {
            setErrorTexto(mensajeDeError(error, 'No se pudo pedir la sesión al servidor.'));
            setFase('error');
        }
    };

    const conectarOtra = () => {
        sesionRef.current = null;
        setAni('');
        setQr(null);
        setFase('inicial');
    };

    // Los plazos de cada fase: si el servidor no responde a tiempo, el error se ve y se puede reintentar (antes la
    // pantalla quedaba girando para siempre).
    useEffect(() => {
        const plazos = {
            pidiendo: [ESPERA_QR_MS, () => {
                setErrorTexto('El código QR no llegó. Puede que el servidor esté ocupado o que WhatsApp no haya respondido.');
                setFase('error');
            }],
            qr: [ESPERA_VENCE_QR_MS, () => setFase('vencido')],
            autenticando: [ESPERA_CONEXION_MS, () => {
                setErrorTexto('La conexión con WhatsApp tardó demasiado. Probá de nuevo.');
                setFase('error');
            }],
        };
        const plazo = plazos[fase];
        if (!plazo) return undefined;
        const t = setTimeout(plazo[1], plazo[0]);
        return () => clearTimeout(t);
    }, [fase, version]);

    useEffect(() => () => {
        if (faseRef.current !== 'conectado' && faseRef.current !== 'autenticando') descartarSesion(sesionRef.current);
    }, [descartarSesion]);

    const mostrandoPasos = fase !== 'conectado';

    return (
        <PageContainer angosto>
            <PageHeader title="Conectar sesión" subtitle="Vinculá un número de WhatsApp para enviar campañas." breadcrumbs={MIGAS} back="/sesiones" backLabel="Volver a Sesiones" />

            <SectionCard>
                <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 300px' }, alignItems: 'start' }}>
                    <Box>
                        {mostrandoPasos && (
                            <>
                                <Typography component="h2" sx={{ fontSize: 15, fontWeight: 650, mb: 1 }}>Cómo conectarlo</Typography>
                                <Box component="ol" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {PASOS.map((p) => <Typography key={p} component="li" variant="body2">{p}</Typography>)}
                                </Box>
                                <Alert severity="warning" variant="outlined" icon={<TriangleAlert size={20} strokeWidth={1.75} aria-hidden />} sx={{ mt: 2 }}>
                                    No se puede escanear desde el mismo teléfono que muestra el código. Abrí esta pantalla en otro dispositivo
                                    (por ejemplo, la computadora) y escaneá con el teléfono del número.
                                </Alert>
                            </>
                        )}
                        {fase === 'conectado' && (
                            <Typography variant="body2" color="text.secondary">
                                Ya podés elegir esta sesión cuando envíes una campaña.
                            </Typography>
                        )}
                    </Box>

                    <Box role="status" aria-live="polite" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center' }}>
                        {fase === 'inicial' && (
                            <Button variant="contained" fullWidth startIcon={<QrCode size={18} strokeWidth={1.75} aria-hidden />} onClick={conectar} sx={{ minHeight: 44 }}>
                                Generar código QR
                            </Button>
                        )}

                        {fase === 'pidiendo' && (
                            <Box sx={{ py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <CircularProgress />
                                <Typography variant="body2" color="text.secondary">Generando el código… puede tardar unos segundos.</Typography>
                            </Box>
                        )}

                        {fase === 'qr' && qr && (
                            <>
                                {/* El QR va siempre sobre blanco, también en oscuro: los lectores necesitan el contraste. */}
                                <Box sx={{ bgcolor: '#ffffff', p: 2, borderRadius: '14px', border: 1, borderColor: 'divider', width: '100%', maxWidth: 280, lineHeight: 0 }}>
                                    <QRCode value={qr} size={256} bgColor="#ffffff" fgColor="#000000" style={{ width: '100%', height: 'auto' }} />
                                </Box>
                                <Typography variant="body2" color="text.secondary">El código se renueva solo. Escanealo apenas lo veas.</Typography>
                            </>
                        )}

                        {fase === 'vencido' && (
                            <>
                                <Alert severity="warning" variant="outlined" sx={{ width: '100%', textAlign: 'left' }}>El código venció. Pedí uno nuevo para seguir.</Alert>
                                <Button variant="contained" fullWidth startIcon={<QrCode size={18} strokeWidth={1.75} aria-hidden />} onClick={conectar} sx={{ minHeight: 44 }}>
                                    Generar un código nuevo
                                </Button>
                            </>
                        )}

                        {fase === 'autenticando' && (
                            <Box sx={{ py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <CircularProgress />
                                <Typography variant="body2" color="text.secondary">Conectando con WhatsApp… no cierres esta pantalla.</Typography>
                            </Box>
                        )}

                        {fase === 'conectado' && (
                            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'success.main', color: 'success.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Check size={28} strokeWidth={2} aria-hidden />
                                </Box>
                                <Box>
                                    <Typography sx={{ fontSize: 17, fontWeight: 650 }}>Sesión conectada</Typography>
                                    {ani && <Typography variant="body2" color="text.secondary">Número: {ani}</Typography>}
                                </Box>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                                    <Button variant="contained" fullWidth onClick={() => navigate('/sesiones')} sx={{ minHeight: 44 }}>Ir a Sesiones</Button>
                                    <Button variant="outlined" fullWidth onClick={conectarOtra} sx={{ minHeight: 44 }}>Conectar otra</Button>
                                </Box>
                            </Box>
                        )}

                        {fase === 'error' && (
                            <Box sx={{ width: '100%', textAlign: 'left' }}>
                                <BloqueEstado estado="error" mensaje={errorTexto || 'No se pudo conectar la sesión.'} onReintentar={conectar} />
                            </Box>
                        )}
                    </Box>
                </Box>
            </SectionCard>
        </PageContainer>
    );
}
