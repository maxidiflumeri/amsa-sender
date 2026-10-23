import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';

/**
 * Colores y estilos de recharts sacados del tema, para que los gráficos cambien con el claro/oscuro y no haya
 * hexadecimales sueltos. `series` es el orden en que se reparten los colores cuando no hay un significado fijo
 * (estado, tipo de evento): para eso usá los nombrados.
 */
export function useGraficos() {
    const theme = useTheme();
    const p = theme.palette;
    return useMemo(
        () => ({
            primary: p.primary.main,
            info: p.info.main,
            success: p.success.main,
            warning: p.warning.main,
            error: p.error.main,
            ia: p.ia?.main ?? p.secondary.main,
            neutro: p.text.disabled,
            series: [p.primary.main, p.info.main, p.warning.main, p.success.main, p.error.main],
            grilla: p.divider,
            texto: p.text.secondary,
            // Ejes en `text.secondary`, 12 px (la letra mínima en el celular).
            eje: { tick: { fontSize: 12, fill: p.text.secondary }, stroke: p.divider, tickLine: false },
            tooltip: {
                contentStyle: {
                    background: p.background.paper,
                    border: `1px solid ${p.divider}`,
                    borderRadius: 10,
                    color: p.text.primary,
                    fontSize: 13,
                },
                labelStyle: { color: p.text.secondary, fontWeight: 600 },
                itemStyle: { color: p.text.primary },
                cursor: { fill: p.action.hover },
            },
        }),
        [p],
    );
}
