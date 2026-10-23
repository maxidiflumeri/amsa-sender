import { useState } from 'react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { MoreVertical } from 'lucide-react';

/**
 * El menú "Más" de una fila o tarjeta: las acciones secundarias van acá, con texto, y la principal queda afuera como
 * botón. Nada que dependa de hover. Cada ítem: `{ label, icon, onClick, peligro, oculto, deshabilitado }`.
 */
export default function MenuMas({ items, etiqueta = 'Más acciones' }) {
    const [ancla, setAncla] = useState(null);
    const visibles = items.filter((i) => !i.oculto);
    if (visibles.length === 0) return null;

    return (
        <>
            <Tooltip title={etiqueta}>
                <IconButton
                    aria-label={etiqueta}
                    aria-haspopup="menu"
                    onClick={(e) => setAncla(e.currentTarget)}
                    sx={{ width: { xs: 44, md: 36 }, height: { xs: 44, md: 36 } }}
                >
                    <MoreVertical size={18} strokeWidth={1.75} aria-hidden />
                </IconButton>
            </Tooltip>
            <Menu anchorEl={ancla} open={!!ancla} onClose={() => setAncla(null)}>
                {visibles.map((it) => {
                    const Icono = it.icon;
                    return (
                        <MenuItem
                            key={it.label}
                            disabled={it.deshabilitado}
                            onClick={() => {
                                setAncla(null);
                                it.onClick();
                            }}
                            sx={{ minHeight: 44, color: it.peligro ? 'error.main' : undefined }}
                        >
                            {Icono && (
                                <ListItemIcon sx={{ color: 'inherit' }}>
                                    <Icono size={18} strokeWidth={1.75} aria-hidden />
                                </ListItemIcon>
                            )}
                            <ListItemText>{it.label}</ListItemText>
                        </MenuItem>
                    );
                })}
            </Menu>
        </>
    );
}
