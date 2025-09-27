import { useEffect, useMemo, useRef, useState } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import {
    Box, Stack, Typography, Button,
    FormControl, InputLabel, Select, MenuItem,
    Paper, Switch, FormControlLabel
} from '@mui/material';

export default function HTMLTemplateEditor({
    value,
    onChange,
    variables = [{ label: 'Fecha', token: '${DATE}' }],
    placeholder = 'Escribe tu contenido (puedes insertar variables)…',
}) {
    // refs **válidos** (nunca condicionales)
    const containerRef = useRef(null);
    const quillRef = useRef(null);
    const lastHtml = useRef('');

    const [showPreview, setShowPreview] = useState(true);
    const [selectedVar, setSelectedVar] = useState('');

    // Instancia Quill una sola vez
    useEffect(() => {
        if (!containerRef.current || quillRef.current) return;

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
                onChange?.(html);
            }
        });
    }, [placeholder, onChange, value]);

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

    const insertVariable = (token) => {
        const q = quillRef.current;
        if (!q) return;
        const t = token || selectedVar;
        if (!t) return;
        const range = q.getSelection(true) || { index: q.getLength(), length: 0 };
        q.insertText(range.index, t);
        q.setSelection(range.index + t.length, 0);
    };

    const sanitized = useMemo(() => DOMPurify.sanitize(value || ''), [value]);

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
                            {variables.map(v => (
                                <MenuItem key={v.token} value={v.token}>
                                    {v.label} — {v.token}
                                </MenuItem>
                            ))}
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

            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
                {/* ref correcto (objeto ref), nunca .current ni booleanos */}
                <div ref={containerRef} />
            </Box>

            {showPreview && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, opacity: 0.7 }}>
                        Vista previa
                    </Typography>
                    <Box sx={{ '& p': { m: 0, mb: 1 } }} dangerouslySetInnerHTML={{ __html: sanitized }} />
                </Paper>
            )}
        </Stack>
    );
}