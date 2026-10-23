#!/usr/bin/env node
// Chequea las reglas de docs/sender-v2-guia-ui.md que se pueden ver en el código: colores escritos a mano, anchos
// fijos grandes, el breakpoint propio de 768 px, console.log, íconos que no son de Lucide, degradados y emojis.
// Uso: `npm run verificar-ui` (sale con código 1 si encuentra algo). No reemplaza mirar la pantalla a 360 px.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('../src', import.meta.url).pathname;

// Donde los colores escritos a mano son legítimos: el tema, el logo (colores de marca), el service worker y la vista
// previa de un email (el mail se ve sobre blanco, como en el cliente de correo, también en oscuro) y el QR de Conectar
// (blanco y negro siempre: los lectores necesitan el contraste).
const COLORES_PERMITIDOS = ['theme/', 'components/layout/LogoSender.jsx', 'sw.js', 'components/ui/VistaPreviaEmail.jsx', 'components/ConectarSesion.jsx'];
// Archivos de desarrollo que no ve nadie más.
const IGNORADOS = ['components/dev/'];

const REGLAS = [
    { id: 'color-a-mano', re: /['"`]#[0-9a-fA-F]{3,8}['"`]|['"`](?:green|red|gray|grey|orange)['"`]/g, salvo: COLORES_PERMITIDOS, msg: 'color escrito a mano: usá theme.palette' },
    { id: 'degradado', re: /linear-gradient|radial-gradient/g, salvo: [], msg: 'degradado: la familia no los usa' },
    { id: 'breakpoint-768', re: /max-width:\s*768px/g, salvo: [], msg: 'breakpoint propio: usá theme.breakpoints' },
    { id: 'console', re: /console\.(log|error|warn|info|debug)\(/g, salvo: ['sw.js'], msg: 'console.*: mostrá el error con useFeedback' },
    { id: 'icono-mui', re: /from ['"]@mui\/icons-material/g, salvo: [], msg: 'ícono de MUI: usá lucide-react' },
    { id: 'react-icons', re: /from ['"]react-icons/g, salvo: [], msg: 'react-icons: usá lucide-react' },
    { id: 'helvetica', re: /Helvetica/g, salvo: ['theme/'], msg: 'Helvetica: la letra es Inter (del tema)' },
    { id: 'ancho-fijo', re: /(?:minWidth|width)\s*:\s*(\d{3,})(?![\d%])/g, salvo: [], msg: 'ancho fijo mayor a 280 px: en 360 px desborda', filtro: (m) => Number(m[1]) > 280 },
    // El análisis de IA llega con un emoji al comienzo de cada sección: se usa para cortarlas, no como ícono.
    { id: 'emoji', re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, salvo: ['components/wapi/analitica/PanelAnalisisIA.jsx'], msg: 'emoji como ícono: usá lucide-react' },
    { id: 'grid-legacy', re: /<Grid\b[^>]*\s(?:item|xs=|sm=|md=|lg=)/g, salvo: [], msg: 'Grid legacy: MUI 7 ignora item/xs/md; usá size={{…}} o grilla CSS' },
];

function archivos(dir) {
    return readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? archivos(p) : /\.(jsx?|mjs)$/.test(n) ? [p] : [];
    });
}

let total = 0;
for (const archivo of archivos(RAIZ)) {
    const rel = relative(RAIZ, archivo);
    if (IGNORADOS.some((i) => rel.startsWith(i))) continue;
    const lineas = readFileSync(archivo, 'utf8').split('\n');
    lineas.forEach((linea, i) => {
        if (/^\s*(\/\/|\*)/.test(linea)) return;
        for (const r of REGLAS) {
            if (r.salvo.some((s) => rel.startsWith(s) || rel === s)) continue;
            for (const m of linea.matchAll(r.re)) {
                if (r.filtro && !r.filtro(m)) continue;
                // Un ancho fijo dentro de un objeto por breakpoint ({ xs: …, md: 600 }) está bien.
                if (r.id === 'ancho-fijo' && /\{\s*xs\s*:/.test(linea)) continue;
                total++;
                console.log(`${rel}:${i + 1}  [${r.id}] ${r.msg}`);
            }
        }
    });
}

console.log(total === 0 ? 'Sin hallazgos.' : `\n${total} hallazgos.`);
process.exit(total === 0 ? 0 : 1);
