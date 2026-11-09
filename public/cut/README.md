# SUBEHA CUT Pro v0.6 — portable mobile editor

Independent local-first mobile PWA, inspired by familiar video editing workflows. **Not affiliated with Videoleap/Lightricks; not a clone of their source code, trademark or proprietary visual assets.**

## v0.6 release

- **3-band audio EQ on independently timed audio tracks**: low-shelf 180 Hz, peaking 1100 Hz, high-shelf 4300 Hz; adjustable ±12 dB. Shared WebAudio graph routes the processed tracks to both speakers and `MediaStreamDestination` for video exports. This is a real filter, not a visual control. Browser codec support varies.
- **Custom video export presets**: lightweight (24 fps / 1.8 Mb/s), standard (30 fps / 4.5 Mb/s), high (30 fps / 9 Mb/s) and smooth (60 fps / 9 Mb/s), plus MP4/WebM format priority. Settings saved with the project. Requested frame rate/bitrate do not guarantee actual output; the browser encoder decides. Estimate output size, show reverse/transition/performance warnings.
- **Thumbnail extraction**: save the current composited preview (including text, layers and effects) as a PNG file.
- **Title designer**: editable CINEMA, NEON, NEWS, MINIMAL, VINTAGE presets; system/serif/mono/round/brush font families, outline color/width and optional black title background. No downloaded fonts needed. Output includes the designed titles because the export uses the same canvas.
- **New aspect ratios**: 4:5 and 3:4 social crops, 21:9 ultrawide, retaining existing 9:16, 16:9 and 1:1. Tap ratio control to cycle.
- **Reverse-split correctness**: splitting a reversed clip now preserves chronological playback by partitioning source ranges in reverse order. Duplicates and split halves deep-copy keyframes (no shared nested references). New projects initialize export options.
- Cache bumped to `subeha-cut-app-v6` including the new offline modules. Old project files remain importable.

## Previous capabilities

Video/image clips and overlays, trim/split/duplicate/reorder, keyframes, multi-clip transitions, audio recording/fades, chroma key, polygon masks, point tracking, crop/rotate/flip, freeze frames, filters and procedural effects, subtitle import/export SRT/VTT/Whisper JSON, offline autosave, and source-inclusive `.subecut` archives.

## How to use

Open https://nazonoryutarou-stack.github.io/subeha-portfolio/cut/ in Android Chrome, choose **Install app** if offered. Import videos/images, select audio and open 音声 to change three EQ bands, select text to apply title presets, or open 出力 to choose quality/format and save the current frame as PNG. Keep the app foregrounded during video export.

## Reproducible tests

```sh
cd public/cut
for f in *.mjs; do node --check "$f" || exit 1; done
node --test test/*.test.mjs
python3 -m http.server 8765
```

## Important limitations

**Not yet Videoleap feature parity.** There is no semantic AI subject matting, AI object removal/generation, templates/cloud stock integration, native APK, full GPU/offline render, 4K/HEVC or MP4 guarantee, or professional optical flow. Effects and reverse playback are browser/decoder dependent; `MediaRecorder` export is foreground and real-time, at most 180 seconds in this version. The app uses requested bitrates and FPS, not promised encoded properties. EQ works for the additional audio tracks, not the original base-video audio nor legacy single BGM. Font faces depend on the device's installed fonts.

Node test suite passes. **Android real-device test is pending; Chromium in the development sandbox blocked local page navigation by administrator policy, so no claim of full browser UI or video export verification is made for v0.6.** Original user recordings remain only in local browser storage; never upload private media to the public repo.
