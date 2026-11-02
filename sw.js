/* Service worker: guarda la aplicación en el teléfono para que abra SIN internet.
   Estrategia: primero se pide la versión nueva a internet y, si no hay conexión, se usa la copia guardada.
   Si cambias algún archivo, sube el número de CACHE (opcional: ya se actualiza solo con conexión). */
const PREFIJO = 'bodega-lite-';
const CACHE = PREFIJO + 'v2';
const VIEJOS = ['bodega-inv-v1'];   // nombres de caché de versiones anteriores de esta app
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest', './css/styles.css', './css/impresion.css', './js/utils.js', './js/storage.js', './js/reportes.js', './js/inicio.js', './js/inventario.js', './js/historial.js', './js/ajustes.js', './js/app.js', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(ARCHIVOS.map(u => c.add(new Request(u, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && (k.startsWith(PREFIJO) || VIEJOS.includes(k))).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res && res.ok && new URL(e.request.url).origin === location.origin) {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
