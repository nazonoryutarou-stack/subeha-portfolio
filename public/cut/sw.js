const CACHE = 'subeha-cut-app-v9';
const RESOURCES = ['./','./index.html','./app.mjs','./timeline.mjs','./style.css','./pro.css','./pro.mjs','./compositor.mjs','./point-tracker.mjs','./multi-audio.mjs','./subtitles.mjs','./project-archive.mjs','./waveform.mjs','./export-timing.mjs','./transitions.mjs','./keyframes.mjs','./effects.mjs','./audio-eq.mjs','./export-settings.mjs','./text-styles.mjs','./image-retouch.mjs','./edit-templates.mjs','./retouch-studio.mjs','./video-retouch.mjs','./video-retouch-studio.mjs','./touch-edit.mjs','./touch-workspace.mjs','./touch-workspace.css','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(RESOURCES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(n=>n.startsWith('subeha-cut-app-')&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin || !url.pathname.startsWith(new URL('./',self.location.href).pathname))return;
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});
