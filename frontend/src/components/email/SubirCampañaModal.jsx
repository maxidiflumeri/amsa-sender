import { Box, Typography } from '@mui/material';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { mensajeDeError, useFeedback } from '../../context/FeedbackContext';
import SubirCsvDialog from '../campanias/waweb/SubirCsvDialog';

// "Nueva campaña" de Email. A diferencia de WhatsApp Web, el archivo va separado por tabulaciones y el email se
// lee de la columna `mail`.

const code = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9em' };

export default function SubirCampañaModal({ open, onClose, onUploadSuccess }) {
    const feedback = useFeedback();
    const { usuario, user } = useAuth();

    const subir = async (nombre, archivo) => {
        const userId = usuario?.id ?? user?.sub;
        if (userId === undefined || userId === null) {
            feedback.error('No se pudo identificar tu usuario. Volvé a iniciar sesión.');
            throw new Error('sin usuario');
        }
        const formData = new FormData();
        formData.append('file', archivo);
        formData.append('nombre', nombre);
        formData.append('userId', userId);
        try {
            await api.post('/email/campanias', formData);
        } catch (error) {
            feedback.error(mensajeDeError(error, 'No se pudo crear la campaña. Revisá que el archivo tenga la columna mail.'));
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
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Formato del archivo</Typography>
                    <Typography variant="body2" component="div">
                        Texto separado por tabulaciones, con una fila de encabezados. La columna <Box component="code" sx={code}>mail</Box> es
                        obligatoria. Si trae <Box component="code" sx={code}>id_contacto</Box>, la campaña se vincula con el deudor. Las demás columnas quedan
                        como variables que la plantilla puede usar. Las filas sin mail se descartan.
                    </Typography>
                </Box>
            )}
        />
    );
}
