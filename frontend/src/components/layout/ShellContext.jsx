import { createContext, useContext, useEffect, useState } from 'react';

// Lo que una pantalla le puede pedir al marco: ocupar todo el alto disponible sin padding (Conversaciones, que maneja
// su propio scroll) y esconder la barra de abajo del celular (un chat abierto, con el teclado).

const ShellContext = createContext({
    pantallaCompleta: false,
    setPantallaCompleta: () => {},
    barraInferiorOculta: false,
    setBarraInferiorOculta: () => {},
    hayBarraInferior: false,
});

export function ShellProvider({ children, hayBarraInferior }) {
    const [pantallaCompleta, setPantallaCompleta] = useState(false);
    const [barraInferiorOculta, setBarraInferiorOculta] = useState(false);
    return (
        <ShellContext.Provider value={{ pantallaCompleta, setPantallaCompleta, barraInferiorOculta, setBarraInferiorOculta, hayBarraInferior }}>
            {children}
        </ShellContext.Provider>
    );
}

export function useShell() {
    return useContext(ShellContext);
}

/**
 * La pantalla ocupa todo el panel, sin padding y sin scroll de página: el alto disponible es el del panel (en la
 * computadora) o el de la ventana menos las barras (en el celular). La pantalla maneja su propio scroll.
 */
export function usePantallaCompleta(activa = true) {
    const { setPantallaCompleta } = useShell();
    useEffect(() => {
        setPantallaCompleta(activa);
        return () => setPantallaCompleta(false);
    }, [activa, setPantallaCompleta]);
}

/** Esconde la barra de abajo del celular mientras `oculta` sea true (por ejemplo, con un chat abierto). */
export function useOcultarBarraInferior(oculta) {
    const { setBarraInferiorOculta } = useShell();
    useEffect(() => {
        setBarraInferiorOculta(!!oculta);
        return () => setBarraInferiorOculta(false);
    }, [oculta, setBarraInferiorOculta]);
}
