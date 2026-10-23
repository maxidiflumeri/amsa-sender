import { useState } from 'react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { MoreVertical } from 'lucide-react';

/**
 * El menú "Más" de una fila o tarjeta: las acciones secundarias con texto, en vez de íconos sueltos que solo se
 * entienden con hover. La principal va aparte, como botón.
 *
 * @param {object} props
 * @param {{label: string, icono?: import('lucide-react').LucideIcon, onClick: () => void, peligro?: boolean,
 *   deshabilitado?: boolean}[]} props.items
 * @param {string} [props.etiqueta] Para lectores de pantalla.
 */
export default function MenuMas({ items, etiqueta = 'Más acciones' }) {
    const [ancla, setAncla] = useState(null);
    const cerrar = () => setAncla(null);

    return (
        <>
            <IconButton aria-label={etiqueta} aria-haspopup="menu" onClick={(e) => setAncla(e.currentTarget)} sx={{ width: 44, height: 44 }}>
                <MoreVertical size={20} strokeWidth={1.75} aria-hidden />
            </IconButton>
            <Menu anchorEl={ancla} open={!!ancla} onClose={cerrar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                {items.map(({ label, icono: Icono, onClick, peligro, deshabilitado }) => (
                    <MenuItem
                        key={label}
                        disabled={deshabilitado}
                        onClick={() => {
                            cerrar();
                            onClick();
                        }}
                        sx={{ minHeight: 44, color: peligro ? 'error.main' : undefined }}
                    >
                        {Icono && (
                            <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                                <Icono size={18} strokeWidth={1.75} aria-hidden />
                            </ListItemIcon>
                        )}
                        <ListItemText primary={label} />
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}
