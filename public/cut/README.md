# SUBEHA CUT — Android-ready independent video editor (PWA)

An original local-first mobile video editor inspired by common non-proprietary editing workflows; not affiliated with Videoleap or Lightricks. UI, branding and code are original. The application uses only browser APIs, no CDN, no API keys, no account.

## Capabilities in v0.1

- Import multiple local videos/images and one BGM/audio track.
- Timeline, trim IN/OUT, split at playhead, duplicate, reorder, delete, playback speed 0.5–2×.
- Preview aspect ratios 9:16, 16:9, square; fill/fit.
- Per-clip look presets and glitch overlay; text layers with position, duration, font size and color.
- Audio routed through Web Audio for mixed export, browser-dependent.
- Real-time recording of the edited canvas with `captureStream` + `MediaRecorder`; MP4 only where browser supports it, else WebM.
- Autosaves project/assets to IndexedDB locally, subject to device storage limits. User may export project metadata as JSON (not media).
- Offline PWA shell/service worker; Chrome Android can install when hosted on HTTPS.
- Local-first; no data transmitted to servers.

## Limitations (explicit)

Not a 1:1 Videoleap clone. No native APK, AI background remover, AI generative video, true mask/keyframes, multi-layer video compositing, automatic speech subtitles, GPU accelerated effects or export faster than realtime. Export requires staying in foreground. On low-memory devices, long clips or big images may cause storage or export issues. `MediaRecorder` format varies by browser. Chrome typically uses WebM; export to MP4 requires a compatible recorder or transcoder. Effects such as glitch are deliberate approximations.

## Local preview

```sh
cd public/cut
python3 -m http.server 8765
# open http://localhost:8765 on the same machine
```

Android Chrome install at `https://<your-pages-host>/subeha-portfolio/cut/` → (⋮) menu → Install app / Add to home screen.

## Validation

```sh
node --test test/timeline.test.mjs
node --check app.mjs
```

Service Worker only works over HTTPS/localhost. Local media files must be deliberately re-imported if the browser evicts its IndexedDB storage. The app never asks for all-media filesystem access.
