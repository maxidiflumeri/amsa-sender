import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Button, Snackbar } from '@mui/material';

// Un solo aviso para toda la app. Antes había cinco formas: snackbars copiados con el ícono de "ok" también en los
// errores, alerts fijos en la página, `window.confirm`, `alert()` y errores que solo iban a la consola.

const FeedbackContext = createContext(null);

const DURACION = { success: 4000, info: 5000, warning: 7000, error: 8000 };

export function FeedbackProvider({ children }) {
    const [aviso, setAviso] = useState(null);

    const mostrar = useCallback((severity, mensaje, opciones = {}) => {
        setAviso({ id: Date.now(), severity, mensaje, accion: opciones.accion ?? null, duracion: opciones.duracion ?? DURACION[severity] });
    }, []);

    const api = useMemo(() => ({
        /** Algo salió bien. */
        exito: (mensaje, opciones) => mostrar('success', mensaje, opciones),
        /** Algo falló. `opciones.accion = { etiqueta: 'Reintentar', onClick }` agrega un botón. */
        error: (mensaje, opciones) => mostrar('error', mensaje, opciones),
        aviso: (mensaje, opciones) => mostrar('warning', mensaje, opciones),
        info: (mensaje, opciones) => mostrar('info', mensaje, opciones),
        cerrar: () => setAviso(null),
    }), [mostrar]);

    const cerrar = (_, motivo) => {
        if (motivo === 'clickaway') return;
        setAviso(null);
    };

    return (
        <FeedbackContext.Provider value={api}>
            {children}
            <Snackbar
                key={aviso?.id}
                open={!!aviso}
                autoHideDuration={aviso?.duracion}
                onClose={cerrar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                // En el celular, arriba de la barra de abajo.
                sx={{ bottom: { xs: 'calc(80px + env(safe-area-inset-bottom))', md: 24 } }}
            >
                {aviso ? (
                    <Alert
                        severity={aviso.severity}
                        variant="filled"
                        onClose={() => setAviso(null)}
                        sx={{ width: '100%', maxWidth: 560, alignItems: 'center' }}
                        action={aviso.accion ? (
                            <Button
                                color="inherit"
                                size="small"
                                onClick={() => {
                                    setAviso(null);
                                    aviso.accion.onClick();
                                }}
                            >
                                {aviso.accion.etiqueta}
                            </Button>
                        ) : undefined}
                    >
                        {aviso.mensaje}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </FeedbackContext.Provider>
    );
}

/** `{ exito, error, aviso, info, cerrar }`. */
export function useFeedback() {
    const ctx = useContext(FeedbackContext);
    if (!ctx) throw new Error('useFeedback tiene que usarse dentro de FeedbackProvider');
    return ctx;
}

/** El mensaje de error del backend (NestJS) o uno genérico. */
export function mensajeDeError(error, generico = 'No se pudo completar. Probá de nuevo.') {
    if (!error?.response) return error?.message === 'Network Error' ? 'Sin conexión con el servidor.' : generico;
    const m = error.response.data?.message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string' && m.trim()) return m;
    return generico;
}
