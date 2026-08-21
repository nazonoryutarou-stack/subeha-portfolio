# Broadcast audio archive

Episodes 150-158 are expected under this directory and are tracked with Git LFS.

The authoritative metadata is `manifest.json`. Every source file is identified by episode number, byte size, duration, and SHA-256 so a later upload can be checked byte-for-byte before use.

Run:

```bash
python tools/video-pipeline/check_media_manifest.py
```

The video pipeline must not use a source file whose hash or duration differs from the manifest without explicitly updating the manifest.

Current canonical model asset remains `subeha-web-site.vrm` at repository root. Audio/visual generation code should reference that asset rather than adding duplicate VRM copies to source control.
