// Guarda la app en el equipo para que abra aunque no haya internet.
// Siempre intenta traer la versión nueva primero; si no hay red, usa la guardada.
const CACHE = 'emma-app-v1';
const ARCHIVOS = ['./', 'index.html', 'nube.js', 'vendor/supabase-2.45.4.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // la base de datos nunca pasa por acá
  e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
