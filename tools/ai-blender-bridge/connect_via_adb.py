#!/usr/bin/env python3
"""One-shot, foreground-checked Android Blender Console reconnect via ADB.

Only operates on org.blender.blender. Sends a bootstrap expression, never a
general remote command. User must have the Python Console visible.
"""
import base64
from pathlib import Path
import shlex
import json
from urllib.request import urlopen
from urllib.parse import urlencode
import struct
import subprocess
import sys
import time

PACKAGE = "org.blender.blender"
TOKEN_FILE = Path.home() / ".ai_blender_bridge" / "token"

def adb(*args, timeout=20):
    return subprocess.run(["adb", *args], check=True, capture_output=True,
                          timeout=timeout).stdout

def main():
    if not TOKEN_FILE.is_file():
        raise SystemExit("Blender Bridge token missing; start bridge_server.py first.")
    devices = [line.split()[0] for line in adb("devices").decode().splitlines()[1:]
               if line.strip().endswith("\tdevice")]
    if len(devices) != 1:
        raise SystemExit("Expected exactly one connected ADB device: run adb devices")
    token = TOKEN_FILE.read_text(encoding="ascii").strip()
    bootstrap = ("import urllib.request; exec(urllib.request.urlopen("
                 f"'http://127.0.0.1:8765/bootstrap?token={token}',timeout=6)"
                 ".read().decode('utf-8'))")
    code64 = base64.b64encode(bootstrap.encode("ascii")).decode("ascii")
    expression = "exec(__import__('base64').b64decode('" + code64 + "'))"
    print("BlenderのPython Consoleを表示してください。10秒後に自動入力します。", flush=True)
    print("入力先は画面中央の大きなConsoleの最下部 >>> です。ほかの画面に移った場合はCtrl+Cで中止。", flush=True)
    time.sleep(10)
    from importlib.util import spec_from_file_location, module_from_spec
    spec = spec_from_file_location("phone_bridge", str(Path.home() / "ai-phone-bridge" / "phone_bridge.py"))
    if spec is None or spec.loader is None:
        raise SystemExit("phone_bridge.py not found")
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    actual = module.foreground_package()
    if actual != PACKAGE:
        raise SystemExit(f"Blender is not foreground ({actual}); no keyboard input sent")
    png = adb("exec-out", "screencap", "-p", timeout=25)
    if not png.startswith(b"\x89PNG\r\n\x1a\n"):
        raise SystemExit("Could not read Android screen size; refusing to tap")
    w, h = struct.unpack(">II", png[16:24])
    if not (300 <= w <= 5000 and 300 <= h <= 5000):
        raise SystemExit("Unexpected screen size; refusing to tap")
    # Focus the center Console's bottom prompt (screenshot-verified layout).
    x, y = round(w * .34), round(h * .970)
    print(f"Console focus tap: {x},{y} / {w}x{h}", flush=True)
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(1.0)
    # shlex.quote is for the remote Android shell, not for Python syntax.
    command = "input text " + shlex.quote(expression)
    adb("shell", command, timeout=45)
    # Connect to the existing local bridge, and verify the live heartbeat.
    print("入力しました。Enterも自動で押します。", flush=True)
    adb("shell", "input", "keyevent", "66")
    time.sleep(6)
    url = "http://127.0.0.1:8765/status?" + urlencode({"token": token})
    try:
        with urlopen(url, timeout=5) as response:
            data = json.load(response)
        last_seen = float(data.get("status", {}).get("blender_last_seen") or 0)
        age = time.time() - last_seen
        print("最終通信から:", round(age, 1), "秒", flush=True)
        if age < 10:
            print("CONNECTED: Blenderとの通信が復活しました。", flush=True)
            print("待機中:", data.get("pending"), flush=True)
            print("直近の結果:", data.get("status", {}).get("last_result"), flush=True)
        else:
            print("NOT CONNECTED: 文字入力に失敗したか、Consoleの位置が違います。", flush=True)
            print("Blender画面とこの出力を送ってください（トークンは貼らない）。", flush=True)
    except Exception as exc:
        print("通信診断失敗:", type(exc).__name__, str(exc)[:140], flush=True)

if __name__ == "__main__":
    try:
        main()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as exc:
        print("ADB error:", exc, file=sys.stderr)
        sys.exit(1)
