const CACHE_NAME = 'encastre-v3';

// Librerías pesadas que solo hace falta bajar una vez
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.24.7/babel.min.js'
];

const urlsToCache = ['/', ...LIBS];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Al activar, borra caches viejos (v1) para que no queden versiones obsoletas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // NUNCA cachear llamadas a Supabase ni a la API de mails: siempre datos frescos
  if (url.includes('supabase.co') || url.includes('supabase.com')) {
    return; // deja pasar la petición normal, sin tocar el cache
  }

  // Las librerías: primero cache, y si no está, se baja y se guarda
  if (LIBS.includes(url)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          return resp;
        });
      })
    );
    return;
  }

  // El resto (index, íconos, etc.): cache primero, con respaldo a red
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).catch(() => caches.match('/'));
    })
  );
});

// ─── NOTIFICACIONES PUSH ────────────────────────────────────────────────
// Llega un aviso desde el servidor: mostrar la notificación
self.addEventListener('push', event => {
  let datos = { titulo: 'Encastre', cuerpo: 'Tenés una novedad.' };
  try {
    if (event.data) datos = { ...datos, ...event.data.json() };
  } catch (e) { /* si no es JSON, se usa el texto por defecto */ }

  event.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: '/logo-192.png',
      badge: '/logo-192.png',
      data: { url: datos.url || '/' },
      vibrate: [100, 50, 100]
    })
  );
});

// El usuario toca la notificación: abrir la app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
      for (const c of lista) {
        if ('focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(destino);
    })
  );
});
