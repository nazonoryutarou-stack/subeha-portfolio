const CACHE = 'subeha-cut-app-v21';
const RESOURCES = ['./','./index.html','./app.mjs','./timeline.mjs','./style.css','./pro.css','./pro.mjs','./compositor.mjs','./point-tracker.mjs','./multi-audio.mjs','./subtitles.mjs','./project-archive.mjs','./waveform.mjs','./export-timing.mjs','./transitions.mjs','./keyframes.mjs','./effects.mjs','./audio-eq.mjs','./export-settings.mjs','./text-styles.mjs','./image-retouch.mjs','./edit-templates.mjs','./retouch-studio.mjs','./video-retouch.mjs','./video-retouch-studio.mjs','./touch-edit.mjs','./touch-workspace.mjs','./touch-workspace.css','./editor-shell.css','./editor-shell.mjs','./reference-ui.css','./magic-edit.mjs','./pip-style.mjs','./frame-strip.mjs','./filmstrip-cache.mjs','./overlay-motion.mjs','./obj-core.mjs','./obj-renderer.mjs','./cg-studio.mjs','./engine-hub-ui.mjs','./integrations/engine-plan.mjs','./integrations/engines.json','./audio-ducking.mjs','./direct-geometry.mjs','./title-render.mjs','./title-gestures.mjs','./direct-canvas.mjs','./direct-canvas.css','./trash-core.mjs','./trash-zone.mjs','./trash-zone.css','./japanese-ui.mjs','./fx-lab-core.mjs','./export-integrity.mjs','./filter-stack.mjs','./fx-lab.mjs','./fx-lab.css','./stock-sources.mjs','./stock-library.mjs','./stock-library.css','./voice-api.mjs','./voice-studio.mjs','./voice-studio.css','./vrm-lite.mjs','./audio-envelope.mjs','./narration-cues.mjs','./cg-touch.mjs','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
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
