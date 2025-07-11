import { useRef, useEffect, useState } from 'react';
import EmailEditor from 'react-email-editor';
import { useTheme } from '@mui/material/styles';
import {
    Box,
    Button,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';

const variablesDisponibles = [
    'mail', 'nombre', 'id_contacto', 'Telefono_1', 'Telefono_2', 'direccion',
    'ciudad', 'Empresa', 'deuhist', 'deuact', 'Filer', 'Nroemp', 'remesa',
    'Cuitdoc', 'Codemp2', 'codpos', 'f_recepc', 'f_cierre', 'Usercode2',
    'Usercode3', 'Usercode4', 'usernum0', 'usernum1', 'usernum2', 'codbar',
    'codbar_2', 'Usercode1', 'co1', 'userfec5'
];

const EditorTemplate = ({ initialDesign, onGuardar }) => {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const emailEditorRef = useRef();
    const theme = useTheme();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [exportedData, setExportedData] = useState(null);
    const [editorReady, setEditorReady] = useState(false);

    // Aplica tema cuando cambia
    useEffect(() => {
        if (emailEditorRef.current?.editor) {
            emailEditorRef.current.editor.setAppearance({
                theme: theme.palette.mode === 'dark' ? 'dark' : 'light'
            });
        }
    }, [theme.palette.mode]);

    // Cargar diseño y mergeTags cuando el editor esté listo Y haya diseño disponible
    useEffect(() => {
        const editor = emailEditorRef.current?.editor;

        if (editorReady && editor) {
            // ✅ Siempre setear mergeTags
            const mergeTags = {};
            variablesDisponibles.forEach((v) => {
                mergeTags[v] = {
                    name: v.charAt(0).toUpperCase() + v.slice(1),
                    value: `{{${v}}}`
                };
            });

            editor.setMergeTags(mergeTags);
            //editor.loadDesign(designInicial);
        }
    }, [editorReady]);

    useEffect(() => {
        const editor = emailEditorRef.current?.editor;

        if (editorReady && initialDesign && editor) {
            editor.loadDesign(initialDesign);
        }
    }, [editorReady, initialDesign]);

    useEffect(() => {
        const editor = emailEditorRef.current?.editor;

        // Si el editor está listo, no hay diseño inicial y existe el editor, forzamos ancho 600px
        if (editorReady && !initialDesign && editor) {
            const diseñoNuevo = {
                body: {
                    contentWidth: '600px',
                    rows: [
                        {
                            cells: [1],
                            columns: [
                                {
                                    contents: [],
                                    values: {},
                                },
                            ],
                            values: {},
                        },
                    ],
                },
            };

            editor.loadDesign(diseñoNuevo);
            // ✅ Forzar visualmente el ancho del contenido
            editor.setBodyValues({ contentWidth: '600px' });
        }
    }, [editorReady, initialDesign]);

    const handleLoad = () => {
        setEditorReady(true);
    };

    const handleExportar = () => {
        if (!emailEditorRef.current) return;

        emailEditorRef.current.editor.exportHtml((data) => {
            const { html, design } = data;
            setExportedData({ html, design });
            setDialogOpen(true);
            console.log(html);
        });
    };

    const handleConfirmarGuardado = () => {
        if (exportedData && onGuardar) {
            onGuardar(exportedData);
        }
        setDialogOpen(false);
    };

    return (
        <Box>
            {/* Barra superior */}
            <Box
                sx={{
                    backgroundColor:
                        theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
                    px: 2,
                    py: 1,
                    borderBottom: '1px solid',
                    borderColor:
                        theme.palette.mode === 'dark' ? 'grey.800' : 'grey.300',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1
                }}
            >
                <Typography variant="subtitle1" fontWeight="bold">
                    Editor de Email
                </Typography>

                <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                    <Button
                        sx={{
                            borderRadius: 2,
                            fontFamily: commonFont,
                            textTransform: 'none',
                            fontSize: '0.9rem',
                            backgroundColor: '#075E54',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                backgroundColor: '#0b7b65',
                                transform: 'scale(1.03)',
                                boxShadow: 4,
                            },
                        }}
                        variant="contained"
                        color="primary"
                        size="small"
                        onClick={handleExportar}
                    >
                        Guardar template
                    </Button>
                </Box>
            </Box>

            {/* Editor visual */}
            <EmailEditor
                ref={emailEditorRef}
                onLoad={handleLoad}
                style={{ height: 'calc(100vh - 64px)' }}
                options={{
                    projectId: '276295',
                    locale: 'es',
                    appearance: {
                        theme: theme.palette.mode === 'dark' ? 'dark' : 'modern_light'
                    },
                    translations: {
                        es: {
                            mergeTags: {
                                merge_tags: 'Variables disponibles',
                                no_tags: 'No hay variables disponibles',
                                search_placeholder: 'Buscar variable...',
                                search_empty: 'Sin resultados'
                            }
                        }
                    }
                }}
            />

            {/* Diálogo de confirmación */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle>¿Guardar template?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Se exportará el HTML y diseño actual del editor. ¿Deseás continuar?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)} color="secondary">
                        Cancelar
                    </Button>
                    <Button sx={{
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        fontFamily: commonFont,
                        textTransform: 'none',
                        fontSize: '0.9rem',
                        backgroundColor: '#075E54',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            backgroundColor: '#0b7b65',
                            transform: 'scale(1.03)',
                            boxShadow: 4,
                        },
                    }} onClick={handleConfirmarGuardado} color="primary" variant="contained">
                        Confirmar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EditorTemplate;