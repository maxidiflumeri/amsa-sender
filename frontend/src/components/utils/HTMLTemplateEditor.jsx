import { useEffect, useMemo, useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import DOMPurify from 'dompurify';
import 'react-quill/dist/quill.snow.css';
import {
    Box, Stack, Typography, Button, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Paper
} from '@mui/material';

/**
 * Props:
 *  - value: string (html)
 *  - onChange: (html: string) => void
 *  - variables: Array<{ label: string; token: string }>
 *  - placeholder?: string
 */
export default function HtmlTemplateEditor({
    value,
    onChange,
    variables = [{ label: 'Fecha', token: '${DATE}' }],
    placeholder = 'Escribe tu contenido (puedes insertar variables)…',
}) {
    const quillRef = useRef(null);
    const [showPreview, setShowPreview] = useState(true);
    const [selectedVar, setSelectedVar] = useState('');

    // Configuración de toolbar (básico + enlaces)
    const modules = useMemo(() => ({
        toolbar: {
            container: [
                [{ header: [1, 2, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ list: 'ordered' }, { list: 'bullet' }],
                [{ align: [] }],
                ['link', 'clean'],
            ],
        },
    }), []);

    // Inserta una variable en la posición del cursor
    const insertVariable = (token) => {
        const editor = quillRef.current?.getEditor?.();
        if (!editor) return;
        const range = editor.getSelection(true);
        const toInsert = token || selectedVar;
        if (!toInsert) return;
        editor.insertText(range?.index ?? 0, toInsert);
        // mover cursor al final del token insertado
        editor.setSelection((range?.index ?? 0) + toInsert.length, 0);
    };

    // Preview seguro (sanitizado)
    const sanitized = useMemo(() => {
        return DOMPurify.sanitize(value || '');
    }, [value]);

    // Ajustes mínimos para modo oscuro (si tu app está en dark mode)
    useEffect(() => {
        const root = document.querySelector('.ql-toolbar');
        if (root) {
            root.style.borderRadius = '10px 10px 0 0';
        }
        const container = document.querySelector('.ql-container');
        if (container) {
            container.style.borderRadius = '0 0 10px 10px';
            container.style.minHeight = '140px';
        }
    }, []);

    return (
        <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
                    Contenido del email (básico, con formato)
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Insertar variable</InputLabel>
                        <Select
                            label="Insertar variable"
                            value={selectedVar}
                            onChange={(e) => setSelectedVar(e.target.value)}
                        >
                            {variables.map(v => <MenuItem key={v.token} value={v.token}>{v.label} — {v.token}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button variant="outlined" onClick={() => insertVariable(selectedVar)} disabled={!selectedVar}>
                        Insertar
                    </Button>
                    <FormControlLabel
                        control={<Switch checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} />}
                        label="Vista previa"
                    />
                </Stack>
            </Stack>

            <ReactQuill
                ref={quillRef}
                theme="snow"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                modules={modules}
            />

            {showPreview && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, opacity: 0.7 }}>
                        Vista previa
                    </Typography>
                    <Box sx={{ '& p': { m: 0, mb: 1 } }} dangerouslySetInnerHTML={{ __html: sanitized }} />
                </Paper>
            )}

            <Typography variant="caption" color="text.secondary">
                Tips: podés usar variables como <code>${'{DATE}'}</code>. Para contenido más avanzado, usá **Templates de Email** del sistema.
            </Typography>
        </Stack>
    );
}