import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Snackbar } from '@mui/material';
import { registerSW } from 'virtual:pwa-register';
import api from '../api/axios';
import {
  ERROR_SIN_CONFIGURAR,
  EVENTO_PUSH_CAMBIO,
  borrarSuscripcionEnServidor,
  claveAUint8,
  enviarSuscripcion,
  permisoActual,
  pushSoportado,
  suscripcionActual,
} from './push';

const CLAVE_INSTALAR = 'pwaInstalarDescartadoHasta';
const CATORCE_DIAS_MS = 14 * 24 * 60 * 60 * 1000;
const CADA_UNA_HORA_MS = 60 * 60 * 1000;

/**
 * @typedef {Object} PwaPush
 * @property {boolean} soportado
 * @property {'default'|'granted'|'denied'|'no-soportado'} permiso
 * @property {boolean} suscripto
 * @property {boolean} cargando
 * @property {string|null} error
 * @property {() => Promise<boolean>} activar Pide el permiso y suscribe: llamarla solo desde un gesto del usuario.
 * @property {() => Promise<void>} desactivar
 * @property {() => Promise<void>} sincronizar Re-envía la suscripción del navegador al backend (llamarla después de iniciar sesión).
 */

/**
 * @typedef {Object} PwaEstado
 * @property {boolean} hayVersionNueva
 * @property {() => void} actualizar
 * @property {() => void} descartarVersionNueva
 * @property {boolean} puedeInstalar
 * @property {() => Promise<'aceptada'|'rechazada'|'no-disponible'>} instalar
 * @property {() => void} descartarInstalar Oculta la invitación por 14 días.
 * @property {boolean} esIos
 * @property {boolean} esStandalone
 * @property {boolean} enLinea
 * @property {PwaPush} push
 */

function leerDescartado() {
  try {
    const hasta = Number(localStorage.getItem(CLAVE_INSTALAR));
    return Number.isFinite(hasta) && hasta > Date.now();
  } catch {
    return false;
  }
}

function detectarIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ se presenta como Mac: se distingue por la pantalla táctil.
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function detectarStandalone() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone);
}

function mismosBytes(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const SIN_PWA = /** @type {PwaEstado} */ ({
  hayVersionNueva: false,
  actualizar: () => {},
  descartarVersionNueva: () => {},
  puedeInstalar: false,
  instalar: async () => 'no-disponible',
  descartarInstalar: () => {},
  esIos: false,
  esStandalone: false,
  enLinea: true,
  push: {
    soportado: false,
    permiso: 'no-soportado',
    suscripto: false,
    cargando: false,
    error: null,
    activar: async () => false,
    desactivar: async () => {},
    sincronizar: async () => {},
  },
});

const PwaContext = createContext(SIN_PWA);

/**
 * Registra el service worker (con aviso de versión nueva, sin recarga automática), maneja la instalación
 * como app y la suscripción a notificaciones push. Montalo una sola vez, arriba de la app.
 */
export function PwaProvider({ children }) {
  const [hayVersionNueva, setHayVersionNueva] = useState(false);
  const [eventoInstalar, setEventoInstalar] = useState(null);
  const [instalarDescartado, setInstalarDescartado] = useState(leerDescartado);
  const [esStandalone, setEsStandalone] = useState(detectarStandalone);
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [permiso, setPermiso] = useState(permisoActual);
  const [suscripto, setSuscripto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const actualizarSwRef = useRef(null);
  const esIos = useMemo(detectarIos, []);
  const soportado = useMemo(pushSoportado, []);

  // Registro del service worker + chequeo periódico de versiones nuevas
  useEffect(() => {
    let registro = null;
    actualizarSwRef.current = registerSW({
      immediate: true,
      onNeedRefresh: () => setHayVersionNueva(true),
      onRegisteredSW: (_url, reg) => {
        registro = reg ?? null;
      },
    });

    const buscarActualizacion = () => {
      if (registro && navigator.onLine) registro.update().catch(() => {});
    };
    const intervalo = setInterval(buscarActualizacion, CADA_UNA_HORA_MS);
    const alVolver = () => {
      if (document.visibilityState === 'visible') buscarActualizacion();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  // Instalación y conectividad
  useEffect(() => {
    const alPedirInstalar = (e) => {
      e.preventDefault();
      setEventoInstalar(e);
    };
    const alInstalar = () => {
      setEventoInstalar(null);
      setEsStandalone(true);
    };
    const alConectar = () => setEnLinea(true);
    const alDesconectar = () => setEnLinea(false);
    const mq = window.matchMedia?.('(display-mode: standalone)');
    const alCambiarModo = () => setEsStandalone(detectarStandalone());

    window.addEventListener('beforeinstallprompt', alPedirInstalar);
    window.addEventListener('appinstalled', alInstalar);
    window.addEventListener('online', alConectar);
    window.addEventListener('offline', alDesconectar);
    mq?.addEventListener?.('change', alCambiarModo);
    return () => {
      window.removeEventListener('beforeinstallprompt', alPedirInstalar);
      window.removeEventListener('appinstalled', alInstalar);
      window.removeEventListener('online', alConectar);
      window.removeEventListener('offline', alDesconectar);
      mq?.removeEventListener?.('change', alCambiarModo);
    };
  }, []);

  /** Lee el estado real del navegador y, si hay sesión, re-sincroniza la suscripción con el backend. */
  const sincronizar = useCallback(async () => {
    if (!soportado) return;
    setPermiso(permisoActual());
    try {
      const sub = await suscripcionActual();
      setSuscripto(Boolean(sub));
      if (sub && Notification.permission === 'granted' && localStorage.getItem('token')) {
        await enviarSuscripcion(sub);
      }
    } catch {
      /* sin red o sin sesión: se reintenta en la próxima carga */
    }
  }, [soportado]);

  useEffect(() => {
    sincronizar();
    const alCambiar = () => sincronizar();
    window.addEventListener(EVENTO_PUSH_CAMBIO, alCambiar);
    return () => window.removeEventListener(EVENTO_PUSH_CAMBIO, alCambiar);
  }, [sincronizar]);

  const actualizar = useCallback(() => {
    // Activa el SW en espera y recarga la página
    actualizarSwRef.current?.(true);
  }, []);

  const descartarVersionNueva = useCallback(() => setHayVersionNueva(false), []);

  const instalar = useCallback(async () => {
    if (!eventoInstalar) return 'no-disponible';
    eventoInstalar.prompt();
    const { outcome } = await eventoInstalar.userChoice;
    setEventoInstalar(null);
    return outcome === 'accepted' ? 'aceptada' : 'rechazada';
  }, [eventoInstalar]);

  const descartarInstalar = useCallback(() => {
    try {
      localStorage.setItem(CLAVE_INSTALAR, String(Date.now() + CATORCE_DIAS_MS));
    } catch {
      /* sin localStorage: se oculta solo en esta sesión */
    }
    setInstalarDescartado(true);
  }, []);

  const activar = useCallback(async () => {
    if (!soportado) {
      setError('Este navegador no permite notificaciones.');
      return false;
    }
    setCargando(true);
    setError(null);
    try {
      const resultado = await Notification.requestPermission();
      setPermiso(resultado);
      if (resultado !== 'granted') {
        setError(
          resultado === 'denied'
            ? 'Bloqueaste las notificaciones. Habilitalas desde los permisos del sitio en tu navegador.'
            : 'No se activaron las notificaciones.',
        );
        return false;
      }

      let clave;
      try {
        const { data } = await api.get('/push/clave-publica');
        clave = data.clave;
      } catch (e) {
        setError(
          e?.response?.status === 503
            ? ERROR_SIN_CONFIGURAR
            : 'No pudimos activar las notificaciones. Probá de nuevo en un rato.',
        );
        return false;
      }

      const registro = await navigator.serviceWorker.ready;
      const opciones = { userVisibleOnly: true, applicationServerKey: claveAUint8(clave) };
      let sub = await registro.pushManager.getSubscription();
      // Si cambiaron las claves VAPID del servidor, la suscripción vieja ya no sirve: se rehace
      const claveVieja = sub?.options?.applicationServerKey;
      if (sub && claveVieja && !mismosBytes(new Uint8Array(claveVieja), opciones.applicationServerKey)) {
        await sub.unsubscribe();
        sub = null;
      }
      if (!sub) {
        sub = await registro.pushManager.subscribe(opciones);
      }
      try {
        await enviarSuscripcion(sub);
      } catch (e) {
        // Si el backend no la guardó, la suscripción del navegador quedaría huérfana
        await sub.unsubscribe().catch(() => {});
        setSuscripto(false);
        setError('No pudimos activar las notificaciones. Probá de nuevo en un rato.');
        return false;
      }
      setSuscripto(true);
      return true;
    } catch (e) {
      // Una suscripción vieja con otra clave VAPID hace fallar subscribe(): se limpia para el próximo intento
      try {
        const sub = await suscripcionActual();
        if (e?.name === 'InvalidStateError' && sub) await sub.unsubscribe();
      } catch {
        /* nada más que hacer */
      }
      setError('No pudimos activar las notificaciones. Probá de nuevo en un rato.');
      return false;
    } finally {
      setCargando(false);
    }
  }, [soportado]);

  const desactivar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const sub = await suscripcionActual();
      if (sub) {
        await borrarSuscripcionEnServidor(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      setSuscripto(false);
    } catch {
      setError('No pudimos desactivar las notificaciones. Probá de nuevo.');
    } finally {
      setCargando(false);
    }
  }, []);

  const valor = useMemo(
    () => ({
      hayVersionNueva,
      actualizar,
      descartarVersionNueva,
      puedeInstalar: Boolean(eventoInstalar) && !instalarDescartado && !esStandalone,
      instalar,
      descartarInstalar,
      esIos,
      esStandalone,
      enLinea,
      push: { soportado, permiso, suscripto, cargando, error, activar, desactivar, sincronizar },
    }),
    [
      hayVersionNueva,
      actualizar,
      descartarVersionNueva,
      eventoInstalar,
      instalarDescartado,
      esStandalone,
      instalar,
      descartarInstalar,
      esIos,
      enLinea,
      soportado,
      permiso,
      suscripto,
      cargando,
      error,
      activar,
      desactivar,
      sincronizar,
    ],
  );

  return <PwaContext.Provider value={valor}>{children}</PwaContext.Provider>;
}

/**
 * Estado de la PWA: versión nueva, instalación, conexión y notificaciones push.
 * @returns {PwaEstado}
 */
export function usePwa() {
  return useContext(PwaContext);
}

/**
 * Aviso de versión nueva. Abajo, por encima de la barra inferior del celular.
 * Ponelo una vez dentro del layout.
 */
export function AvisoVersionNueva() {
  const { hayVersionNueva, actualizar, descartarVersionNueva } = usePwa();
  return (
    <Snackbar
      open={hayVersionNueva}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: { xs: 'calc(72px + env(safe-area-inset-bottom))', md: '24px' } }}
    >
      <Alert
        severity="info"
        variant="filled"
        sx={{ alignItems: 'center', width: '100%' }}
        action={
          <>
            <Button color="inherit" size="small" onClick={descartarVersionNueva} sx={{ minHeight: 36 }}>
              Más tarde
            </Button>
            <Button color="inherit" size="small" onClick={actualizar} sx={{ minHeight: 36, fontWeight: 700 }}>
              Actualizar
            </Button>
          </>
        }
      >
        Hay una versión nueva de Sender
      </Alert>
    </Snackbar>
  );
}

/** Barra fina arriba de todo cuando el navegador está sin conexión. */
export function AvisoSinConexion() {
  const { enLinea } = usePwa();
  if (enLinea) return null;
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={(theme) => ({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.tooltip + 1,
        pt: 'env(safe-area-inset-top)',
        bgcolor: 'warning.main',
        color: 'warning.contrastText',
        textAlign: 'center',
        typography: 'caption',
        fontWeight: 600,
        lineHeight: '24px',
      })}
    >
      Sin conexión. Reintentando…
    </Box>
  );
}

/**
 * Borra la suscripción push de este navegador (en el backend y en el navegador).
 * Llamala antes de borrar el token al cerrar sesión. Nunca tira y no demora más de 3 s.
 * @returns {Promise<void>}
 */
export async function desuscribirPushAlCerrarSesion() {
  if (!pushSoportado()) return;
  const tarea = (async () => {
    const sub = await suscripcionActual();
    if (!sub) return;
    await borrarSuscripcionEnServidor(sub.endpoint).catch(() => {});
    await sub.unsubscribe().catch(() => {});
    window.dispatchEvent(new Event(EVENTO_PUSH_CAMBIO));
  })();
  await Promise.race([tarea.catch(() => {}), new Promise((resolver) => setTimeout(resolver, 3000))]);
}
