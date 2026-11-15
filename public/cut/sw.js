const CACHE = 'subeha-cut-app-v31';
const RESOURCES = ['./','./index.html','./app.mjs','./timeline.mjs','./style.css','./pro.css','./pro.mjs','./compositor.mjs','./point-tracker.mjs','./multi-audio.mjs','./subtitles.mjs','./project-archive.mjs','./waveform.mjs','./export-timing.mjs','./transitions.mjs','./transition-visuals.mjs','./speed-ramp.mjs','./keyframes.mjs','./effects.mjs','./optical-fx.mjs','./audio-eq.mjs','./export-settings.mjs','./text-styles.mjs','./image-retouch.mjs','./edit-templates.mjs','./video-retouch.mjs','./touch-edit.mjs','./touch-workspace.mjs','./layer-stack-core.mjs','./fx-timeline-core.mjs','./touch-workspace.css','./editor-shell.css','./editor-shell.mjs','./reference-ui.css','./magic-edit.mjs','./pip-style.mjs','./frame-strip.mjs','./filmstrip-cache.mjs','./overlay-motion.mjs','./audio-ducking.mjs','./direct-geometry.mjs','./title-render.mjs','./pbr-title-render.mjs','./pbr-title-core.mjs','./text-motion-render.mjs','./text-motion-core.mjs','./title-gestures.mjs','./direct-canvas.mjs','./direct-canvas.css','./trash-core.mjs','./trash-zone.mjs','./trash-zone.css','./fx-lab-core.mjs','./export-integrity.mjs','./filter-stack.mjs','./fx-lab.mjs','./fx-lab.css','./stock-sources.mjs','./stock-library.mjs','./stock-library.css','./audio-envelope.mjs','./narration-cues.mjs','./manifest.webmanifest','./icons/editor.svg'];
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
