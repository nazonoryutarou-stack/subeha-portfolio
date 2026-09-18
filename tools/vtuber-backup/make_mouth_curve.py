#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
import numpy as np

def percentile(a, q):
    return float(np.percentile(a, q)) if len(a) else 0.0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pcm", type=Path)
    ap.add_argument("--sample-rate", type=int, default=16000)
    ap.add_argument("--hop-ms", type=float, default=10.0)
    ap.add_argument("--window-ms", type=float, default=30.0)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    x = np.fromfile(args.pcm, dtype="<i2").astype(np.float32) / 32768.0
    hop = max(1, round(args.sample_rate * args.hop_ms / 1000))
    win = max(hop, round(args.sample_rate * args.window_ms / 1000))
    half = win // 2
    rms, centers = [], []

    for c in range(0, len(x), hop):
        a, b = max(0, c-half), min(len(x), c+half)
        frame = x[a:b]
        val = float(np.sqrt(np.mean(frame*frame) + 1e-12)) if len(frame) else 0.0
        rms.append(val)
        centers.append(c)

    rms = np.asarray(rms)
    floor = percentile(rms, 20)
    high = percentile(rms, 95)
    span = max(1e-6, high-floor)
    raw = np.clip((rms-floor)/span, 0, 1)

    smooth = np.zeros_like(raw)
    for i, v in enumerate(raw):
        if i == 0:
            smooth[i] = v
        else:
            alpha = 0.55 if v > smooth[i-1] else 0.20
            smooth[i] = smooth[i-1] + alpha*(v-smooth[i-1])

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        f.write(json.dumps({
            "type":"meta","engine":"waveform_rms_v1","sample_rate":args.sample_rate,
            "hop_ms":args.hop_ms,"window_ms":args.window_ms,
            "noise_floor_rms":floor,"p95_rms":high
        }, ensure_ascii=False) + "\n")
        for c, v, r in zip(centers, smooth, rms):
            f.write(json.dumps({
                "type":"mouth","t_ms":round(c*1000/args.sample_rate),
                "open":round(float(v),4),"rms":round(float(r),6),
                "voiced_hint":bool(v>0.09)
            }, ensure_ascii=False, separators=(",",":")) + "\n")

    print(json.dumps({
        "frames":len(smooth),"noise_floor_rms":floor,"p95_rms":high,"out":str(args.out)
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
