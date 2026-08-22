#!/usr/bin/env python3
"""Reject structurally broken final renders.

Checks stream presence, exact dimensions/orientation, A/V duration drift, and expected duration.
This catches files whose container duration looks correct while the video stream silently ends early.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("file", type=Path)
    parser.add_argument("--orientation", choices=("portrait", "landscape", "square", "any"), default="any")
    parser.add_argument("--width", type=int)
    parser.add_argument("--height", type=int)
    parser.add_argument("--max-av-drift", type=float, default=0.25)
    parser.add_argument("--min-duration", type=float, default=0.0)
    parser.add_argument("--max-duration", type=float, default=90.0)
    args = parser.parse_args()
    if (args.width is None) != (args.height is None):
        parser.error("--width and --height must be provided together")
    if args.width is not None and (args.width <= 0 or args.height <= 0):
        parser.error("--width and --height must be positive")
    return args


def finite_float(value: object) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def probe(path: Path) -> dict:
    if shutil.which("ffprobe") is None:
        raise SystemExit("FAIL: ffprobe is required")
    proc = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration:stream=index,codec_type,codec_name,width,height,duration,nb_frames",
            "-of", "json", str(path),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise SystemExit(f"FAIL: ffprobe could not read {path}: {proc.stderr.strip()}")
    return json.loads(proc.stdout)


def main() -> int:
    args = parse_args()
    if not args.file.is_file():
        raise SystemExit(f"FAIL: file not found: {args.file}")

    data = probe(args.file)
    streams = data.get("streams") or []
    videos = [s for s in streams if s.get("codec_type") == "video"]
    audios = [s for s in streams if s.get("codec_type") == "audio"]
    if not videos:
        raise SystemExit("FAIL: no video stream")
    if not audios:
        raise SystemExit("FAIL: no audio stream")

    video, audio = videos[0], audios[0]
    width, height = int(video.get("width") or 0), int(video.get("height") or 0)
    if width <= 0 or height <= 0:
        raise SystemExit(f"FAIL: invalid dimensions {width}x{height}")

    if args.width is not None and (width != args.width or height != args.height):
        raise SystemExit(f"FAIL: expected {args.width}x{args.height}, got {width}x{height}")
    if args.orientation == "portrait" and width >= height:
        raise SystemExit(f"FAIL: expected portrait video, got {width}x{height}")
    if args.orientation == "landscape" and width <= height:
        raise SystemExit(f"FAIL: expected landscape video, got {width}x{height}")
    if args.orientation == "square" and width != height:
        raise SystemExit(f"FAIL: expected square video, got {width}x{height}")

    format_duration = finite_float((data.get("format") or {}).get("duration"))
    video_duration = finite_float(video.get("duration")) or format_duration
    audio_duration = finite_float(audio.get("duration")) or format_duration
    if video_duration is None or audio_duration is None:
        raise SystemExit("FAIL: could not determine both stream durations")

    drift = abs(video_duration - audio_duration)
    if drift > args.max_av_drift:
        raise SystemExit(
            f"FAIL: A/V durations diverge ({video_duration:.3f}s vs {audio_duration:.3f}s, drift {drift:.3f}s)"
        )

    duration = max(video_duration, audio_duration)
    if duration < args.min_duration:
        raise SystemExit(f"FAIL: render too short: {duration:.3f}s < {args.min_duration:.3f}s")
    if args.max_duration > 0 and duration > args.max_duration:
        raise SystemExit(f"FAIL: render too long: {duration:.3f}s > {args.max_duration:.3f}s")

    frames = video.get("nb_frames")
    report = {
        "file": args.file.name,
        "dimensions": f"{width}x{height}",
        "videoCodec": video.get("codec_name"),
        "audioCodec": audio.get("codec_name"),
        "videoDuration": round(video_duration, 6),
        "audioDuration": round(audio_duration, 6),
        "avDrift": round(drift, 6),
        "videoFrames": int(frames) if str(frames).isdigit() else frames,
        "status": "pass",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
