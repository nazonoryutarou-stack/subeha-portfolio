# SUBEHA CUT Pro v0.5 — Android mobile editing studio

Offline-first original PWA inspired by common mobile video-editing workflows. No affiliation with Videoleap/Lightricks; no protected branding, assets or UI source code copied. Android Chrome: https://nazonoryutarou-stack.github.io/subeha-portfolio/cut/

## v0.5 additions

- **True overlap transitions** between adjacent base clips: dissolve, dip-to-black/fade, left/right wipes, slide, zoom. Incoming clip owns `transitionIn`; its timeline begins during the outgoing clip, and the total project length is shortened by the transition overlap. Pure timing functions and overlap math are tested in `transitions.mjs`.
- Two independently scheduled HTMLVideoElements preview the outgoing and incoming clips. In WebAudio-capable browsers, the outgoing and incoming base clip sound is crossfaded in the same audio stream used by export. Browser decoder load may cause dropped frames at cuts, especially on phones. Project clips, overlays, captions and audio use the shortened shared timeline.
- **Effects**: editable intensity for vignette, pixelate, pseudo-prism/color displacement, scanlines, grain and animated light leak (`effects.mjs`). Runs in Canvas2D, not on GPU or AI.
- **Voiceover**: record from the phone's microphone with an explicit user grant using `MediaRecorder`; recordings are imported as movable audio clips. Chrome/media codec support varies.
- **Crop**: normalized X/Y/width/height source crop on base image/video clips. Existing fit/fill and rotation/flip remain available.
- **Base clip keyframes**: zoom, position, rotation, opacity interpolated across clip-local time, linear or smoothstep easing. Splitting a keyframed clip preserves continuity at the cut.
- **Freeze frame**: create a PNG of the displayed preview, store it as a project asset, insert a two-second image clip into the timeline.
- **Canvas backgrounds**: choose background color or blurred image fill for aspect-fit compositions.
- **Experimental reverse playback**: mapped source time in `transitions.mjs`; uses frequent seeks into the original video while moving the project timeline forward. May be choppy with compressed long-GOP source video and should **not** be considered reliable frame-accurate reverse export. Reversed clip audio is muted intentionally.
- **Clip audio**: per-clip volume and mute; additional speeds 0.25×, 0.75×, 1.25×, 3×, 4×.
- New UI entries for transitions, crop, canvas, freeze, effects, transforms.

## Existing capabilities (v0.1–v0.4)

Clip selection/splitting/trimming, music, per-clip looks, video/image overlays, Canvas2D chroma key, polygon masking, manual feature-point tracking, draggable audio clips with fades, SRT/VTT/Whisper JSON subtitle import, timed subtitle burn-in, waveform preview, offline IndexedDB autosave, Undo/Redo, `.subecut` ZIP archives with source files (200MB limit) and browser-based real-time MediaRecorder export (MP4 or WebM depending on browser support).

## User operations

1. Import at least two videos/images. Tap their shared **＋** joint in the timeline or select the second clip and open **転換**. Choose style and overlap length.
2. Select a clip and open **効果**, **変形**, **切抜**, **背景**, or **静止**.
3. For base keyframes, select a clip, position the playhead, change transform values, then tap **◆ 現在位置をキーフレーム登録**; repeat at other times. Keys interpolate. Splitting a keyframed clip retains key positions.
4. Open **音声** → **🎙 マイク録音** → allow microphone → **■ 録音終了**, then adjust the new audio track.
5. Export from **出力** while the app remains in foreground, or save all materials via **保存/復元**.

## Verification

```sh
cd public/cut
for f in *.mjs; do node --check "$f"; done
node --test test/*.test.mjs
python3 -m http.server 8765
```

## Important limitations

**This is not yet full feature parity with Videoleap.** There is no AI object removal, AI generative video, semantic subject/person matting, cloud templates, 4K/HEVC guarantee, offline GPU rendering, high-end optical-flow tracking, reliable reverse audio/video, or a native Android APK. Fonts/text motion, compositing and template library remain more limited. Web Canvas2D and WebAudio on mobile will have performance/memory limits. Export is foreground/realtime and file codec varies by browser. `.subecut` is our own archive, not a Videoleap project file.

All user media stays local: never commit/import private personal recordings into a public repo. v0.5 automatic unit tests passed on Node 22; **Android device and full browser UI/video export verification remain outstanding** because available Chromium was restricted by container administrator navigation policies.
