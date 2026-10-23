import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

const ANCHO_EMAIL = 600;

/**
 * El HTML de un email en un iframe aislado (sin scripts), escalado al ancho disponible. Antes se inyectaba en la app
 * con `dangerouslySetInnerHTML`: sus estilos se mezclaban con los de la app y se forzaba `table {display:block}`, con
 * lo que la vista previa no era fiel al mail real.
 *
 * @param {object} props
 * @param {string} props.html
 * @param {string} [props.titulo] Para lectores de pantalla.
 * @param {number} [props.altoMaximo] Si se pasa, el contenido se desplaza adentro.
 */
export default function VistaPreviaEmail({ html, titulo = 'Vista previa del email', altoMaximo }) {
    const caja = useRef(null);
    const frame = useRef(null);
    const [escala, setEscala] = useState(1);
    const [alto, setAlto] = useState(400);

    useEffect(() => {
        const el = caja.current;
        if (!el) return undefined;
        const medir = () => setEscala(Math.min(1, el.clientWidth / ANCHO_EMAIL));
        medir();
        const ro = new ResizeObserver(medir);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const alCargar = () => {
        try {
            const doc = frame.current?.contentDocument;
            if (doc) setAlto(Math.max(200, doc.documentElement.scrollHeight));
        } catch {
            /* sin acceso al documento: queda el alto por defecto */
        }
    };

    const altoVisible = alto * escala;
    return (
        <Box
            ref={caja}
            sx={{
                width: '100%',
                overflow: altoMaximo ? 'auto' : 'hidden',
                maxHeight: altoMaximo,
                bgcolor: '#FFFFFF',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
            }}
        >
            <Box sx={{ height: altoVisible, position: 'relative' }}>
                <iframe
                    ref={frame}
                    title={titulo}
                    srcDoc={html || '<p style="font-family:sans-serif;color:#64748b;padding:16px">Sin contenido.</p>'}
                    // Sin allow-scripts: el HTML no puede ejecutar nada. allow-same-origin solo para medir el alto.
                    sandbox="allow-same-origin allow-popups"
                    onLoad={alCargar}
                    style={{
                        border: 0,
                        width: ANCHO_EMAIL,
                        height: alto,
                        transform: `scale(${escala})`,
                        transformOrigin: 'top left',
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        background: '#FFFFFF',
                    }}
                />
            </Box>
        </Box>
    );
}
