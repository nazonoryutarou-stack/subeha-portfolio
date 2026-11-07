const CACHE = 'subeha-cut-app-v2';
const RESOURCES = ['./','./index.html','./app.mjs','./timeline.mjs','./style.css','./pro.css','./pro.mjs','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
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
