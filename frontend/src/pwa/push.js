import api from '../api/axios';

/** Mensajes de error que ve el usuario. */
export const ERROR_SIN_CONFIGURAR = 'Las notificaciones no están configuradas en el servidor';

/** @returns {boolean} true si el navegador sabe de service workers, push y notificaciones. */
export function pushSoportado() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** @returns {'default'|'granted'|'denied'|'no-soportado'} */
export function permisoActual() {
  return pushSoportado() ? Notification.permission : 'no-soportado';
}

/** Convierte la clave VAPID (base64url) al Uint8Array que pide pushManager.subscribe. */
export function claveAUint8(base64Url) {
  const relleno = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = atob(base64);
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
}

/** @returns {Promise<PushSubscription|null>} la suscripción del navegador, si existe. */
export async function suscripcionActual() {
  if (!pushSoportado()) return null;
  const registro = await navigator.serviceWorker.ready;
  return registro.pushManager.getSubscription();
}

/**
 * Da de baja la suscripción solo en el navegador, sin pedido al backend: es para cuando la sesión se perdió (token
 * vencido, 401) y ya no hay token para el DELETE. Sin esto, en un puesto compartido seguían apareciendo en la pantalla
 * bloqueada los mensajes de quien se fue. El backend borra la fila sola cuando el próximo envío le da 410.
 * Nunca tira y espera como máximo 2 s.
 */
export async function bajaPushSoloNavegador() {
  try {
    const baja = (async () => {
      const sub = await suscripcionActual();
      if (sub) await sub.unsubscribe();
    })();
    await Promise.race([baja, new Promise((r) => setTimeout(r, 2000))]);
  } catch {
    /* sin push o sin service worker: nada que dar de baja */
  }
}

/** Manda (o re-manda) la suscripción al backend, asociada al usuario del token. */
export async function enviarSuscripcion(sub) {
  const { endpoint, keys } = sub.toJSON();
  await api.post('/push/suscripciones', { endpoint, keys });
}

/** Borra la suscripción en el backend (solo la del usuario del token). */
export async function borrarSuscripcionEnServidor(endpoint) {
  await api.delete('/push/suscripciones', { data: { endpoint } });
}

/** Evento que avisa al provider que la suscripción cambió fuera de él (p. ej. al cerrar sesión). */
export const EVENTO_PUSH_CAMBIO = 'amsa:push-cambio';
