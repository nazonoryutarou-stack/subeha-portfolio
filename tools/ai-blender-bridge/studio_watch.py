#!/usr/bin/env python3
"""Opt-in local observer: capture the Blender screen after a finished AI Blender job.

No screenshot is taken without a valid AI Phone Bridge consent lease and an
explicitly allowlisted foreground application. No image is uploaded anywhere.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import sys
import time
from urllib.request import Request, urlopen

BRIDGE_ROOT = Path.home() / ".ai_blender_bridge"
PHONE_CODE = Path.home() / "ai-phone-bridge"
DATA = BRIDGE_ROOT / "studio_watch"
STATE = DATA / "state.json"


def load_phone_bridge():
    sys.path.insert(0, str(PHONE_CODE))
    import phone_bridge
    return phone_bridge


def current_status(port: int):
    token = (BRIDGE_ROOT / "token").read_text(encoding="ascii").strip()
    url = f"http://127.0.0.1:{port}/status?token={token}"
    req = Request(url, headers={"Cache-Control": "no-store"})
    with urlopen(req, timeout=6) as res:
        return json.loads(res.read(100_000).decode("utf-8"))


def last_success(payload):
    result = payload.get("status", {}).get("last_result")
    if isinstance(result, dict) and result.get("ok") is True:
        return str(result.get("id", ""))
    return ""


def read_last():
    try:
        return json.loads(STATE.read_text(encoding="utf-8")).get("seen", "")
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def write_last(jid):
    DATA.mkdir(parents=True, exist_ok=True)
    temp = STATE.with_suffix(".tmp")
    temp.write_text(json.dumps({"seen": jid}, ensure_ascii=False), encoding="utf-8")
    os.chmod(temp, 0o600)
    temp.replace(STATE)


def observe_once(phone, payload):
    jid = last_success(payload)
    if not jid:
        return "No successful Blender job yet"
    seen = read_last()
    if seen is None:
        write_last(jid)  # Never capture historical work on first start.
        return "Observer initialized; waiting for next completed Blender job"
    if jid == seen:
        return "No new completed Blender job"
    # Mark before side effects to prevent repetitive captures of the same job.
    write_last(jid)
    if not phone.consent_active():
        return f"Job {jid} completed. Capture skipped: explicit local consent required"
    allowed = phone.config()["allowed_packages"]
    if not allowed:
        return f"Job {jid} completed. Capture skipped: no allowlisted applications"
    package = phone.foreground_package()
    if package not in allowed:
        return f"Job {jid} completed. Capture skipped: foreground app {package} is not allowlisted"
    # Existing Phone Bridge enforces the foreground allowlist + ADB availability.
    phone.authorized_foreground(package)
    path = phone.screenshot()
    return f"Job {jid}: captured {path} (local only; no uploads)"


def main(argv=None):
    ap = argparse.ArgumentParser(description="Capture Blender viewport after each new Blender Bridge job")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--interval", type=int, default=8)
    ap.add_argument("--once", action="store_true")
    args = ap.parse_args(argv)
    if not (1 <= args.port <= 65535):
        ap.error("bad port")
    if args.interval < 3:
        ap.error("interval must be >= 3 seconds")
    phone = load_phone_bridge()
    print("[studio-watch] Local observer started; no cloud uploads; Ctrl+C to stop.", flush=True)
    try:
        while True:
            try:
                print("[studio-watch]", observe_once(phone, current_status(args.port)), flush=True)
            except Exception as ex:
                print("[studio-watch] Connection/capture error:", type(ex).__name__, str(ex)[:180], flush=True)
            if args.once:
                break
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("[studio-watch] stopped", flush=True)


if __name__ == "__main__":
    main()