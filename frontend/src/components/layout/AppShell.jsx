import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useCampaniasEnCurso from '../../hooks/useCampaniasEnCurso';
import { AvisoSinConexion, AvisoVersionNueva } from '../../pwa';
import AppBar from './AppBar';
import BarraInferior, { pestaniasDe } from './BarraInferior';
import { vuelveArriba } from './navConfig';
import { ShellProvider, useShell } from './ShellContext';
import SideNav from './SideNav';

const CLAVE_ACHICADO = 'senderMenuAchicado';

function leerAchicado() {
    try {
        return localStorage.getItem(CLAVE_ACHICADO) === '1';
    } catch {
        return false;
    }
}

/** El alto de la barra de arriba, con la zona segura. */
const ALTO_BARRA = { xs: 'calc(56px + env(safe-area-inset-top))', sm: 'calc(64px + env(safe-area-inset-top))' };
/** El alto de la barra de abajo del celular, con la zona segura. */
const ALTO_BARRA_INFERIOR = 'calc(66px + env(safe-area-inset-bottom))';

function Marco() {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(leerAchicado);
    const { pathname } = useLocation();
    const panelRef = useRef(null);
    const { pantallaCompleta, barraInferiorOculta, hayBarraInferior } = useShell();
    const { wapi } = useCampaniasEnCurso();
    const campaniasEnCurso = wapi.some((c) => c.estado === 'procesando');
    const conBarraInferior = !isDesktop && hayBarraInferior && !barraInferiorOculta;

    useEffect(() => {
        try {
            localStorage.setItem(CLAVE_ACHICADO, collapsed ? '1' : '0');
        } catch {
            /* sin localStorage */
        }
    }, [collapsed]);

    // Una pantalla completa en el celular (un chat) mide lo que se ve de verdad. En iOS el teclado no achica el alto de
    // la página (`100dvh` sigue igual) sino el área visible, y el navegador desplaza todo para mostrar el campo: el
    // encabezado del chat, con el botón de volver, se iba de la pantalla. Chrome de Android lo resuelve con
    // `interactive-widget=resizes-content` en index.html; esto cubre el resto.
    const [altoVisible, setAltoVisible] = useState(null);
    useEffect(() => {
        const vv = window.visualViewport;
        if (isDesktop || !pantallaCompleta || !vv) {
            setAltoVisible(null);
            return undefined;
        }
        const medir = () => {
            setAltoVisible(Math.round(vv.height));
            if (window.scrollY !== 0) window.scrollTo(0, 0);
        };
        medir();
        vv.addEventListener('resize', medir);
        return () => vv.removeEventListener('resize', medir);
    }, [isDesktop, pantallaCompleta]);
    const altoBase = altoVisible ? `${altoVisible}px` : '100dvh';

    // Otra pantalla arranca desde arriba: el panel en la computadora, la página en el celular.
    const rutaAnterior = useRef(pathname);
    useEffect(() => {
        const anterior = rutaAnterior.current;
        rutaAnterior.current = pathname;
        if (!vuelveArriba(anterior, pathname)) return;
        if (panelRef.current) panelRef.current.scrollTop = 0;
        window.scrollTo(0, 0);
    }, [pathname]);

    // Elegida una pantalla desde el marco, el foco pasa al contenido (si no, AvPág y las flechas no mueven nada).
    useEffect(() => {
        const activo = document.activeElement;
        const desdeElMarco = !activo || activo === document.body || !!activo.closest('nav[aria-label="Menú principal"], nav[aria-label="Accesos"], .MuiAppBar-root');
        if (desdeElMarco && panelRef.current) panelRef.current.focus({ preventScroll: true });
    }, [pathname]);

    return (
        <Box
            sx={{
                display: 'flex',
                // Desde `md` se desplaza el panel, no la ventana. Debajo, la página (si no, Chrome y Safari dejan de
                // esconder la barra de direcciones y se pierde el tirar-para-recargar).
                minHeight: { xs: '100dvh', md: 0 },
                height: { md: '100dvh' },
                overflow: { md: 'hidden' },
                bgcolor: 'background.marco',
            }}
        >
            <AvisoSinConexion />
            <AppBar onMenuClick={() => (isDesktop ? setCollapsed((c) => !c) : setMobileOpen((o) => !o))} isDesktop={isDesktop} collapsed={collapsed} />

            <SideNav
                open={isDesktop ? true : mobileOpen}
                onClose={() => setMobileOpen(false)}
                variant={isDesktop ? 'permanent' : 'temporary'}
                collapsed={collapsed}
                campaniasEnCurso={campaniasEnCurso}
            />

            <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ height: ALTO_BARRA, flex: 'none' }} />
                <Box
                    component="main"
                    ref={panelRef}
                    tabIndex={-1}
                    sx={{
                        outline: 'none',
                        flexGrow: 1,
                        minWidth: 0,
                        minHeight: { md: 0 },
                        overflow: { md: pantallaCompleta ? 'hidden' : 'auto' },
                        overscrollBehavior: { md: 'contain' },
                        bgcolor: 'background.default',
                        mr: { md: 1.5 },
                        border: { md: 1 },
                        borderBottom: { md: 0 },
                        borderColor: { md: 'divider' },
                        borderTopLeftRadius: { md: '16px' },
                        borderTopRightRadius: { md: '16px' },
                        pl: 'env(safe-area-inset-left)',
                        pr: 'env(safe-area-inset-right)',
                        ...(pantallaCompleta
                            ? {
                                display: 'flex',
                                flexDirection: 'column',
                                // En el celular, el alto exacto que queda entre las barras: la pantalla maneja su scroll.
                                height: { xs: `calc(${altoBase} - ${ALTO_BARRA.xs}${conBarraInferior ? ` - ${ALTO_BARRA_INFERIOR}` : ''})`, sm: `calc(${altoBase} - ${ALTO_BARRA.sm}${conBarraInferior ? ` - ${ALTO_BARRA_INFERIOR}` : ''})`, md: 'auto' },
                                overflow: 'hidden',
                                mb: conBarraInferior ? ALTO_BARRA_INFERIOR : 0,
                            }
                            : {
                                px: { xs: 2, sm: 3, md: 4 },
                                pt: { xs: 2, sm: 3 },
                                pb: conBarraInferior ? `calc(${ALTO_BARRA_INFERIOR} + 24px)` : { xs: 3, md: 4 },
                            }),
                    }}
                >
                    <Outlet />
                </Box>
            </Box>

            {conBarraInferior && <BarraInferior />}
            <AvisoVersionNueva />
        </Box>
    );
}

/**
 * La estructura de la app, igual a la de AMSA Gestión: la barra de arriba y el menú lateral forman un marco
 * (`background.marco`) y la pantalla va en un panel con las esquinas de arriba redondeadas (desde `md`). En el celular,
 * además, la barra de abajo con los accesos de todos los días.
 */
export default function AppShell() {
    const { hasPermiso } = useAuth();
    const hayBarraInferior = useMemo(() => pestaniasDe(hasPermiso).length >= 2, [hasPermiso]);
    return (
        <ShellProvider hayBarraInferior={hayBarraInferior}>
            <Marco />
        </ShellProvider>
    );
}
