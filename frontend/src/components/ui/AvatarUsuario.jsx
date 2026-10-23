import { useState } from 'react';
import { Avatar } from '@mui/material';

export function iniciales(nombre) {
    const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '?';
    return ((partes[0][0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

/** La foto de Google o, si no hay o no carga, las iniciales sobre el acento. */
export default function AvatarUsuario({ nombre, foto, size = 34, sx }) {
    const [fallo, setFallo] = useState(false);
    const conFoto = foto && !fallo;
    return (
        <Avatar
            src={conFoto ? foto : undefined}
            alt=""
            imgProps={{ referrerPolicy: 'no-referrer', onError: () => setFallo(true) }}
            sx={{
                width: size,
                height: size,
                fontSize: size * 0.38,
                fontWeight: 700,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                ...sx,
            }}
        >
            {conFoto ? null : iniciales(nombre)}
        </Avatar>
    );
}
