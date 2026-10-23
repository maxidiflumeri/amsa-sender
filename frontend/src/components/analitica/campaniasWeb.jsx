import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Autocomplete, TextField } from '@mui/material';
import api from '../../api/axios';
import { BloqueEstado } from '../ui';

// Reportes y Métricas de WhatsApp Web miran la misma lista de campañas y comparten la elegida en la URL
// (`?campania=`): pasar de una pantalla a la otra no obliga a buscarla de nuevo.

/** Las campañas de WhatsApp Web que tienen reportes, con su estado de carga. */
export function useCampaniasWeb() {
    const [campanias, setCampanias] = useState([]);
    const [estado, setEstado] = useState('cargando');

    const cargar = useCallback(() => {
        setEstado('cargando');
        api.get('/whatsapp/reportes/campanias-con-reportes')
            .then((res) => {
                setCampanias(res.data || []);
                setEstado('ok');
            })
            .catch(() => setEstado('error'));
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    return { campanias, estado, recargar: cargar };
}

/** La campaña elegida (leída de la URL) y cómo cambiarla. Cambiar vuelve a la primera página de todo lo demás. */
export function useCampaniaElegida(campanias) {
    const [params, setParams] = useSearchParams();
    const id = params.get('campania');
    const campania = campanias.find((c) => String(c.id) === id) ?? null;

    const elegir = useCallback(
        (c) => {
            setParams(
                (previos) => {
                    const sig = new URLSearchParams(previos);
                    if (c) sig.set('campania', String(c.id));
                    else sig.delete('campania');
                    return sig;
                },
                { replace: true },
            );
        },
        [setParams],
    );

    return { campania, campaniaId: id, elegir };
}

/** El buscador de campaña. Si la lista no cargó, lo dice con Reintentar en vez de mostrar un buscador vacío. */
export function SelectorCampaniaWeb({ campanias, estado, onReintentar, value, onChange }) {
    if (estado === 'error') {
        return <BloqueEstado estado="error" mensaje="No se pudieron cargar las campañas." onReintentar={onReintentar} />;
    }
    return (
        <Autocomplete
            options={campanias}
            loading={estado === 'cargando'}
            loadingText="Cargando campañas…"
            noOptionsText="No hay campañas con ese nombre"
            getOptionLabel={(c) => c.nombre ?? ''}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            value={value}
            onChange={(_, v) => onChange(v)}
            renderInput={(params) => <TextField {...params} label="Campaña" placeholder="Escribí para buscar" />}
            sx={{ maxWidth: { md: 440 } }}
        />
    );
}
