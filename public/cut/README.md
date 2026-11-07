# SUBEHA CUT Pro v0.3 — local-first mobile video editor

Videoleap-style workflow (independent implementation, no affiliation or copied assets). Chrome on Android supports installing it as an offline-capable PWA. Local user media never goes to GitHub.

## Main features

- Multi-clip timeline: trim, split, reorder, speed, duplication, filters, color and transforms.
- Multiple video/image overlay layers, blend modes, circle masks and **tap-to-draw polygon masks** with feather.
- **Chroma key**: green/blue/custom key color, similarity, softness and edge spill control, applied to overlay image/video pixels with Canvas2D.
- **Lightweight manual point tracking**: select an overlay, tap a textured point on the base video and play to record position samples; the overlay follows the sampled trajectory. Plain grayscale block matching, not human/object recognition. It can lose points on occlusion, high-speed moves or rotation.
- Keyframe transform animation for overlays; text overlays with timing and animations.
- **Multiple extra audio tracks**: audio clips start at individual project timeline positions, with source offset, volume, mute, fade in and fade out. WebAudio GainNodes feed both playback and the shared audio stream captured for export. Original one-BGM legacy track remains available in previously saved projects.
- Local IndexedDB autosave and Undo/Redo. Project metadata JSON backup does NOT include media. Browser-based real-time recording/export.

## Usage

1. Install `https://nazonoryutarou-stack.github.io/subeha-portfolio/cut/` using Chrome > Install app / Add to home screen.
2. Import a base image/video. Use Overlay to import the top media layer.
3. Select the overlay then use **キー合成** to key a uniform backdrop, **オーバーレイ** to choose **多角形** then **輪郭を描く** to tap polygon points on the preview. Use `境界ぼかし` to soften its edge.
4. Use **追跡** to select a point with texture on the *base video*, then play the base video. Stop to commit a recorded trajectory.
5. Use **音声** to add multiple local audio files and adjust each start time and fade.
6. Use **出力** to export while keeping the app in the foreground.

## Test

```sh
node --check app.mjs && node --check pro.mjs && node --check compositor.mjs && node --check multi-audio.mjs && node --check point-tracker.mjs
node --test test/*.test.mjs
python3 -m http.server 8765
```

## Known limitations

- **Not Videoleap feature-parity, visual identity, or native APK.** No proprietary templates/assets copied.
- Chroma key runs on downsampled 640px edge-length CPU buffer; translucent/fine hair edges may be imperfect, large multilayer projects may drop frames.
- Polygon mask vertices must be tapped manually; they are local to one layer transform. Mask feather relies on Canvas2D blur implementation. No semantic segmentation.
- Tracker is a 2D local patch matcher and does **not** track identity, rotation, scaling or a person reliably. Only records positions during normal playback (not offline analysis or fast scrubbing). Track is sampled at ~5 Hz; recordings are capped to protect storage.
- WebAudio routing for multiple tracks depends on user media gesture/browser support; phones vary. Extra track export is mixed through MediaStreamDestination, output format remains browser-dependent and export is real-time. No WAV multitrack/stems export.
- Mobile Chrome real-device validation and heavy project render tests are pending. Performance and format compatibility vary by device.
- Source files remain on device, subject to browser IndexedDB storage eviction. No server-side generation, AI removal, or automated object recognition.
