import { useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { Box, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography } from '@mui/material';
import { VistaPreviaEmail } from '../ui';

/**
 * Editor de contenido básico (Quill) con variables. Lo usan Tareas programadas (el cuerpo del reporte) y el envío
 * manual de email en el celular, donde el editor de diseño no entra.
 *
 * @param {object} props
 * @param {string} props.value HTML.
 * @param {(html: string) => void} props.onChange
 * @param {{label: string, token: string}[]} [props.variables]
 * @param {string} [props.placeholder]
 * @param {number} [props.alturaMinima] Alto mínimo del área de escritura, en px.
 */
export default function HTMLTemplateEditor({
    value,
    onChange,
    variables = [{ label: 'Fecha', token: '${DATE}' }],
    placeholder = 'Escribí tu contenido (podés insertar variables)…',
    alturaMinima = 200,
}) {
    const containerRef = useRef(null);
    const quillRef = useRef(null);
    const lastHtml = useRef('');
    // El onChange más nuevo: el de la primera vuelta quedaba capturado y escribía sobre un estado viejo.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // La vista previa arranca apagada: ocupa lugar y casi nunca hace falta mientras se escribe.
    const [showPreview, setShowPreview] = useState(false);

    // Instancia Quill una sola vez
    useEffect(() => {
        if (!containerRef.current || quillRef.current) return undefined;

        const q = new Quill(containerRef.current, {
            theme: 'snow',
            placeholder,
            modules: {
                toolbar: [
                    [{ header: [1, 2, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    [{ align: [] }],
                    ['link', 'clean'],
                ],
            },
        });
        quillRef.current = q;

        if (value) {
            q.clipboard.dangerouslyPasteHTML(value);
            lastHtml.current = value;
        }

        q.on('text-change', () => {
            const html = q.root.innerHTML;
            if (html !== lastHtml.current) {
                lastHtml.current = html;
                onChangeRef.current?.(html);
            }
        });
        // Solo al montar: el valor posterior lo sincroniza el efecto de abajo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sincroniza cuando el padre cambia "value" (reset del form, editar)
    useEffect(() => {
        const q = quillRef.current;
        if (!q) return;
        if (typeof value === 'string' && value !== lastHtml.current) {
            q.setContents([]);
            q.clipboard.dangerouslyPasteHTML(value);
            lastHtml.current = value;
        }
    }, [value]);

    // Elegir una variable la inserta donde está el cursor: un paso menos que "elegir y después tocar Insertar".
    const insertarVariable = (token) => {
        const q = quillRef.current;
        if (!q || !token) return;
        const range = q.getSelection(true) || { index: q.getLength(), length: 0 };
        q.insertText(range.index, token);
        q.setSelection(range.index + token.length, 0);
    };

    return (
        <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>Contenido del email (básico, con formato)</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                    <FormControl size="small" sx={{ minWidth: { sm: 220 } }}>
                        <InputLabel id="insertar-variable">Insertar variable</InputLabel>
                        <Select
                            labelId="insertar-variable"
                            label="Insertar variable"
                            value=""
                            onChange={(e) => insertarVariable(e.target.value)}
                        >
                            {variables.map((v) => (
                                <MenuItem key={v.token} value={v.token} sx={{ minHeight: 44 }}>{v.label} — {v.token}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        sx={{ mr: 0, minHeight: 44 }}
                        control={<Switch checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} />}
                        label="Vista previa"
                    />
                </Stack>
            </Stack>

            <Box
                sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                    // Quill trae sus colores: se pasan a los del tema para que ande en oscuro.
                    '& .ql-toolbar.ql-snow': { border: 0, borderBottom: 1, borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 0.25, p: 0.75 },
                    '& .ql-container.ql-snow': { border: 0, fontFamily: 'inherit' },
                    '& .ql-stroke': { stroke: (t) => t.palette.text.primary },
                    '& .ql-fill': { fill: (t) => t.palette.text.primary },
                    '& .ql-picker': { color: 'text.primary' },
                    '& .ql-picker-options': { bgcolor: 'background.paper', borderColor: 'divider' },
                    '& .ql-editor.ql-blank::before': { color: 'text.secondary', fontStyle: 'normal' },
                    '& .ql-editor': { minHeight: alturaMinima, fontSize: { xs: 16, md: 14 }, lineHeight: 1.5 },
                    // Con el dedo: los botones de la barra miden 44 px.
                    '& .ql-toolbar button': { width: { xs: 44, md: 28 }, height: { xs: 44, md: 24 } },
                    '& .ql-toolbar .ql-picker-label': { minHeight: { xs: 44, md: 24 }, display: 'flex', alignItems: 'center' },
                    '& .ql-toolbar .ql-formats': { display: 'inline-flex', alignItems: 'center', mr: { xs: 0.5, md: 1.5 } },
                }}
            >
                <div ref={containerRef} />
            </Box>

            {showPreview && <VistaPreviaEmail html={value || ''} titulo="Vista previa del contenido" altoMaximo={360} />}
        </Stack>
    );
}
