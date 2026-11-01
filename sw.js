/* Service worker: guarda la aplicación en el teléfono para que abra SIN internet.
   Si cambias algún archivo del sistema, sube el número de CACHE para que se actualice. */
const CACHE = 'bodega-inv-v1';
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest',
  './css/styles.css', './css/impresion.css',
  './js/utils.js', './js/storage.js', './js/reportes.js', './js/inicio.js', './js/inventario.js',
  './js/historial.js', './js/ajustes.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).catch(() => (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
    })
  );
});
