# SUBEHA CUT v1.0 — video-first mobile editing UI

An original offline-first Android Chrome PWA for personal video editing. Not affiliated with Videoleap / Lightricks. The workflow follows common touch video editors; it does not reuse proprietary branding, templates, design assets, or app source code.

## New in v1.0

The v0.9 workspace made the preview small by exposing every empty track, large quick actions, permanent editing labels, and a 17-item toolbar. v1.0 consolidates these into a compact, content-first editing screen:

- Simple header with project/home, help and export controls, centered SUBEHA CUT title.
- Flexible preview, compact playback row and fullscreen control.
- Centered red playhead above the real main-clip thumbnail strip, with more legible timeline zoom (42px/s), white trim handles and a floating add-media button.
- Empty overlay, audio, and caption tracks are hidden; each appears once content is added.
- Contextual bottom tools: canvas/overlay/text/captions/audio/filters/effects/templates in standard mode; split/speed/volume/filters/adjust/crop/transform/transition/duplicate/delete on clip selection.
- Speed and volume sheets act directly on the selected clip. Advanced legacy tools remain available via the “すべて” menu.
- Reuses existing project save, local media, compositing, subtitles, audio, and export pipelines. Service worker bumped to `subeha-cut-app-v10`.

## Operations

1. Open `https://nazonoryutarou-stack.github.io/subeha-portfolio/cut/` from Android Chrome and import images/videos using the center button or the circular `＋` on the timeline.
2. Drag the timeline under the stationary red playhead to seek. Pinch to zoom, tap a clip to select it, drag its white trim handles, long-press to reorder it.
3. Once selected, use the contextual toolbar to split or change speed/volume or open advanced filters and transforms. Use the first back control to switch to general editing tools.
4. Tap `書き出す` to open the existing browser-dependent export panel; select an export preset and save. For portability, save `.subecut` from “すべて → 保存/復元”.

## Validation

- JavaScript syntax checks: all `.mjs` passed.
- Node.js test suite: **17/17 test files passed**.
- Chromium 390×844 simulated mobile viewport: new layout initialized, one image imported, clip selection opened contextual tools, speed changed to 2× (5s → 2.5s), volume set to 70%, filter and template panels opened, no uncaught JavaScript errors.
- Chromium in this environment blocks local URL navigation; the browser smoke test used inline CSS and data-URL ES modules to load **the actual source files**, not a mocked UI.
- **Android hardware and lengthy-video export have not been verified for v1.0.** The old video engine's MediaRecorder codec and performance constraints remain.

## Remaining limitations

This is a close *interaction pattern*, not a claim of pixel-perfect Videoleap equivalence or identical AI features. Some typography/icons/advanced tools differ. Android Chrome/PWA limitations remain: browser-driven encoding, potential 4K and memory constraints, and real-time capture/export. Nothing Phone touch, decoder, codec, and thermal tests still need device verification.

## Development

```sh
cd public/cut
for file in *.mjs; do node --check "$file" || exit 1; done
node --test test/*.test.mjs
```
