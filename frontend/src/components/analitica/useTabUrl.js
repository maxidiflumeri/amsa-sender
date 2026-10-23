import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * La pestaña activa vive en la URL (`?tab=`), así el atrás de Android y un enlace compartido vuelven a la misma pestaña.
 * `ids` es la lista de pestañas válidas; la primera es la de por defecto. Devuelve [índice, cambiarPorIndice].
 * Cambiar de pestaña reemplaza la entrada del historial: no se acumula una por cada toque.
 */
export default function useTabUrl(ids, param = 'tab') {
    const [params, setParams] = useSearchParams();
    const actual = params.get(param);
    const indice = Math.max(0, ids.indexOf(actual));

    const cambiar = useCallback(
        (nuevo) => {
            setParams(
                (previos) => {
                    const sig = new URLSearchParams(previos);
                    if (nuevo === 0) sig.delete(param);
                    else sig.set(param, ids[nuevo]);
                    return sig;
                },
                { replace: true },
            );
        },
        [ids, param, setParams],
    );

    return [indice, cambiar];
}
