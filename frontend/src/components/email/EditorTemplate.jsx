import { useRef, useEffect, useState } from 'react';
import EmailEditor from 'react-email-editor';
import { useTheme } from '@mui/material/styles';
import {
    Box,
    Button,
    MenuItem,
    Select,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    useMediaQuery
} from '@mui/material';

const variablesDisponibles = [
    'mail',
    'nombre',
    'id_contacto',
    'Telefono_1',
    'Telefono_2',
    'direccion',
    'ciudad',
    'Empresa',
    'deuhist',
    'deuact',
    'Filer',
    'Nroemp',
    'remesa',
    'Cuitdoc',
    'Codemp2',
    'codpos',
    'f_recepc',
    'f_cierre',
    'Usercode2',
    'Usercode3',
    'Usercode4',
    'usernum0',
    'usernum1',
    'usernum2',
    'codbar',
    'codbar_2',
    'Usercode1',
    'co1',
    'userfec5'
];

const EditorTemplate = ({ initialDesign, onGuardar }) => {
    const emailEditorRef = useRef();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [dialogOpen, setDialogOpen] = useState(false);
    const [exportedData, setExportedData] = useState(null);

    useEffect(() => {
        if (emailEditorRef.current?.editor) {
            emailEditorRef.current.editor.setAppearance({
                theme: theme.palette.mode === 'dark' ? 'dark' : 'light'
            });
        }
    }, [theme.palette.mode]);

    const handleLoad = () => {
        const editor = emailEditorRef.current?.editor;

        if (!editor) return;

        if (initialDesign) {
            editor.loadDesign(initialDesign);
        }

        // Armar merge tags con formato deseado
        const mergeTags = {};
        variablesDisponibles.forEach((v) => {
            mergeTags[v] = {
                name: v.charAt(0).toUpperCase() + v.slice(1),
                value: `{{${v}}}`
            };
        });

        // Agruparlos bajo nombre personalizado
        editor.setMergeTags(mergeTags);
    };

    const handleExportar = () => {
        if (!emailEditorRef.current) return;

        emailEditorRef.current.editor.exportHtml((data) => {
            const { html, design } = data;

            setExportedData({ html, design });
            setDialogOpen(true);
            console.log(html)
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
                                merge_tags: 'Variables disponibles', // ✅ este es el nombre del botón principal
                                no_tags: 'No hay variables disponibles', // opcional
                                search_placeholder: 'Buscar variable...', // opcional
                                search_empty: 'Sin resultados' // opcional
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
                    <Button onClick={handleConfirmarGuardado} color="primary" variant="contained">
                        Confirmar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EditorTemplate;