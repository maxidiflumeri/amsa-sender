import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, IconButton, Link, Skeleton, Tooltip, Typography } from '@mui/material';
import { Copy, Mail, MailX, Phone, PhoneOff, UserX } from 'lucide-react';
import api from '../../api/axios';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import { BloqueEstado, EmptyState, PageContainer, PageHeader, SectionCard } from '../ui';
import TimelineDeudor from './TimelineDeudor';
import { nombreDeEmpresa } from './comunes';

const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
};

// Una grilla CSS que se acomoda sola: 1 columna en el celular, las que entren desde ahí. Los valores largos (un mail,
// un texto de los datos adicionales) se parten en vez de empujar la pantalla.
const GRILLA = { display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', m: 0 };

function Dato({ etiqueta, children }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography component="dt" variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em', fontSize: 11 }}>
                {etiqueta}
            </Typography>
            <Typography component="dd" variant="body1" sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}>
                {children ?? '—'}
            </Typography>
        </Box>
    );
}

const esVacio = (v) => v === null || v === undefined || v === '';
const esPrimitivo = (v) => typeof v !== 'object' || v === null;

/** Un valor de los datos adicionales, legible: nada de JSON crudo en una línea. */
function ValorLegible({ valor, nivel = 0 }) {
    if (esVacio(valor)) return '—';
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
    if (esPrimitivo(valor)) return String(valor);
    if (Array.isArray(valor)) {
        if (valor.every(esPrimitivo)) return valor.map((v) => (esVacio(v) ? '—' : String(v))).join(', ') || '—';
        return (
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {valor.map((v, i) => <li key={i}><ValorLegible valor={v} nivel={nivel + 1} /></li>)}
            </Box>
        );
    }
    const pares = Object.entries(valor);
    if (pares.length === 0) return '—';
    return (
        <Box component="dl" sx={{ m: 0, display: 'grid', gap: 0.5, pl: nivel > 0 ? 1.5 : 0 }}>
            {pares.map(([k, v]) => (
                <Box key={k}>
                    <Box component="dt" sx={{ fontSize: 12, color: 'text.secondary' }}>{k}</Box>
                    <Box component="dd" sx={{ m: 0, fontSize: 14 }}><ValorLegible valor={v} nivel={nivel + 1} /></Box>
                </Box>
            ))}
        </Box>
    );
}

/**
 * Un teléfono o un mail con sus acciones. En la computadora son botones con texto; en el celular, un renglón de 44 px
 * donde el valor mismo es el enlace (llamar o escribir) y al costado un botón para copiar.
 */
function FilaContacto({ valor, tipo, onCopiar }) {
    const esTel = tipo === 'telefono';
    const Icono = esTel ? Phone : Mail;
    const href = esTel ? `tel:${valor.replace(/[^\d+]/g, '')}` : `mailto:${valor}`;
    const accion = esTel ? 'Llamar' : 'Escribir';

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 44, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}>
            <Box sx={{ color: 'text.secondary', display: 'flex', flex: 'none' }}><Icono size={18} strokeWidth={1.75} aria-hidden /></Box>
            <Link href={href} underline="hover" color="text.primary" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', py: 1, fontSize: 15 }}>
                {valor}
            </Link>
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, flex: 'none' }}>
                <Button size="small" variant="outlined" color="inherit" href={href} startIcon={<Icono size={16} strokeWidth={1.75} aria-hidden />}>{accion}</Button>
                <Button size="small" variant="outlined" color="inherit" onClick={() => onCopiar(valor)} startIcon={<Copy size={16} strokeWidth={1.75} aria-hidden />}>Copiar</Button>
            </Box>
            <Tooltip title="Copiar">
                <IconButton aria-label={`Copiar ${valor}`} onClick={() => onCopiar(valor)} sx={{ display: { xs: 'inline-flex', md: 'none' }, width: 44, height: 44, flex: 'none' }}>
                    <Copy size={18} strokeWidth={1.75} aria-hidden />
                </IconButton>
            </Tooltip>
        </Box>
    );
}

function ListaContactos({ titulo, valores, tipo, vacio, IconoVacio, onCopiar }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>{titulo} ({valores.length})</Typography>
            {valores.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', minHeight: 44 }}>
                    <IconoVacio size={18} strokeWidth={1.75} aria-hidden />
                    <Typography variant="body2">{vacio}</Typography>
                </Box>
            ) : (
                valores.map((v, i) => <FilaContacto key={`${v}-${i}`} valor={v} tipo={tipo} onCopiar={onCopiar} />)
            )}
        </Box>
    );
}

export default function FichaDeudor() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const feedback = useFeedback();

    const [deudor, setDeudor] = useState(null);
    const [empresasMap, setEmpresasMap] = useState(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notFound, setNotFound] = useState(false);

    // Si llegó desde la búsqueda, "Volver" retrocede y la búsqueda sigue como se dejó (filtros y página en la URL).
    const volverA = location.state?.desdeBusqueda ? -1 : '/deudores';
    const migas = [...migasDe('/deudores'), { label: 'Ficha' }];

    const cargar = useCallback(async () => {
        if (!id) {
            setError('ID de deudor inválido');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        setNotFound(false);
        try {
            const res = await api.get(`/deudores/${id}`);
            setDeudor(res.data);
        } catch (err) {
            if (err.response?.status === 404) setNotFound(true);
            else setError(mensajeDeError(err, 'No se pudo cargar el deudor.'));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    // El nombre de la empresa, como en el listado. Si no llega, se muestra el ID (no es motivo para frenar la ficha).
    useEffect(() => {
        let vivo = true;
        api.get('/deudores/empresas')
            .then((res) => {
                if (!vivo) return;
                const mapa = new Map();
                for (const e of res.data || []) if (e && typeof e === 'object' && 'id' in e) mapa.set(e.id, e.nombre);
                setEmpresasMap(mapa);
            })
            .catch(() => {});
        return () => { vivo = false; };
    }, []);

    const copiar = async (texto) => {
        try {
            await navigator.clipboard.writeText(texto);
            feedback.exito(`Copiado: ${texto}`);
        } catch {
            feedback.error('No se pudo copiar. Mantené apretado el texto para copiarlo a mano.');
        }
    };

    if (loading) {
        return (
            <PageContainer>
                <PageHeader title="Deudor" back={volverA} breadcrumbs={migas} />
                <Skeleton variant="rounded" height={140} sx={{ mb: 2 }} />
                <Skeleton variant="rounded" height={180} sx={{ mb: 2 }} />
                <Skeleton variant="rounded" height={240} />
            </PageContainer>
        );
    }

    if (notFound) {
        return (
            <PageContainer>
                <PageHeader title="Deudor no encontrado" back={volverA} breadcrumbs={migas} />
                <EmptyState
                    icon={UserX}
                    title="No existe ese deudor"
                    description={`El deudor con ID ${id} no está en el sistema.`}
                    action={{ label: 'Volver a la búsqueda', onClick: () => navigate(volverA) }}
                />
            </PageContainer>
        );
    }

    if (error) {
        return (
            <PageContainer>
                <PageHeader title="Deudor" back={volverA} breadcrumbs={migas} />
                <BloqueEstado estado="error" mensaje={error} onReintentar={cargar} />
            </PageContainer>
        );
    }

    const datos = deudor.datos && typeof deudor.datos === 'object' ? Object.entries(deudor.datos) : [];

    return (
        <PageContainer>
            <PageHeader
                title={deudor.nombre || 'Sin nombre'}
                subtitle={`ID deudor: ${deudor.idDeudor ?? '—'}`}
                back={volverA}
                backLabel={volverA === -1 ? 'Volver a la búsqueda' : 'Volver'}
                breadcrumbs={migas}
            />

            <Box sx={{ display: 'grid', gap: 2 }}>
                <SectionCard title="Datos del deudor">
                    <Box component="dl" sx={GRILLA}>
                        <Dato etiqueta="Documento">{deudor.documento}</Dato>
                        <Dato etiqueta="Empresa">{esVacio(deudor.empresa) ? null : nombreDeEmpresa(empresasMap, deudor.empresa)}</Dato>
                        <Dato etiqueta="Nro. de empresa">{deudor.nroEmpresa}</Dato>
                        <Dato etiqueta="Remesa">{deudor.remesa}</Dato>
                        <Dato etiqueta="Última actualización">{formatDate(deudor.actualizadoEn)}</Dato>
                    </Box>
                </SectionCard>

                <SectionCard title="Canales de contacto">
                    <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' } }}>
                        <ListaContactos
                            titulo="Teléfonos"
                            valores={deudor.canales?.telefonos ?? []}
                            tipo="telefono"
                            vacio="Sin teléfonos registrados"
                            IconoVacio={PhoneOff}
                            onCopiar={copiar}
                        />
                        <ListaContactos
                            titulo="Emails"
                            valores={deudor.canales?.emails ?? []}
                            tipo="email"
                            vacio="Sin emails registrados"
                            IconoVacio={MailX}
                            onCopiar={copiar}
                        />
                    </Box>
                </SectionCard>

                {datos.length > 0 && (
                    <SectionCard title="Datos adicionales">
                        <Box component="dl" sx={GRILLA}>
                            {datos.map(([clave, valor]) => (
                                <Dato key={clave} etiqueta={clave}>
                                    <ValorLegible valor={valor} />
                                </Dato>
                            ))}
                        </Box>
                    </SectionCard>
                )}

                <TimelineDeudor deudorId={deudor.id} />
            </Box>
        </PageContainer>
    );
}
