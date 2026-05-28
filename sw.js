// PENDURA v2.1 — SERVICE WORKER
const CACHE = 'pendura-v2.1';
const ASSETS = [
  '/', '/index.html',
  '/css/main.css',
  '/js/config.js', '/js/supabase.js', '/js/app.js', '/js/pwa.js',
  '/js/modules/fx.js', '/js/modules/confidence.js',
  '/js/modules/calendar.js', '/js/modules/profile.js',
  '/js/services/whatsapp.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co') || e.request.url.includes('wa.me') ||
      e.request.url.includes('fonts.googleapis') || e.request.url.includes('fonts.gstatic') ||
      e.request.url.includes('jsdelivr')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
