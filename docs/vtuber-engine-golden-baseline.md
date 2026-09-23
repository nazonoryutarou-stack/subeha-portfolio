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


## UI freeze

As of 2026-09-20, `vtuber-landscape-v1 / golden` is the fixed production UI baseline.

Do not redesign the shell per episode. Keep these stable:

- 1280x720 landscape
- dark graphite background with restrained gold accents
- visual / observation zone on the left
- VRM bust zone on the right
- bottom subtitle card
- compact archive/source labels
- no debug meters or validation labels in finished output

Episode-specific content may change inside the visual zone, but the shell, spacing, typography hierarchy, avatar zone and subtitle position are treated as frozen.

A UI change requires an explicit new baseline decision; timing, ASR, pose or visual-reference work must not silently restyle the composition.

## Reproducibility set

Initial cross-episode reproduction set:

- episode 164: music + sparse short speech
- episode 166: longer continuous speech
- episode 169: large silence gaps + speech

The purpose is to verify that the same frozen UI, mouth-drive rules, timing conversion and QC process survive different audio structures without per-episode layout tuning.


## Caption and avatar visibility invariants

These are part of the frozen golden baseline, not episode-specific choices.

- Display caption text comes from the episode `clean` transcript.
- Caption timing comes from the matching `timed` / rescued clock.
- Raw ASR text must not be shown directly when a clean transcript exists.
- Captions render only in the fixed bottom golden card.
- Do not burn a second ASS subtitle line below or outside that card.
- The observation panel must not duplicate raw transcript snippets as pseudo-captions.
- Both arms must remain visibly present in the avatar zone.
- Cropping a T-pose until the arms disappear is not a pose fix.
- The production renderer must pose the skeleton; sandbox reference renders may use a clearly documented 2D arm rig only for layout/QC validation.



## Subtitle and avatar safe-area rules

Locked after the episode 164 / 169 highlight render pass:

- `timed` supplies **time only**. Do not use raw ASR wording as finished display captions.
- Finished display captions must be checked against the episode `clean` transcript.
- If `clean` contains `[聞き取り不明]`, preserve the uncertainty instead of inventing a confident word.
- Long captions must be split into readable 2–3 line chunks inside the fixed subtitle card.
- The subtitle card is a reserved safe area. The VRM body, tail, arms, reference cards and debug UI must not enter it.
- The avatar framing must retain visible shoulders and arms. Do not solve T-pose or pose problems by cropping the arms out.
- Preferred avatar crop is natural upper-body / waist-up framing that ends above the subtitle card.
- The golden shell remains fixed; pose and crop adapt inside the avatar zone, never by moving the subtitle card.

Canonical pipeline:

```text
original audio
  + rescued/hybrid timed  -> caption timing
  + clean transcript      -> caption wording
  + waveform RMS          -> mouth opening
  + natural upper-body VRM pose
            ↓
      fixed golden UI
            ↓
      QC at multiple frames
```


## Processing boundary: phone vs VTuber engine

The Nothing Phone / Termux path is **ASR-only**.

Phone responsibilities:

- run whisper.cpp
- produce transcript text
- produce token / segment timestamps
- emit full JSON / timing JSONL
- no video rendering
- no VRM posing
- no UI composition
- no final subtitle layout
- no production mouth animation render

VTuber engine responsibilities:

- map clean transcript text onto timing data
- generate waveform-driven mouth motion
- drive VRM visemes / expressions
- apply natural 3D pose and idle motion
- use the frozen `vtuber-landscape-v1 / golden` UI
- place visual references
- render final video

Do not move rendering work onto the phone merely because ASR is executed there. The phone is a transcription/timing appliance, not the video renderer.
