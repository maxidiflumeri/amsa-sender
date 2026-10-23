import { Box } from '@mui/material';

/** El ancho máximo de una pantalla de contenido. `angosto` para formularios y configuración. */
export default function PageContainer({ children, angosto = false, sx }) {
    return <Box sx={{ width: '100%', maxWidth: angosto ? 960 : 1440, mx: 'auto', ...sx }}>{children}</Box>;
}
