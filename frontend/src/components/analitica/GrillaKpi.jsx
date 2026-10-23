import { Box } from '@mui/material';
import { KpiTile } from '../ui';

/**
 * Una grilla de KpiTile: 2 por fila en el celular, 3 desde `sm` y hasta `max` desde `lg`.
 * `items`: `{ titulo, valor, unidad?, leyenda?, tonoLeyenda? }`. Sin Grid de MUI 7 (ignora `item`/`xs`).
 */
export default function GrillaKpi({ items, max = 4, cargando = false }) {
    return (
        <Box
            sx={{
                display: 'grid',
                gap: { xs: 1, sm: 1.5 },
                gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    sm: 'repeat(3, minmax(0, 1fr))',
                    lg: `repeat(${max}, minmax(0, 1fr))`,
                },
            }}
        >
            {items.map((k) => (
                <KpiTile key={k.titulo} cargando={cargando} {...k} />
            ))}
        </Box>
    );
}
