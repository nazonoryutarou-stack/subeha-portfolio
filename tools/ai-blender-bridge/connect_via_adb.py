#!/usr/bin/env python3
"""One-shot, foreground-checked Android Blender Console reconnect via ADB.

Only operates on org.blender.blender. Sends a bootstrap expression, never a
general remote command. User must have the Python Console visible.
"""
import base64
from pathlib import Path
import shlex
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
    print("入力先はConsole右側の最下部 >>> です。ほかの画面に移った場合はCtrl+Cで中止。", flush=True)
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
    x, y = round(w * .53), round(h * .93)
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(.5)
    # shlex.quote is for the remote Android shell, not for Python syntax.
    command = "input text " + shlex.quote(expression)
    adb("shell", command, timeout=45)
    # Android's virtual keyboard may not faithfully type Python punctuation.
    # Enter is intentionally left to the user, so the typed expression can
    # be inspected before executing.
    print("Consoleに文字を入力しました。入力内容が正しければEnterを押してください。")
    print("実行後 [AI Bridge] ACTIVE が表示されれば接続完了。")
    print("Note: if characters were lost, do NOT press Enter; clear the line.")

if __name__ == "__main__":
    try:
        main()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as exc:
        print("ADB error:", exc, file=sys.stderr)
        sys.exit(1)
