# Audio ingest status

- Git LFS patterns are configured for `media/audio/*`.
- Episodes 150-158 are registered in `manifest.json` with byte size, duration, and SHA-256.
- `tools/video-pipeline/check_media_manifest.py` is the completion gate.
- The current ChatGPT GitHub connector can edit repository text/metadata but does not expose a binary/LFS upload action. Therefore the `.m4a` objects themselves are not yet present in GitHub, and must not be treated as ingested until the checker passes against real files.
- Canonical VRM asset already present in the repository: `subeha-web-site.vrm`.
