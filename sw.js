// Guarda la app en el equipo para que abra aunque no haya internet.
// Siempre trae la versión nueva primero (sin usar la caché del navegador); si no hay red, usa la guardada.
const CACHE = 'emma-app-v21';
const ARCHIVOS = ['./', 'index.html', 'gestion.html', 'version.js', 'promos.js', 'nube.js', 'despacho.js', 'pagos.js', 'escaner.js', 'etiquetas.js', 'live.js', 'pedidos4.js', 'mabel.js', 'importar.js', 'vendor/qrcode-generator-1.4.4.js', 'vendor/jsqr-1.4.0.js', 'vendor/supabase-2.45.4.js', 'manifest.json', 'iconos/icono-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' }))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // la base de datos nunca pasa por acá
  const fresco = e.request.mode === 'navigate' ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(fetch(fresco).then(r => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
