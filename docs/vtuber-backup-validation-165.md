# Vチューバーエンジン（予備） v0.1 validation — episode 165 first 60s

Date: 2026-09-20

## Result

Episode 165 first 60 seconds was rendered end-to-end with:

- private source audio
- whisper.cpp token timing
- waveform-assisted fallback for broken token timestamps
- waveform RMS mouth-open curve
- VRM morph targets for `aa / ih / ou / ee / oh`
- VRM blink morph
- Japanese subtitles
- H.264 video + AAC audio

No private audio, timing JSON, VRM binary, or rendered video is committed here.

## ASR / timing

- whisper.cpp commit: `5670d5c0bbcb148feabef84400a07cfca9aa3b30`
- model: `ggml-small-q5_1.bin`
- model SHA-256: `ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb`
- language: `ja`
- processors: 1
- threads: 4
- VAD: off
- first 60 s transcription runtime observed on Nothing Phone: about 13.6 s

The first baseline conversion produced 54 timed parts but exposed one broken segment where several lexical tokens collapsed to the same timestamp and whisper control tokens could leak into subtitle text.

The corrected hybrid converter now:

1. removes whisper control/timestamp tokens;
2. keeps native token timing for healthy segments;
3. detects low-quality token timing per segment;
4. retimes only the broken segment using the original waveform activity window.

Episode 165 result:

- final subtitle parts: 68
- native whisper token timing: 51
- waveform-retimed fallback parts: 17
- control tokens in final subtitle data: 0
- timestamp reversals: 0

## Mouth / VRM

Mouth opening is independent from subtitle timing.

- waveform analysis: 10 ms
- source mouth frames: 6000
- render timeline: 30 fps / 1800 frames
- viseme source: active subtitle token where kana is available
- unknown/kanji fallback: `aa`

The supplied `Subeha.vrm` is VRM 1.0 and contains expression presets:

- aa
- ih
- ou
- ee
- oh
- blink

The expression morphs were directly validated against the actual VRM mesh before the 60-second render.

## Render validation

Validated output characteristics:

- 720 × 1280
- 30 fps
- video duration: 60.000 s
- H.264
- AAC audio duration: 59.968 s
- portrait head/chest framing
- subtitles visible at sampled speech points
- mouth morph changes visible
- blink morph works

## Known limitations

- One timing segment uses waveform redistribution rather than native token-level timestamps.
- ASR text still contains recognition errors; timing and text cleaning remain separate concerns.
- The sandbox validation renderer used the VRM binary directly through OpenGL because external npm installation was unavailable in that environment. Production remains the Remotion/three-vrm backup composition.
- Skeletal body posing is still minimal. A dedicated neutral VTuber pose is a later visual-quality improvement.

## Status

The backup path has passed the original v0.1 functional goal:

```text
audio
  ├─ whisper.cpp -> hybrid subtitle timing
  └─ waveform RMS -> mouth_open
             ↓
       viseme + VRM morphs
             ↓
       subtitles + audio
             ↓
             MP4
```

Next quality work should focus on pose, subtitle cleaning, and visual layout rather than basic timing plumbing.
