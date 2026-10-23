import { useEffect, useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import { WifiOff } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

/**
 * Solo aparece cuando se cortó el tiempo real (el socket). Espera unos segundos antes de mostrarse: un corte breve
 * (cambiar de red, volver de segundo plano) se resuelve solo y no tiene que asustar.
 */
export default function ConexionIndicador() {
    const { socket, conectado } = useSocket();
    const [mostrar, setMostrar] = useState(false);

    useEffect(() => {
        if (!socket || conectado) {
            setMostrar(false);
            return undefined;
        }
        const t = setTimeout(() => setMostrar(true), 5000);
        return () => clearTimeout(t);
    }, [socket, conectado]);

    if (!mostrar) return null;
    return (
        <Tooltip title="Sin tiempo real: los mensajes y el avance de las campañas no se actualizan solos. Reintentando…">
            <Box
                role="status"
                aria-label="Sin conexión en tiempo real, reintentando"
                tabIndex={0}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, color: 'warning.main', flex: 'none' }}
            >
                <WifiOff size={20} strokeWidth={1.75} aria-hidden />
            </Box>
        </Tooltip>
    );
}
