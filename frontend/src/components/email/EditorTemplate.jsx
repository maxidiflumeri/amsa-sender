import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import EmailEditor from 'react-email-editor';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import { VARIABLES_EMAIL } from '../plantillas/variablesEmail';

const DISEÑO_NUEVO = {
    body: {
        contentWidth: '600px',
        rows: [{ cells: [1], columns: [{ contents: [], values: {} }], values: {} }],
    },
};

/**
 * El editor de diseño (Unlayer). No tiene botón de guardar propio: el botón vive arriba, junto a los campos de la
 * plantilla, y le pide el contenido con `ref.current.exportar()` (antes había que confirmar un diálogo de "se exportará
 * el HTML…" que no le servía a nadie).
 *
 * @param {object} props
 * @param {object} [props.initialDesign]
 * @param {() => void} [props.onCambio] Avisa que el operador tocó el diseño (para preguntar antes de salir).
 */
const EditorTemplate = forwardRef(function EditorTemplate({ initialDesign, onCambio }, ref) {
    const editorRef = useRef(null);
    const theme = useTheme();
    const [listo, setListo] = useState(false);
    // Unlayer avisa "design:updated" también cuando carga el diseño inicial: hasta que pasa un rato no cuenta como cambio.
    const aceptaCambios = useRef(false);
    const onCambioRef = useRef(onCambio);
    onCambioRef.current = onCambio;

    useImperativeHandle(ref, () => ({
        estaListo: () => !!editorRef.current?.editor,
        exportar: () => new Promise((resolve, reject) => {
            const editor = editorRef.current?.editor;
            if (!editor) {
                reject(new Error('El editor todavía está cargando.'));
                return;
            }
            editor.exportHtml(({ html, design }) => resolve({ html, design }));
        }),
    }));

    useEffect(() => {
        editorRef.current?.editor?.setAppearance({ theme: theme.palette.mode === 'dark' ? 'dark' : 'light' });
    }, [theme.palette.mode]);

    // Variables como etiquetas de combinación, para insertarlas desde el propio editor.
    useEffect(() => {
        const editor = editorRef.current?.editor;
        if (!listo || !editor) return;
        const mergeTags = {};
        VARIABLES_EMAIL.forEach((v) => {
            mergeTags[v] = { name: v.charAt(0).toUpperCase() + v.slice(1), value: `{{${v}}}` };
        });
        editor.setMergeTags(mergeTags);
        editor.addEventListener('design:updated', () => {
            if (aceptaCambios.current) onCambioRef.current?.();
        });
    }, [listo]);

    useEffect(() => {
        const editor = editorRef.current?.editor;
        if (!listo || !editor) return undefined;
        aceptaCambios.current = false;
        if (initialDesign) {
            editor.loadDesign(initialDesign);
        } else {
            editor.loadDesign(DISEÑO_NUEVO);
            editor.setBodyValues({ contentWidth: '600px' });
        }
        const t = setTimeout(() => {
            aceptaCambios.current = true;
        }, 1500);
        return () => clearTimeout(t);
    }, [listo, initialDesign]);

    return (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: '14px', overflow: 'hidden' }}>
            <EmailEditor
                onLoad={() => setListo(true)}
                ref={editorRef}
                style={{ height: 'max(560px, calc(100dvh - 280px))' }}
                options={{
                    projectId: '279225',
                    locale: 'es',
                    appearance: { theme: theme.palette.mode === 'dark' ? 'dark' : 'modern_light' },
                    translations: {
                        es: {
                            mergeTags: {
                                merge_tags: 'Variables disponibles',
                                no_tags: 'No hay variables disponibles',
                                search_placeholder: 'Buscar variable...',
                                search_empty: 'Sin resultados',
                            },
                        },
                    },
                }}
            />
        </Box>
    );
});

export default EditorTemplate;
