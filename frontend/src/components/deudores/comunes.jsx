import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Collapse, IconButton, Paper, TablePagination, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ChevronDown, ChevronLeft, ChevronRight, Eraser, Mail, MessageCircle, Search, SlidersHorizontal, Smartphone } from 'lucide-react';
import api from '../../api/axios';
import { mensajeDeError } from '../../context/FeedbackContext';
import { StatusChip } from '../ui';

// Piezas que comparten el listado, la ficha, el historial y los reportes de deudores, para que un canal se vea igual
// en las cuatro pantallas.

/** Los tres canales con su rótulo, su ícono y el tono del chip. */
export const CANALES = {
    wapi: { label: 'WhatsApp API', Icono: MessageCircle, tono: 'acento', color: 'primary.main' },
    whatsapp: { label: 'WhatsApp Web', Icono: Smartphone, tono: 'ok', color: 'success.main' },
    email: { label: 'Email', Icono: Mail, tono: 'info', color: 'info.main' },
};

/** Chip de un canal con su cantidad (o solo el ícono y el nombre si no hay cantidad). */
export function CanalChip({ canal, cantidad, variante }) {
    const c = CANALES[canal];
    if (!c) return null;
    const { Icono } = c;
    return (
        <StatusChip
            tono={c.tono}
            variant={variante}
            title={c.label}
            label={
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <Icono size={13} strokeWidth={1.75} aria-hidden />
                    {cantidad !== undefined ? <span aria-label={`${c.label}: ${cantidad}`}>{cantidad}</span> : c.label}
                </Box>
            }
        />
    );
}

// Los filtros de fecha vienen como 'YYYY-MM-DD'. `new Date('YYYY-MM-DD')` toma medianoche UTC (21 h del día anterior
// en Argentina), así que "hasta hoy" dejaba afuera el día y "desde" arrancaba un día antes. Se arma con el día local.
const partesDia = (dia) => dia.split('-').map(Number);

/** Primer instante del día local, en ISO. */
export function inicioDelDia(dia) {
    const [y, m, d] = partesDia(dia);
    return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

/** Último instante del día local, en ISO. */
export function finDelDia(dia) {
    const [y, m, d] = partesDia(dia);
    return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

/** Mapa id → nombre de las empresas, para mostrar el nombre en vez del ID. */
export function nombreDeEmpresa(mapa, id) {
    if (id === null || id === undefined || id === '') return '—';
    return mapa.get(id) ?? mapa.get(String(id)) ?? String(id);
}

/** Paginación del servidor: la de MUI en la computadora y una compacta (anterior/siguiente) en el celular. */
export function Paginacion({ total, page, rowsPerPage, onPage, onRowsPerPage, opciones = [10, 20, 50, 100] }) {
    const theme = useTheme();
    const celular = useMediaQuery(theme.breakpoints.down('md'));
    const desde = total === 0 ? 0 : page * rowsPerPage + 1;
    const hasta = Math.min(total, (page + 1) * rowsPerPage);
    const hayMas = hasta < total;

    if (celular) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, borderTop: 1, borderColor: 'divider' }}>
                <IconButton aria-label="Página anterior" disabled={page === 0} onClick={() => onPage(page - 1)} sx={{ width: 44, height: 44 }}>
                    <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
                </IconButton>
                <Typography variant="body2" color="text.secondary" aria-live="polite">
                    {desde}–{hasta} de {total.toLocaleString('es-AR')}
                </Typography>
                <IconButton aria-label="Página siguiente" disabled={!hayMas} onClick={() => onPage(page + 1)} sx={{ width: 44, height: 44 }}>
                    <ChevronRight size={20} strokeWidth={1.75} aria-hidden />
                </IconButton>
            </Box>
        );
    }

    return (
        <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => onPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => onRowsPerPage(parseInt(e.target.value, 10))}
            rowsPerPageOptions={opciones}
            labelRowsPerPage="Filas por página:"
            getItemAriaLabel={(tipo) => ({ first: 'Primera página', last: 'Última página', next: 'Página siguiente', previous: 'Página anterior' })[tipo]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count.toLocaleString('es-AR') : `más de ${to}`}`}
            sx={{ borderTop: 1, borderColor: 'divider' }}
        />
    );
}

/**
 * Catálogos de los filtros: las empresas (una vez) y las remesas de las empresas elegidas. Si falla alguno, `error`
 * lo dice y `reintentar` lo vuelve a pedir (antes el fallo iba solo a la consola y el filtro quedaba vacío).
 * `alCargarRemesas(lista)` deja que la pantalla descarte las remesas elegidas que ya no pertenecen a las empresas.
 */
export function useCatalogosDeudores(empresasElegidas, alCargarRemesas) {
    const [empresas, setEmpresas] = useState([]);
    const [remesas, setRemesas] = useState([]);
    const [error, setError] = useState(null);
    const [intento, setIntento] = useState(0);
    const alCargarRef = useRef(alCargarRemesas);
    alCargarRef.current = alCargarRemesas;

    useEffect(() => {
        let vivo = true;
        api.get('/deudores/empresas')
            .then((res) => { if (vivo) setEmpresas(res.data || []); })
            .catch((err) => { if (vivo) setError(mensajeDeError(err, 'No se pudieron cargar las empresas.')); });
        return () => { vivo = false; };
    }, [intento]);

    const clave = empresasElegidas.map((e) => e.id).join(',');
    useEffect(() => {
        if (!clave) {
            setRemesas([]);
            return undefined;
        }
        let vivo = true;
        api.get('/deudores/remesas', { params: { empresas: clave } })
            .then((res) => {
                if (!vivo) return;
                const lista = res.data || [];
                setRemesas(lista);
                alCargarRef.current?.(lista);
            })
            .catch((err) => { if (vivo) setError(mensajeDeError(err, 'No se pudieron cargar las remesas.')); });
        return () => { vivo = false; };
    }, [clave, intento]);

    const empresasMap = useMemo(() => {
        const mapa = new Map();
        for (const e of empresas) if (e && typeof e === 'object' && 'id' in e) mapa.set(e.id, e.nombre);
        return mapa;
    }, [empresas]);

    return {
        empresas,
        remesas,
        empresasMap,
        error,
        reintentar: () => { setError(null); setIntento((n) => n + 1); },
    };
}

/**
 * El panel de filtros del listado y de los reportes. Es un <form>: Enter en un campo de texto busca (y Enter en un
 * Autocomplete solo elige la opción resaltada, no dispara la búsqueda antes de aplicarla). En el celular queda a la
 * vista `principal` y el resto se pliega en "Filtros (n)"; en la computadora todo va en una fila que se acomoda.
 */
export function PanelFiltros({ principal, secundarios, activos = 0, onBuscar, onLimpiar, buscando = false, puedeBuscar = true }) {
    const theme = useTheme();
    const celular = useMediaQuery(theme.breakpoints.down('md'));
    const [abierto, setAbierto] = useState(false);
    const mostrarSecundarios = !celular || abierto;

    return (
        <Paper
            component="form"
            variant="outlined"
            noValidate
            onSubmit={(e) => { e.preventDefault(); if (puedeBuscar && !buscando) onBuscar(); }}
            sx={{ borderRadius: '14px', p: { xs: 1.5, sm: 2 }, mb: 2.5 }}
        >
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(auto-fit, minmax(190px, 1fr))' }, alignItems: 'start' }}>
                {principal}
                {celular && (
                    <Button
                        onClick={() => setAbierto((v) => !v)}
                        aria-expanded={abierto}
                        color="inherit"
                        startIcon={<SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden />}
                        endIcon={<ChevronDown size={18} strokeWidth={1.75} aria-hidden style={{ transform: abierto ? 'rotate(180deg)' : 'none' }} />}
                        sx={{ justifyContent: 'space-between', minHeight: 44, border: 1, borderColor: 'divider' }}
                    >
                        {activos > 0 ? `Filtros (${activos})` : 'Filtros'}
                    </Button>
                )}
                {celular ? (
                    <Collapse in={abierto} unmountOnExit={false} sx={{ gridColumn: '1 / -1' }}>
                        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'minmax(0, 1fr)', pt: 0.5 }}>{secundarios}</Box>
                    </Collapse>
                ) : mostrarSecundarios && secundarios}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, justifyContent: { md: 'flex-end' }, '& .MuiButton-root': { minHeight: { xs: 44, md: 36 } }, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
                <Button type="button" variant="outlined" color="inherit" onClick={onLimpiar} startIcon={<Eraser size={18} strokeWidth={1.75} aria-hidden />}>
                    Limpiar
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    disabled={!puedeBuscar || buscando}
                    startIcon={buscando ? <CircularProgress size={16} color="inherit" /> : <Search size={18} strokeWidth={1.75} aria-hidden />}
                >
                    Buscar
                </Button>
            </Box>
        </Paper>
    );
}
