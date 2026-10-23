import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Autocomplete, Box, Paper, TextField } from '@mui/material';
import { SearchX, UserSearch } from 'lucide-react';
import api from '../../api/axios';
import { mensajeDeError } from '../../context/FeedbackContext';
import { migasDe } from '../layout/navConfig';
import { BloqueEstado, DataTableResponsive, EmptyState, PageContainer, PageHeader } from '../ui';
import { CanalChip, nombreDeEmpresa, PanelFiltros, Paginacion, useCatalogosDeudores } from './comunes';

const TAMANIOS = [10, 20, 50, 100];

// Los filtros aplicados viven en la URL (?q=&empresas=&nro=&remesas=&page=&size=): al volver de la ficha la búsqueda
// sigue ahí, y el atrás del celular hace lo esperable. Lo que se escribe sin buscar todavía vive solo en los inputs.
function leerFiltros(params) {
    const lista = (clave) => (params.get(clave) || '').split(',').map((v) => v.trim()).filter(Boolean);
    const size = Number(params.get('size'));
    return {
        q: params.get('q') || '',
        empresas: lista('empresas'),
        nroEmpresa: params.get('nro') || '',
        remesas: lista('remesas'),
        page: Math.max(0, Number(params.get('page')) || 0),
        size: TAMANIOS.includes(size) ? size : 20,
    };
}

export default function ListadoDeudores() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const aplicados = useMemo(() => leerFiltros(searchParams), [searchParams]);
    const hayBusqueda = Boolean(aplicados.q || aplicados.empresas.length || aplicados.nroEmpresa || aplicados.remesas.length);

    // Lo que hay en el formulario (todavía sin aplicar)
    const [qInput, setQInput] = useState(aplicados.q);
    const [empresasInput, setEmpresasInput] = useState([]);
    const [nroEmpresaInput, setNroEmpresaInput] = useState(aplicados.nroEmpresa);
    const [remesasInput, setRemesasInput] = useState(aplicados.remesas);

    const [deudores, setDeudores] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Si una remesa elegida no es de las empresas elegidas, se descarta (solo después de cargar la lista nueva).
    const depurarRemesas = useCallback((lista) => {
        setRemesasInput((prev) => (prev.every((r) => lista.includes(r)) ? prev : prev.filter((r) => lista.includes(r))));
    }, []);
    const catalogos = useCatalogosDeudores(empresasInput, depurarRemesas);
    const { empresas, remesas, empresasMap } = catalogos;

    // El formulario sigue a la URL (atrás/adelante del navegador, o entrar con un enlace). Las empresas se resuelven
    // a objetos cuando llega el catálogo.
    const claveUrl = searchParams.toString();
    useEffect(() => {
        setQInput(aplicados.q);
        setNroEmpresaInput(aplicados.nroEmpresa);
        setRemesasInput(aplicados.remesas);
        setEmpresasInput(empresas.filter((e) => aplicados.empresas.includes(String(e.id))));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [claveUrl, empresas]);

    const buscar = useCallback(async () => {
        if (!hayBusqueda) {
            setDeudores([]);
            setTotal(0);
            setError(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const params = { page: aplicados.page, size: aplicados.size };
            if (aplicados.q) params.q = aplicados.q;
            if (aplicados.empresas.length) params.empresas = aplicados.empresas.join(',');
            if (aplicados.nroEmpresa) params.nroEmpresa = aplicados.nroEmpresa;
            if (aplicados.remesas.length) params.remesas = aplicados.remesas.join(',');
            const res = await api.get('/deudores/buscar', { params });
            setDeudores(res.data.data);
            setTotal(res.data.total);
        } catch (err) {
            setError(mensajeDeError(err, 'No se pudo buscar deudores.'));
            setDeudores([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [aplicados, hayBusqueda]);

    useEffect(() => {
        buscar();
    }, [buscar]);

    const hayInputs = Boolean(qInput.trim() || empresasInput.length || nroEmpresaInput.trim() || remesasInput.length);
    // Cuántos filtros del panel plegable tienen algo (el texto libre siempre está a la vista).
    const filtrosActivos = (empresasInput.length ? 1 : 0) + (remesasInput.length ? 1 : 0) + (nroEmpresaInput.trim() ? 1 : 0);

    const armarUrl = (cambios) => {
        const p = new URLSearchParams();
        const f = { ...aplicados, ...cambios };
        if (f.q) p.set('q', f.q);
        if (f.empresas.length) p.set('empresas', f.empresas.join(','));
        if (f.nroEmpresa) p.set('nro', f.nroEmpresa);
        if (f.remesas.length) p.set('remesas', f.remesas.join(','));
        if (f.page) p.set('page', String(f.page));
        if (f.size !== 20) p.set('size', String(f.size));
        return p;
    };

    const handleBuscar = () => {
        if (!hayInputs) return;
        setSearchParams(armarUrl({
            q: qInput.trim(),
            empresas: empresasInput.map((e) => String(e.id)),
            nroEmpresa: nroEmpresaInput.trim(),
            remesas: remesasInput,
            page: 0,
        }));
    };

    const limpiar = () => {
        setQInput('');
        setEmpresasInput([]);
        setNroEmpresaInput('');
        setRemesasInput([]);
        setSearchParams({});
    };

    // `desdeBusqueda` le avisa a la ficha que "Volver" puede hacer -1 y recuperar esta búsqueda tal cual.
    const abrirFicha = (d) => navigate(`/deudores/${d.id}`, { state: { desdeBusqueda: true } });

    const columnas = [
        { key: 'nombre', label: 'Nombre', primary: true, render: (d) => d.nombre || 'Sin nombre' },
        { key: 'documento', label: 'Documento', secondary: true, render: (d) => d.documento || '—' },
        { key: 'idDeudor', label: 'ID deudor', render: (d) => d.idDeudor ?? '—' },
        { key: 'empresa', label: 'Empresa', render: (d) => nombreDeEmpresa(empresasMap, d.empresa) },
        { key: 'nroEmpresa', label: 'Nro. empresa', render: (d) => d.nroEmpresa || '—' },
        { key: 'remesa', label: 'Remesa', render: (d) => d.remesa || '—' },
        {
            key: 'canales',
            label: 'Canales',
            render: (d) => {
                const c = d.canales;
                const con = ['wapi', 'whatsapp', 'email'].filter((k) => c[k] > 0);
                if (con.length === 0) return <Box component="span" sx={{ color: 'text.secondary', fontSize: 13 }}>Sin canales</Box>;
                return (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {con.map((k) => <CanalChip key={k} canal={k} cantidad={c[k]} />)}
                    </Box>
                );
            },
        },
    ];

    const vacio = !hayBusqueda ? (
        <EmptyState
            icon={UserSearch}
            title="Buscá un deudor"
            description="Escribí un nombre, un documento o un ID, o elegí una empresa, y tocá Buscar."
        />
    ) : (
        <EmptyState icon={SearchX} compact title="No se encontraron deudores" description="Probá con otros filtros o con menos datos." />
    );

    return (
        <PageContainer>
            <PageHeader title="Buscar deudores" breadcrumbs={migasDe('/deudores')} />

            {catalogos.error && <BloqueEstado estado="error" mensaje={catalogos.error} onReintentar={catalogos.reintentar} />}

            <PanelFiltros
                activos={filtrosActivos}
                onBuscar={handleBuscar}
                onLimpiar={limpiar}
                buscando={loading}
                puedeBuscar={hayInputs}
                principal={
                    <TextField
                        fullWidth
                        size="small"
                        label="Buscar (ID, nombre, documento)"
                        value={qInput}
                        onChange={(e) => setQInput(e.target.value)}
                        slotProps={{ htmlInput: { enterKeyHint: 'search' } }}
                        sx={{ gridColumn: { md: 'span 2' } }}
                    />
                }
                secundarios={
                    <>
                        <Autocomplete
                            multiple
                            fullWidth
                            size="small"
                            options={empresas}
                            value={empresasInput}
                            onChange={(_, v) => {
                                setEmpresasInput(v);
                                if (v.length === 0) setRemesasInput([]);
                            }}
                            filterSelectedOptions
                            disableCloseOnSelect
                            limitTags={2}
                            getOptionLabel={(o) => (typeof o === 'string' ? o : o?.nombre ?? '')}
                            isOptionEqualToValue={(o, v) => o?.id === v?.id}
                            renderInput={(params) => (
                                <TextField {...params} label="Empresas" placeholder={empresasInput.length === 0 ? 'Todas' : ''} />
                            )}
                            noOptionsText="Sin coincidencias"
                        />
                        <Autocomplete
                            multiple
                            fullWidth
                            size="small"
                            disabled={empresasInput.length === 0}
                            options={remesas}
                            value={remesasInput}
                            onChange={(_, v) => setRemesasInput(v)}
                            filterSelectedOptions
                            disableCloseOnSelect
                            limitTags={2}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Remesas"
                                    placeholder={empresasInput.length === 0 ? 'Elegí una empresa' : remesasInput.length === 0 ? 'Todas' : ''}
                                />
                            )}
                            noOptionsText="Sin coincidencias"
                        />
                        <TextField
                            fullWidth
                            size="small"
                            label="Nro. de empresa"
                            value={nroEmpresaInput}
                            onChange={(e) => setNroEmpresaInput(e.target.value)}
                        />
                    </>
                }
            />

            {error ? (
                <BloqueEstado estado="error" mensaje={error} onReintentar={buscar} />
            ) : (
                <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
                    <DataTableResponsive
                        ariaLabel="Deudores encontrados"
                        columns={columnas}
                        rows={deudores}
                        loading={loading}
                        onRowClick={abrirFicha}
                        empty={vacio}
                    />
                    {hayBusqueda && total > 0 && (
                        <Paginacion
                            total={total}
                            page={aplicados.page}
                            rowsPerPage={aplicados.size}
                            opciones={TAMANIOS}
                            onPage={(p) => setSearchParams(armarUrl({ page: p }))}
                            onRowsPerPage={(n) => setSearchParams(armarUrl({ size: n, page: 0 }))}
                        />
                    )}
                </Paper>
            )}
        </PageContainer>
    );
}
