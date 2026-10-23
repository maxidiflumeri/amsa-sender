import { createTheme } from '@mui/material/styles';
import { esES } from '@mui/material/locale';
import { getPalette } from './tokens';
import { typography } from './typography';
import { buildShadows } from './shadows';
import { buildComponents } from './components';

/**
 * El tema de Sender: el de AMSA Gestión con el acento verde. Es el único tema de la app (antes había dos: el de
 * `theme.js` quedaba tapado por el que armaba `App.jsx`).
 * @param {'light'|'dark'} mode
 */
export function buildTheme(mode) {
    return createTheme(
        {
            palette: {
                mode,
                ...getPalette(mode),
            },
            typography,
            shape: {
                borderRadius: 10,
            },
            spacing: 8,
            shadows: buildShadows(mode),
            components: buildComponents(mode),
            breakpoints: {
                values: {
                    xs: 0,
                    sm: 600,
                    md: 900,
                    lg: 1200,
                    xl: 1536,
                },
            },
        },
        esES,
    );
}

export { getPalette, VERDE_MARCA } from './tokens';
