# VTuber engine reproducibility — episodes 164 / 166 / 169

Date: 2026-09-20

## Baseline

UI baseline is frozen to `vtuber-landscape-v1 / golden`.

Shared shell for every run:

- 1280x720
- dark graphite background
- restrained gold accents
- observation / visual zone on the left
- VRM bust zone on the right
- subtitle card at the bottom
- same spacing and typography hierarchy
- no episode-specific shell redesign

## Reproduction inputs

All tests use the first 60 seconds of the original episode audio and the rescued episode timing data.

### Episode 164

Audio structure: music-heavy intro with sparse short speech.

- timing segments in first 60 s: 12
- speech segments: 6
- speech coverage: 28.3%
- waveform-driven mouth-active ratio: 28.0%
- output: 1280x720 / 30 fps / 60.000 s
- H.264 + AAC

Result: PASS.

The avatar remains closed during music/non-speech spans and resumes mouth motion for the short speech islands without changing the layout.

### Episode 166

Audio structure: almost continuous speech.

- timing segments in first 60 s: 6
- speech segments: 6
- speech coverage: 98.5%
- waveform-driven mouth-active ratio: 63.6%
- output: 1280x720 / 30 fps / 60.000 s
- H.264 + AAC

Result: PASS.

The same shell handles dense continuous captions and sustained voice activity without per-episode positioning changes.

### Episode 169

Audio structure: speech with a large early silence gap and later continuous speech.

- timing segments in first 60 s: 6
- speech segments: 6
- speech coverage: 64.7%
- waveform-driven mouth-active ratio: 56.3%
- output: 1280x720 / 30 fps / 60.000 s
- H.264 + AAC

Result: PASS.

The avatar stays closed through the unsegmented silence and recovers when speech resumes. Layout and subtitle position stay unchanged.

## Reproducibility conclusion

The golden UI shell passed three materially different audio structures without episode-specific layout tuning.

The test confirms separation of concerns:

```text
episode audio
  ├─ rescued / hybrid timing -> subtitle and speech gate
  └─ waveform RMS            -> mouth openness
                   ↓
          fixed golden UI shell
                   ↓
              1280x720 MP4
```

The mouth-active ratio is intentionally lower than raw speech coverage for continuous-speech episodes because pauses and low-energy frames inside a speech segment still close the mouth.

## Pose baseline v2

Production backup composition now uses a less mannequin-like idle pose:

- shoulders lowered
- upper arms angled down
- elbows bent slightly inward
- wrists given small opposing rotations
- hips / spine / chest carry a slight counter-rotation
- left/right pose is intentionally not perfectly symmetric
- very small shoulder / arm / wrist breathing motion is added per frame
- head / neck / chest micro-motion remains

Pose changes must not alter the frozen golden UI shell.

## Sandbox reproduction note

For the three quick cross-episode test renders, the avatar was rendered as a tightly cropped bust at 15 fps and carried into a 30 fps final composition. This was a speed-optimized reproducibility check of audio/timing/UI behavior.

The production Remotion composition remains 30 fps and uses the actual VRM skeleton pose defined in `VrmLipSyncBackup.tsx`.

## Status

Initial quick-render verdict: INVALIDATED.\n\nThe first quick renders incorrectly hid the arms with a bust mask and displayed raw/timed ASR directly as captions. Those outputs are not valid golden-baseline references.\n\nCorrected reference renders now use clean display captions, rescued timing, the fixed bottom caption card, and visible lowered arms. Corrected UI reproduction: PASS (3/3).

Next validation target: render the same three samples through the production 30 fps Remotion/three-vrm path when that runtime is available, then compare pose and mouth motion against this sandbox reference.


## Correction after visual QC

The initial 164 / 166 / 169 quick renders exposed two implementation errors:

1. the sandbox bust mask removed the horizontal arm extensions instead of actually posing the arms;
2. raw/timed ASR text was burned as the visible subtitle at the bottom edge, bypassing the golden caption card and clean transcript.

Those renders are superseded.

Corrected test rule:

```text
clean transcript text
        +
rescued/timed segment clock
        ↓
fixed golden caption card

VRM / reference avatar
        ↓
arms remain visible
        ↓
natural lowered idle pose
```

The corrected sandbox references use a 2D arm rig only to prove composition and visibility while the production Remotion path retains skeletal posing.
