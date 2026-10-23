import { Box, Typography } from '@mui/material';
import api from '../api/axios';
import { mensajeDeError, useFeedback } from '../context/FeedbackContext';
import SubirCsvDialog from './campanias/waweb/SubirCsvDialog';

// "Nueva campaña" de WhatsApp Web. El error de subida se avisa acá mismo: antes dependía de un `setMensaje` que la
// lista nunca pasaba y el error no se veía.

const code = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9em' };

export default function SubirCampaña({ open, onClose, onUploadSuccess }) {
    const feedback = useFeedback();

    const subir = async (nombre, archivo) => {
        const formData = new FormData();
        formData.append('file', archivo);
        formData.append('campania', nombre);
        try {
            await api.post('/whatsapp/campanias/upload-csv', formData);
        } catch (error) {
            feedback.error(mensajeDeError(error, 'No se pudo subir la campaña. Revisá que el archivo sea un CSV con la columna numero.'));
            throw error;
        }
        onUploadSuccess?.();
    };

    return (
        <SubirCsvDialog
            open={open}
            onClose={onClose}
            onSubir={subir}
            ayuda={(
                <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Formato del CSV</Typography>
                    <Typography variant="body2" component="div">
                        Separado por comas, con una fila de encabezados. La columna <Box component="code" sx={code}>numero</Box> es obligatoria;
                        {' '}<Box component="code" sx={code}>mensaje</Box> es opcional (un texto propio para ese contacto). Las demás
                        columnas quedan como variables que la plantilla puede usar. Las filas sin número se descartan.
                    </Typography>
                </Box>
            )}
        />
    );
}
