# SUBEHA CUT Pro v0.4 — mobile editor + offline caption & portable project tools

Original local-first video editor for Android Chrome (installable PWA). Inspired by standard multi-track mobile editing workflows. **Not affiliated with Videoleap or Lightricks.** No third-party proprietary templates, icons, or assets copied.

## New in v0.4

1. **Timestamp-faithful subtitles**: import SRT, VTT, Whisper JSON (segments and transcription), edit caption text and start/end time, adjust style (size, color, background, vertical position), show each cue in its own timeline lane, export corrected SRT. Imported captions are rendered on the same Canvas used for preview **and video export**. No online ASR or invented timings; the timestamps come from supplied files. Whisper.cpp `t0/t1` centisecond timestamps are supported.
2. **Portable project backup**: Save `.subecut` containing media assets, music, overlays, captions, and all timeline metadata. This is a standards-compliant **uncompressed ZIP**, CRC-32 validated on restore. It does not upload assets to a server. Open it in a new browser/device to continue editing. Maximum archive source media: **200 MiB**, intended for shorter mobile projects. File sizes are checked before creating the ZIP. Import requires confirmation and CRC checks before modifying the active project.
3. **Audio waveform**: multi-audio timeline tracks render sample peaks extracted locally via WebAudio. 32 MB per-file analysis cap; audio processing/storage is browser-limited. Peak data is ephemeral UI data, not recorded to the project.
4. **Wall-clock export timing**: when recording the canvas in real time, advance the project playhead from the monotonic timer instead of the capped preview animation delta, limiting duration drift when rendering frames are delayed. *This does not produce frame-accurate offline rendering or guarantee A/V sync under heavy load.*

## Existing features from v0.3

- Local import of clips, multiple overlays, trim/split/reorder/duplicate, speed changes, color adjustments, filters, text animation, Undo/Redo, aspect ratios.
- Layer keyframes, blend modes, circular / user-drawn polygon masks with feather; custom chroma key, basic point tracker.
- Multiple independently positioned audio tracks, fades and volume, WebAudio mixing into export; legacy BGM supported.
- Browser `MediaRecorder` exports supported formats (MP4 where available, otherwise WebM). Browser may require real-time rendering and the foreground tab.
- On-device IndexedDB autosave; `.subecut` export is the recommended **portable** backup because JSON-only metadata lacks media.

## How to use on Android

1. Open `https://nazonoryutarou-stack.github.io/subeha-portfolio/cut/` in Chrome, choose **Install app** or **Add to Home screen**.
2. Import a source video or still image. Other video and audio may be added as layers or independent audio tracks.
3. Select **字幕 → + 字幕ファイル** to import SRT, VTT or Whisper JSON. Use the timeline to select a cue and edit it, or export corrected SRT. You can choose a global import offset before selecting a file.
4. Use **保存/復元 → 素材を含めて保存** to download an `.subecut` archive. On another installation use **保存したプロジェクトを開く**. ZIP data stays on your device.
5. Use **出力** to render video with captions, layers, and audio. Keep the app visible while exporting.

## Validation

```sh
cd public/cut
node --check app.mjs && node --check pro.mjs
node --check subtitles.mjs && node --check project-archive.mjs
node --check waveform.mjs && node --check export-timing.mjs
node --test test/*.test.mjs
```

ZIP interoperability additionally checked using `unzip -t`. These are module/unit and format-validation tests, **not a substitute for Android real-device playback and export verification**. In the v0.4 development environment, headless Chromium navigation was blocked by the browser administrator policy; therefore the end-to-end UI, audio output and MP4 render tests for v0.4 remain unverified. v0.3 had a separate prior browser smoke test.

## Limitations and privacy

- No semantic/person AI background removal, GPU effects stack, automatic speech recognition, true frame-accurate encoding, native APK, or pixel-identical Videoleap UI. The manually directed tracker is not human detection.
- `MediaRecorder` may record MP4 or WebM depending on the phone's Chrome version, hardware and codecs. Mobile browsers can throttle background tabs, decoding is limited, and high resolution or heavy layers can drop frames. No guarantee of exact sync.
- Waveforms need audio decoding support; 32MB analysis cap, may be unavailable for some formats. Project archive media limit is 200MiB and ZIP is uncompressed.
- Subtitles are parsed from local timing sources; **no automatic translation or speech-to-text**, no validation of the accuracy of user-provided timings.
- Videos, photos, transcripts, audio and projects remain in the browser/phone unless the user deliberately saves/shares them. Avoid committing recordings or private transcripts into public GitHub.
