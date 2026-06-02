// ─────────────────────────────────────────────────────────────────────────────
// sw.js — Service Worker para MiApp (Tareas & Notas)
// Estrategia: Cache-First para recursos estáticos, Network-First para el resto
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME    = 'miapp-v1';
const CACHE_VERSION = 1;

// Recursos que se guardan en caché al instalar el SW
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Google Fonts (se cachean en la primera visita con conexión)
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap'
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
// Se ejecuta una sola vez al registrar el SW por primera vez.
// Abre el caché y pre-guarda todos los recursos críticos.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(
        PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' }))
      );
    }).then(() => self.skipWaiting()) // Activa el nuevo SW inmediatamente
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
// Se ejecuta al activarse. Elimina cachés antiguas de versiones anteriores.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim()) // Toma control de todas las pestañas abiertas
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
// Intercepta todas las peticiones de red.
self.addEventListener('fetch', event => {
  // Solo manejamos peticiones GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Estrategia: Cache-First con fallback a red
  // Ideal para una app que necesita funcionar offline.
  event.respondWith(cacheFirst(event.request));
});

// ── Estrategia Cache-First ────────────────────────────────────────────────────
// 1. Busca en el caché → si existe, devuelve el recurso cacheado.
// 2. Si no está en caché → va a la red, guarda la respuesta y la devuelve.
// 3. Si la red falla y tampoco hay caché → devuelve página de fallback.
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    // Solo cachear respuestas válidas (status 200, tipo básico u opaco)
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // Sin red y sin caché → devolver página principal como fallback
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    // Último recurso: respuesta de error
    return new Response('<h1>Sin conexión</h1><p>La app no está disponible offline todavía.</p>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

// ── MENSAJE: skipWaiting manual ───────────────────────────────────────────────
// Permite forzar actualización desde el cliente si se necesita.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
