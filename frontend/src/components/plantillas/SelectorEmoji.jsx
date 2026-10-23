import { useState } from 'react';
import { IconButton, Popover, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Smile } from 'lucide-react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

/**
 * Botón que abre el selector de emojis. El popover mide lo que entra en la pantalla: antes tenía 360 px fijos y en un
 * celular de 360 se salía de los costados.
 *
 * @param {object} props
 * @param {(emoji: string) => void} props.onSelect
 */
export default function SelectorEmoji({ onSelect }) {
    const theme = useTheme();
    const angosto = useMediaQuery(theme.breakpoints.down('sm'));
    const [ancla, setAncla] = useState(null);

    return (
        <>
            <IconButton aria-label="Insertar emoji" color="primary" onClick={(e) => setAncla(e.currentTarget)} sx={{ width: 44, height: 44 }}>
                <Smile size={20} strokeWidth={1.75} aria-hidden />
            </IconButton>
            <Popover
                open={Boolean(ancla)}
                anchorEl={ancla}
                onClose={() => setAncla(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{ paper: { sx: { maxWidth: 'calc(100vw - 16px)', maxHeight: '80dvh', overflow: 'auto' } } }}
            >
                <Picker
                    data={data}
                    locale="es"
                    perLine={angosto ? 7 : 9}
                    onEmojiSelect={(e) => {
                        onSelect(e.native);
                        setAncla(null);
                    }}
                    theme={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                    previewPosition="none"
                />
            </Popover>
        </>
    );
}
