# Coding Agent Guidelines

This project adopts the Karpathy-inspired coding guidelines from `multica-ai/andrej-karpathy-skills`, pinned for reference at upstream commit `2c606141936f1eeef17fa3043a72095b4765b9c2`.

These rules apply to non-trivial coding, debugging, refactoring, CI, Remotion, VRM, audio, subtitle, and rendering work in this repository.

## 1. Think Before Coding

Do not assume, hide uncertainty, or silently choose among ambiguous interpretations.

Before implementing:
- State assumptions explicitly when they materially affect the result.
- If multiple interpretations would produce different outputs, surface them instead of guessing.
- Prefer the simpler approach when it satisfies the request.
- If a required fact cannot be established from the source of truth, stop and inspect it before editing.

## 2. Simplicity First

Implement the minimum code needed for the requested result.

- Do not add features that were not requested.
- Do not introduce abstractions for single-use logic.
- Do not add configurability merely because it might be useful later.
- Do not expand a local fix into a framework rewrite.
- If the implementation is substantially larger than necessary, simplify it before calling it done.

## 3. Surgical Changes

Touch only what is necessary for the requested goal.

- Do not refactor, reformat, rename, or clean adjacent code unless required by the task.
- Match the existing style and architecture.
- Remove only imports, variables, functions, files, or configuration made obsolete by the current change.
- Mention unrelated issues rather than fixing them opportunistically.
- Every changed line should trace directly to the requested outcome.

## 4. Goal-Driven Execution

Define verifiable success criteria before implementation and loop until they are satisfied.

For multi-step work, use this pattern:

1. Change one required thing -> verify with a concrete check.
2. Change the next required thing -> verify with a concrete check.
3. Run the smallest relevant end-to-end test -> verify the actual artifact.

Do not substitute "implemented" for "verified".

## Project-Specific Verification Rules

### Video / Remotion / VRM

A video change is not complete because code compiles or a render command was started.

Completion requires, as applicable:
- GitHub Actions render job completed successfully.
- The expected MP4 artifact exists and can be downloaded.
- `ffprobe` or equivalent confirms the expected video/audio streams, resolution, duration, and A/V timing.
- Representative QC frames from the actual rendered MP4 are inspected for composition, clipping, text, reference-image placement, and avatar framing.
- Motion and lip-sync claims are based on the rendered output, not only on code paths.

### Audio

- Keep transcription/analysis audio separate from final-video audio.
- Do not use a 16 kHz Whisper/ASR proxy as the final video source when a higher-quality original exists.
- Prefer the original source audio and preserve its useful bandwidth through the render pipeline.

### Subtitles

- Timing comes from the actual source audio/timestamps, not evenly divided guesses.
- Text may be corrected against Clean/reference transcripts, but corrected wording must remain tied to measured source timing.
- Subtitle-sync success requires checking the rendered result, not merely validating JSON.

### Source of Truth

- Current state must be checked live from GitHub, files, processes, workflow runs, artifacts, or rendered output.
- Distinguish explicitly between configured, implemented, running, completed, and verified.
- Never report success from process absence, code presence, or intended behavior alone.

## Working Test

These guidelines are working when diffs stay small, assumptions are surfaced before edits, no unrelated cleanup slips in, and completion is backed by actual test/render evidence rather than optimistic narration.
