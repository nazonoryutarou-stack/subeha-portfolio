# VTuber Engine Golden Baseline

Updated: 2026-09-20

This document is the durable visual/production baseline for future VTuber-engine work.

## Do not regress

Do not replace the established natural layout and pose with a minimal T-pose or debug framing just to prove lip-sync plumbing.

The approved reference is the previous `vtuber-landscape-v1` / gravity151 landscape-bust style.

## Visual baseline

- 1280x720 landscape
- left: visual/reference/observation area
- right: Subeha VRM, bust-up
- dark UI with muted gold accents
- subtitles fixed at the bottom
- natural neutral pose
- avatar faces generally forward, slightly toward screen center
- no debug labels in final output
- no visible T-pose arm span
- reference area should match the spoken topic; if no concrete visual is justified, use an observation/timeline/waveform panel rather than an arbitrary image

## Natural pose

Reuse the established `applyNaturalPose()` logic:
- shoulders relaxed
- upper arms lowered from VRM T-pose
- lower arms slightly bent
- light head / neck / chest motion
- blink animation

## Timing and mouth pipeline

Use the current backup timing path:

```text
source audio
  ├─ whisper.cpp full JSON token timing
  │    ├─ healthy segment -> native token time
  │    └─ broken segment -> waveform-assisted retime
  └─ 10 ms waveform RMS -> mouth_open

subtitle token/text
  -> kana/viseme when available
  -> aa fallback for unknown/kanji

mouth_open + viseme
  -> Subeha.vrm aa/ih/ou/ee/oh morphs
```

Rules:
- VAD off for this token-timing path until the known CLI timeline issue is resolved.
- processors=1.
- Remove whisper control/timestamp tokens from display text.
- Keep transcript cleaning separate from immutable timing data.
- Display captions may use the conservative clean transcript while lip-sync continues to use the timing timeline.
- Use the same source audio for captions, mouth drive, and final mux.

## Episode 165 validation

First 60 seconds:
- 68 final timing parts
- 51 native whisper token timings
- 17 waveform-retimed fallback parts
- 10 ms mouth analysis
- 30 fps render timeline
- control tokens in final display: 0
- 1280x720 golden-layout render completed with H.264 + AAC

## Quality-control rule

Before calling a video finished, inspect frames around:
- start
- first sustained speech
- middle
- greeting / rapid speech
- end

Check:
- avatar framing
- natural pose
- lip movement
- subtitles
- no old/debug overlays
- no accidental T-pose visibility
- A/V duration and stream validity
