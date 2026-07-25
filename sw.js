const CACHE_NAME = 'encastre-v4';

// Librerías pesadas que solo hace falta bajar una vez (no cambian nunca)
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.24.7/babel.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(LIBS))
      .then(() => self.skipWaiting())
  );
});

// Al activar, borra caches viejos para no servir versiones obsoletas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  const req = event.request;

  // NUNCA tocar llamadas a Supabase: siempre frescas
  if (url.includes('supabase.co') || url.includes('supabase.com')) {
    return;
  }

  // Librerías: CACHE PRIMERO (rapido, no cambian)
  if (LIBS.includes(url)) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return resp;
        });
      })
    );
    return;
  }

  // Todo lo demas (index.html, iconos, etc.): RED PRIMERO.
  // Siempre busca la ultima version; usa cache solo si no hay internet.
  event.respondWith(
    fetch(req)
      .then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return resp;
      })
      .catch(() => caches.match(req).then(c => c || caches.match('/')))
  );
});

// --- NOTIFICACIONES PUSH ---
self.addEventListener('push', event => {
  let datos = { titulo: 'Encastre', cuerpo: 'Tenes una novedad.' };
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
