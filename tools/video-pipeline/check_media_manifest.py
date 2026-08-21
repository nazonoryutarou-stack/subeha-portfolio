#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def duration(path: Path) -> float:
    out = subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=nw=1:nk=1', str(path),
    ], text=True).strip()
    return float(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', default='media/audio/manifest.json')
    ap.add_argument('--root', default='media/audio')
    args = ap.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding='utf-8'))
    root = Path(args.root)
    failures = []

    for item in manifest['files']:
        path = root / item['file']
        if not path.exists():
            failures.append(f"MISSING: {path}")
            continue
        size = path.stat().st_size
        if size != item['bytes']:
            failures.append(f"SIZE: {path} expected={item['bytes']} actual={size}")
        digest = sha256(path)
        if digest != item['sha256']:
            failures.append(f"SHA256: {path} expected={item['sha256']} actual={digest}")
        dur = duration(path)
        if abs(dur - item['durationSec']) > 0.1:
            failures.append(f"DURATION: {path} expected={item['durationSec']} actual={dur:.3f}")
        print(f"OK {item['episode']}: {path.name} {dur:.3f}s {size} bytes")

    if failures:
        print('\n'.join(failures))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
