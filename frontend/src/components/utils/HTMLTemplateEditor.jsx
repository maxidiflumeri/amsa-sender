import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuill } from 'react-quilljs';
import 'quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import {
    Box, Stack, Typography, Button, FormControl, InputLabel, Select, MenuItem, Paper, Switch, FormControlLabel
} from '@mui/material';

export default function HtmlTemplateEditor({
    value,
    onChange,
    variables = [{ label: 'Fecha', token: '${DATE}' }],
    placeholder = 'Escribe tu contenido (puedes insertar variables)…',
}) {
    const modules = useMemo(() => ({
        toolbar: [
            [{ header: [1, 2, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ align: [] }],
            ['link', 'clean'],
        ],
    }), []);

    const { quill, quillRef } = useQuill({ theme: 'snow', modules, placeholder });
    const [showPreview, setShowPreview] = useState(true);
    const [selectedVar, setSelectedVar] = useState('');
    const initialLoaded = useRef(false);
    const lastEmitted = useRef(null);

    // Montaje: setear HTML inicial una sola vez
    useEffect(() => {
        if (quill && !initialLoaded.current) {
            const html = value || '';
            quill.clipboard.dangerouslyPasteHTML(html);
            lastEmitted.current = html;
            initialLoaded.current = true;

            // Propagar cambios al padre
            quill.on('text-change', () => {
                const htmlNow = quill.root.innerHTML;
                if (htmlNow !== lastEmitted.current) {
                    lastEmitted.current = htmlNow;
                    onChange?.(htmlNow);
                }
            });
        }
    }, [quill]);

    // Si el valor externo cambia (e.g. reseteo del form), reflejarlo sin loop
    useEffect(() => {
        if (quill && initialLoaded.current && typeof value === 'string' && value !== lastEmitted.current) {
            quill.setContents([]); // limpiar
            quill.clipboard.dangerouslyPasteHTML(value);
            lastEmitted.current = value;
        }
    }, [value, quill]);

    const insertVariable = (token) => {
        if (!quill) return;
        const t = token || selectedVar;
        if (!t) return;
        const range = quill.getSelection(true);
        const index = range ? range.index : quill.getLength();
        quill.insertText(index, t);
        quill.setSelection(index + t.length, 0);
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
                        <Select label="Insertar variable" value={selectedVar} onChange={(e) => setSelectedVar(e.target.value)}>
                            {variables.map(v => <MenuItem key={v.token} value={v.token}>{v.label} — {v.token}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button variant="outlined" onClick={() => insertVariable(selectedVar)} disabled={!selectedVar}>Insertar</Button>
                    <FormControlLabel control={<Switch checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} />} label="Vista previa" />
                </Stack>
            </Stack>

            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--mui-palette-divider, #e0e0e0)' }}>
                <div ref={quillRef} />
            </div>

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