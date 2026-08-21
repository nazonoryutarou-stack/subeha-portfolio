# VTuber QC v3 status

## Confirmed source

- Broadcast: GRAVITY 第158回
- Original audio: `配信158.m4a`
- Locked source range: `02:07:20.000`–`02:08:05.000`
- Duration: 45.000 s
- Range was confirmed by waveform matching the old derived video against the original long-form recording across multiple independent windows.

## Render QC

The current 45-second QC render passed structural inspection:

- 720×1280 portrait
- 30 fps
- H.264 video + AAC audio
- video duration: 45.000000 s
- audio duration: 44.977007 s
- A/V drift: 0.022993 s
- video frames: 1350
- visual QC points: 0.5 / 8 / 18 / 30 / 43 s

The earlier failure mode where the MP4 container reported a long duration but the video stream ended after roughly six seconds is now explicitly rejected by `tools/video-pipeline/validate_render.py`.

## VRM QC

`Subeha.vrm` has native VRM 1.0 mouth expressions:

- `aa`
- `ih`
- `ou`
- `ee`
- `oh`

The Remotion viseme test also produced visible mouth-shape changes after reframing the QC camera around the actual avatar head position.

## Caption policy

Captions are intentionally omitted from this QC render.

Do not reuse untimed transcript prose or subtitles from another derived video. Captions must be generated/aligned from this exact 45-second source range, and the topic/title text must stay locked to the same source segment.

## Current gate

The four basic delivery conditions now pass:

1. original source audio
2. portrait video
3. VRM mouth movement
4. full 45-second video stream

Timed ASR alignment is the next gate before a captioned release render.
