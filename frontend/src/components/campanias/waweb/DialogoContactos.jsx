import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Box, Button, InputAdornment, TextField, Typography } from '@mui/material';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { FixedSizeList } from 'react-window';
import { BloqueEstado, EmptyState, ResponsiveDialog } from '../../ui';

// Los contactos de una campaña: una lista virtualizada con buscador (una campaña puede tener decenas de miles) y,
// al tocar uno, el detalle completo. Las filas son de alto fijo a propósito: con alto variable la virtualización
// recorta texto cuando una variable es larga; lo largo se ve en el detalle.

const ALTO_FILA = 68;

function textoDeDatos(datos) {
    return Object.entries(datos ?? {})
        .map(([clave, valor]) => `${clave}: ${valor}`)
        .join(' · ');
}

function useAltoLista() {
    const calcular = () => Math.max(240, Math.min(560, window.innerHeight - 280));
    const [alto, setAlto] = useState(calcular);
    useEffect(() => {
        const alCambiar = () => setAlto(calcular());
        window.addEventListener('resize', alCambiar);
        return () => window.removeEventListener('resize', alCambiar);
    }, []);
    return alto;
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.campania Nombre de la campaña.
 * @param {any[]} props.contactos
 * @param {'email'|'numero'} props.campo La propiedad que identifica al contacto.
 * @param {string} props.etiqueta "Email" o "Número".
 * @param {boolean} [props.cargando]
 * @param {string|null} [props.error]
 * @param {() => void} [props.onReintentar]
 */
export default function DialogoContactos({ open, onClose, campania, contactos, campo, etiqueta, cargando = false, error = null, onReintentar }) {
    const [busqueda, setBusqueda] = useState('');
    const [detalle, setDetalle] = useState(null);
    const buscado = useDeferredValue(busqueda.trim().toLowerCase());
    const altoLista = useAltoLista();

    useEffect(() => {
        if (!open) {
            setBusqueda('');
            setDetalle(null);
        }
    }, [open]);

    const filtrados = useMemo(() => {
        if (!buscado) return contactos;
        return contactos.filter((c) => `${c[campo] ?? ''} ${c.mensaje ?? ''} ${Object.values(c.datos ?? {}).join(' ')}`.toLowerCase().includes(buscado));
    }, [contactos, buscado, campo]);

    const titulo = detalle ? `${etiqueta}: ${detalle[campo]}` : `Contactos de «${campania}»`;

    return (
        <ResponsiveDialog open={open} onClose={onClose} title={titulo} maxWidth="md" cerrarConFondo>
            {cargando && <BloqueEstado estado="cargando" mensaje="Cargando contactos…" />}
            {!cargando && error && <BloqueEstado estado="error" mensaje={error} onReintentar={onReintentar} />}

            {!cargando && !error && detalle && (
                <Box>
                    <Button startIcon={<ArrowLeft size={18} strokeWidth={1.75} aria-hidden />} onClick={() => setDetalle(null)} sx={{ mb: 2, ml: -1, minHeight: 44 }}>
                        Volver a la lista
                    </Button>
                    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(120px, 30%) 1fr' }, gap: { xs: 0.25, sm: 1.5 }, columnGap: 2 }}>
                        <Box component="dt" sx={{ fontSize: 13, color: 'text.secondary' }}>{etiqueta}</Box>
                        <Box component="dd" sx={{ m: 0, mb: { xs: 1.5, sm: 0 }, overflowWrap: 'anywhere', fontWeight: 600 }}>{detalle[campo]}</Box>
                        {detalle.mensaje && (
                            <>
                                <Box component="dt" sx={{ fontSize: 13, color: 'text.secondary' }}>Mensaje propio</Box>
                                <Box component="dd" sx={{ m: 0, mb: { xs: 1.5, sm: 0 }, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{detalle.mensaje}</Box>
                            </>
                        )}
                        {Object.entries(detalle.datos ?? {}).map(([clave, valor]) => (
                            <Box key={clave} sx={{ display: 'contents' }}>
                                <Box component="dt" sx={{ fontSize: 13, color: 'text.secondary', overflowWrap: 'anywhere' }}>{clave}</Box>
                                <Box component="dd" sx={{ m: 0, mb: { xs: 1.5, sm: 0 }, overflowWrap: 'anywhere' }}>{String(valor)}</Box>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {!cargando && !error && !detalle && (
                <>
                    <TextField
                        fullWidth
                        size="small"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder={`Buscar por ${etiqueta.toLowerCase()} o por cualquier dato`}
                        
                        slotProps={{ htmlInput: { 'aria-label': 'Buscar contactos' }, input: { startAdornment: <InputAdornment position="start"><Search size={18} strokeWidth={1.75} aria-hidden /></InputAdornment> } }}
                        sx={{ mb: 1.5 }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} aria-live="polite">
                        {buscado
                            ? `${filtrados.length.toLocaleString('es-AR')} de ${contactos.length.toLocaleString('es-AR')} contactos`
                            : `${contactos.length.toLocaleString('es-AR')} contactos`}
                    </Typography>
                    {filtrados.length === 0 ? (
                        <EmptyState compact title={buscado ? 'Ningún contacto coincide' : 'Esta campaña no tiene contactos'} description={buscado ? 'Probá con otra parte del dato.' : undefined} />
                    ) : (
                        <FixedSizeList height={altoLista} width="100%" itemSize={ALTO_FILA} itemCount={filtrados.length} itemData={filtrados} overscanCount={6}>
                            {({ index, style, data }) => {
                                const c = data[index];
                                const resto = textoDeDatos(c.datos);
                                return (
                                    <Box style={style}>
                                        <Box
                                            component="button"
                                            type="button"
                                            onClick={() => setDetalle(c)}
                                            sx={{
                                                all: 'unset', boxSizing: 'border-box', width: '100%', height: ALTO_FILA, px: 1, display: 'flex', alignItems: 'center', gap: 1,
                                                cursor: 'pointer', borderBottom: 1, borderColor: 'divider', '&:hover, &:focus-visible': { bgcolor: 'action.hover' },
                                            }}
                                        >
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography noWrap sx={{ fontWeight: 600, fontSize: 14.5 }}>{c[campo]}</Typography>
                                                <Typography color="text.secondary" sx={{ fontSize: 13, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere' }}>
                                                    {c.mensaje ? `Mensaje propio · ${resto}` : resto || 'Sin datos adicionales'}
                                                </Typography>
                                            </Box>
                                            <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
                                        </Box>
                                    </Box>
                                );
                            }}
                        </FixedSizeList>
                    )}
                </>
            )}
        </ResponsiveDialog>
    );
}
