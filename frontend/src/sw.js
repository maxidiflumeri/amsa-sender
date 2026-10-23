/* eslint-env serviceworker */
/// <reference lib="webworker" />
// Service worker de AMSA Sender (vite-plugin-pwa, estrategia injectManifest).
// Solo precachea el shell de la app (assets con hash). No intercepta ni cachea /api ni socket.io:
// las únicas rutas registradas son el precache y la navegación a index.html.
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

self.__WB_DISABLE_DEV_LOGS = true;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Navegaciones (SPA) -> index.html del precache, menos la API y socket.io.
// Las rutas públicas /mailing/* son pantallas de la propia SPA, así que van por el shell igual.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api(\/|$)/, /^\/socket\.io(\/|$)/],
  }),
);

clientsClaim();

// registerType 'prompt': la versión nueva espera hasta que el usuario elige actualizar.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// El paso desde el Sender anterior (v1, `autoUpdate`): sus páginas no tienen el aviso de "Hay una versión nueva", así
// que con 'prompt' el v2 quedaría esperando hasta que se cierren todas las pestañas y la app instalada (F5 no alcanza).
// Si el que está activo no es un SW de v2 (no dejó su marca), este se activa solo; las páginas del v1 recargan solas al
// cambiar de controlador (eso hace su `registerSW` en modo autoUpdate). Desde ahí, cada versión nueva se anuncia.
const MARCA_V2 = 'sender-v2-marca';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.has(MARCA_V2).then((yaEraV2) => (yaEraV2 ? undefined : self.skipWaiting())).catch(() => undefined),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.open(MARCA_V2).catch(() => undefined));
});

const ICONO = '/icon-192.png';
const BADGE = '/badge-96.png';

/** Normaliza una URL a "ruta + conversación" para saber si dos URLs apuntan a lo mismo. */
function claveDeUrl(href) {
  try {
    const u = new URL(href, self.location.origin);
    return `${u.pathname}|${u.searchParams.get('c') || ''}`;
  } catch {
    return '';
  }
}

/** Parsea el payload del push; si no es JSON usa el texto como cuerpo. */
function leerPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { cuerpo: event.data.text() };
  }
}

async function actualizarBadge(badgeCount) {
  if (typeof badgeCount !== 'number' || !self.navigator) return;
  try {
    if (badgeCount > 0 && self.navigator.setAppBadge) await self.navigator.setAppBadge(badgeCount);
    else if (badgeCount <= 0 && self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
  } catch {
    /* el badge es opcional */
  }
}

async function atenderPush(event) {
  const payload = leerPayload(event);
  const url = payload.url || '/';
  const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  // Si el usuario ya está mirando esa misma conversación no hace falta molestarlo: solo se avisa a la página.
  const mirando = ventanas.find(
    (c) => c.visibilityState === 'visible' && c.focused && claveDeUrl(c.url) === claveDeUrl(url),
  );
  if (mirando) {
    mirando.postMessage({ type: 'push-recibido', payload });
    await actualizarBadge(payload.badgeCount);
    return;
  }

  await self.registration.showNotification(payload.titulo || 'AMSA Sender', {
    body: payload.cuerpo || '',
    icon: ICONO,
    badge: BADGE,
    tag: payload.tag || undefined, // misma conversación = una sola notificación que se actualiza
    renotify: Boolean(payload.tag),
    lang: 'es-AR',
    data: { url },
  });
  await actualizarBadge(payload.badgeCount);
}

self.addEventListener('push', (event) => {
  event.waitUntil(atenderPush(event));
});

async function atenderClick(event) {
  const destino = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
  const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const propia = ventanas.find((c) => new URL(c.url).origin === self.location.origin);

  if (propia) {
    const yaEnDestino = claveDeUrl(propia.url) === claveDeUrl(destino.href);
    const enfocada = await propia.focus();
    if (!yaEnDestino && enfocada && enfocada.navigate) await enfocada.navigate(destino.href);
    return;
  }
  await self.clients.openWindow(destino.href);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(atenderClick(event));
});
