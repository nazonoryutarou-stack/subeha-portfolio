#!/usr/bin/env python3
"""AI Phone Bridge: user-armed, allowlisted Android ADB actions via Termux.

Intentionally not an unrestricted remote shell. It never unlocks the device,
installs apps, changes settings, grants permissions, or accepts arbitrary shell.
Every input action is gated by a local short-lived consent lease and a strict
foreground package allowlist. Optional private image reporting is OFF by default.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import hmac
import html
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

ROOT = Path.home() / ".ai_phone_bridge"
DATA = ROOT / "data"
DATA.mkdir(parents=True, exist_ok=True)
CONFIG_PATH = ROOT / "config.json"
STATE_PATH = ROOT / "state.json"
CONSENT_PATH = ROOT / "consent.json"
SCREENSHOT_PATH = DATA / "latest.png"
TOKEN_PATH = ROOT / "dashboard_token"
REPORT_TOKEN_PATH = ROOT / "github_report_token"
DEFAULT_REMOTE = "https://raw.githubusercontent.com/nazonoryutarou-stack/subeha-portfolio/main/tools/ai-phone-bridge/jobs/current.json"
MAX_JOB_BYTES = 40_000
ALLOWED_OPS = frozenset(("status", "snapshot", "tap", "swipe", "back", "home", "wait"))
PACKAGE_RE = re.compile(r"^[a-zA-Z_][a-zA-Z_0-9]*(?:\.[a-zA-Z_0-9]+)+$")
SAFE_REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def json_load(path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return fallback


def json_save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".tmp-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            json.dump(value, out, ensure_ascii=False, indent=2)
            out.write("\n")
        os.chmod(name, 0o600)
        os.replace(name, path)
    finally:
        try:
            os.remove(name)
        except FileNotFoundError:
            pass


def config():
    c = json_load(CONFIG_PATH, {})
    return {"allowed_packages": c.get("allowed_packages", []),
            "remote_url": c.get("remote_url", DEFAULT_REMOTE),
            "private_report_repo": c.get("private_report_repo", ""),
            "private_command_repo": c.get("private_command_repo", ""),
            "capture_after_actions": bool(c.get("capture_after_actions", True)),
            "poll_seconds": int(c.get("poll_seconds", 30))}


def state():
    st = json_load(STATE_PATH, {})
    lease = json_load(CONSENT_PATH, {})
    return {"armed_until": float(lease.get("armed_until", 0)),
            "completed": list(st.get("completed", []))[-50:],
            "last_result": st.get("last_result")}


def adb(*arguments, timeout=12, capture=True):
    """Never execute a shell string; fixed subprocess argv only."""
    try:
        return subprocess.run(["adb", *map(str, arguments)], stdout=subprocess.PIPE if capture else None,
                              stderr=subprocess.PIPE, check=True, timeout=timeout)
    except FileNotFoundError:
        raise RuntimeError("adb がない: pkg install android-tools")
    except subprocess.TimeoutExpired:
        raise RuntimeError("ADB が応答しない。ワイヤレスデバッグ接続を確認")
    except subprocess.CalledProcessError as e:
        raise RuntimeError((e.stderr or b"ADB command failed").decode("utf-8", "replace")[-220:])


def device_ok():
    lines = adb("devices").stdout.decode("utf-8", "replace").splitlines()[1:]
    connected = [l.split()[0] for l in lines if l.strip().endswith("\tdevice")]
    if len(connected) != 1:
        raise RuntimeError("ADB 接続が1台ではない: adb devices を確認")
    return connected[0]


def foreground_package():
    # Window names vary between Android versions; never guess if ambiguous.
    for cmd in (("shell", "dumpsys", "window", "windows"), ("shell", "dumpsys", "activity", "activities")):
        out = adb(*cmd, timeout=15).stdout.decode("utf-8", "replace")
        for pattern in (r"mCurrentFocus=Window\{[^\n]*?\s([A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_0-9]+)+)/",
                        r"mResumedActivity:[^\n]*?\s([A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_0-9]+)+)/",
                        r"topResumedActivity=[^\n]*?\s([A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_0-9]+)+)/"):
            match = re.search(pattern, out)
            if match:
                return match.group(1)
    raise RuntimeError("画面のアプリを確認できないため操作を拒否")


def screen_dimensions():
    text = adb("shell", "wm", "size").stdout.decode("utf-8", "replace")
    matches = re.findall(r"(\d{2,5})x(\d{2,5})", text)
    if not matches:
        raise RuntimeError("画面解像度を取得できない")
    w, h = map(int, matches[-1])
    if not (100 <= w <= 10000 and 100 <= h <= 10000):
        raise RuntimeError("画面解像度が不正")
    return w, h


def screenshot():
    device_ok()
    data = adb("exec-out", "screencap", "-p", timeout=25).stdout
    if not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data) > 12_000_000:
        raise RuntimeError("画面キャプチャに失敗、または画像が大きすぎる")
    path = SCREENSHOT_PATH
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(data)
    os.chmod(tmp, 0o600)
    tmp.replace(path)
    return path


def validate_job(job):
    if not isinstance(job, dict):
        raise ValueError("job must be a JSON object")
    jid = job.get("id")
    if not isinstance(jid, str) or not (3 <= len(jid) <= 70) or not re.fullmatch(r"[a-zA-Z0-9_.-]+", jid):
        raise ValueError("invalid job id")
    package = job.get("target_package")
    if package is not None and (not isinstance(package, str) or not PACKAGE_RE.fullmatch(package)):
        raise ValueError("invalid target package")
    steps = job.get("steps")
    if not isinstance(steps, list) or not (1 <= len(steps) <= 12):
        raise ValueError("job must have 1–12 steps")
    inputs = 0
    for step in steps:
        if not isinstance(step, dict) or step.get("op") not in ALLOWED_OPS:
            raise ValueError("unsupported operation")
        op = step["op"]
        if op in ("tap", "swipe"):
            keys = ("x", "y") if op == "tap" else ("x", "y", "to_x", "to_y")
            for key in keys:
                val = step.get(key)
                if type(val) not in (int, float) or not (0 <= val <= 1):
                    raise ValueError("tap/swipe coordinates must be normalized between 0 and 1")
            if op == "swipe" and (type(step.get("ms", 320)) is not int or not (80 <= step.get("ms", 320) <= 1300)):
                raise ValueError("swipe duration invalid")
            inputs += 1
        elif op in ("back", "home"):
            inputs += 1
        elif op == "wait":
            if type(step.get("seconds", 0.5)) not in (int, float) or not (0 <= step.get("seconds", .5) <= 3):
                raise ValueError("wait duration invalid")
    if inputs > 8:
        raise ValueError("job exceeds action limit")
    if inputs and not package:
        raise ValueError("input job requires target_package")
    if inputs or any(step["op"] == "snapshot" for step in steps):
        expires_at = job.get("expires_at")
        now = time.time()
        if type(expires_at) not in (int, float) or not (now <= expires_at <= now + 900):
            raise ValueError("screen/input job needs expires_at within 15 minutes of now (Unix seconds)")
    if len(json.dumps(job, ensure_ascii=False).encode()) > MAX_JOB_BYTES:
        raise ValueError("job too large")
    return jid


def authorized_foreground(package):
    c = config()
    if package not in c["allowed_packages"]:
        raise PermissionError("アプリが明示許可リストにない: " + str(package))
    actual = foreground_package()
    if actual != package:
        raise PermissionError(f"実際の前面アプリは {actual}：操作拒否（必要: {package}）")


def consent_active():
    return time.time() <= state()["armed_until"]


def step_execute(step, target):
    op = step["op"]
    if op == "status":
        return {"app": foreground_package(), "resolution": screen_dimensions()}
    if op == "snapshot":
        # Require a locally armed session and an allowlisted active app,
        # because a screenshot may contain passwords, chats and other private data.
        if not consent_active():
            raise PermissionError("画面取得にはローカルの操作許可が必要: arm")
        authorized_foreground(target)
        path = screenshot()
        return {"screenshot": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    if op == "wait":
        time.sleep(step.get("seconds", .5))
        return {"waited": step.get("seconds", .5)}
    if not consent_active():
        raise PermissionError("ローカル操作許可が期限切れ: arm")
    authorized_foreground(target)
    if op == "tap":
        w, h = screen_dimensions()
        x, y = min(w-1, int(step["x"]*w)), min(h-1, int(step["y"]*h))
        adb("shell", "input", "tap", x, y)
        return {"tap": [x, y]}
    if op == "swipe":
        w, h = screen_dimensions()
        xy = [min(w-1, int(step[k]*(w if k.endswith("x") else h))) for k in ("x", "y", "to_x", "to_y")]
        adb("shell", "input", "swipe", *xy, step.get("ms", 320))
        return {"swipe": xy}
    if op in ("back", "home"):
        # HOME deliberately exits the allowlisted app; further inputs then fail.
        adb("shell", "input", "keyevent", "KEYCODE_BACK" if op == "back" else "KEYCODE_HOME")
        return {"key": op}
    raise ValueError("unknown operation")


def run_job(job, *, capture=True):
    jid = validate_job(job)
    st = state()
    if jid in st["completed"]:
        return {"id": jid, "already_completed": True}
    target = job.get("target_package")
    if target and target not in config()["allowed_packages"]:
        raise PermissionError("対象アプリが許可されていません: " + target)
    # The operator must have armed the phone BEFORE the job begins.
    if any(x["op"] in ("snapshot", "tap", "swipe", "back", "home") for x in job["steps"]):
        if not consent_active():
            raise PermissionError("操作未許可: Termux から arm してから実行")
        authorized_foreground(target)
    # Journal the ID BEFORE making a single change to the phone.
    # A force-closed Termux process must never replay partially completed taps.
    journal = json_load(STATE_PATH, {})
    journal["completed"] = (list(journal.get("completed", [])) + [jid])[-50:]
    journal["last_result"] = {"id": jid, "ok": False, "status": "started; result not yet confirmed"}
    json_save(STATE_PATH, journal)
    trace = []
    last_image = None
    ok = True
    error = None
    for step in job["steps"]:
        op = step["op"]
        try:
            step_result = step_execute(step, target)
            trace.append({"op": op, "result": step_result})
            if op == "snapshot":
                last_image = step_result["screenshot"]
            if capture and op in ("tap", "swipe", "back") and consent_active():
                try:
                    # Only capture if the app is STILL the allowlisted one.
                    authorized_foreground(target)
                    last_image = str(screenshot())
                except Exception:
                    pass
        except (PermissionError, RuntimeError, ValueError) as exc:
            # An input job may have partially mutated the UI. Never automatically
            # repeat an already-started sequence on the next poll.
            if not trace and isinstance(exc, PermissionError):
                raise  # Not armed / wrong foreground: remain pending.
            ok = False
            error = type(exc).__name__ + ": " + str(exc)[:180]
            trace.append({"op": op, "error": error})
            break
    result = {"id": jid, "ok": ok, "steps": trace, "image": last_image,
              "finished_at": int(time.time())}
    if error:
        result["error"] = error
    # Do not write to the consent lease here; local disarm is independent.
    latest = json_load(STATE_PATH, {})
    latest["completed"] = (list(latest.get("completed", [])) + [jid])[-50:]
    latest["last_result"] = result
    json_save(STATE_PATH, latest)
    return result


def fetch_remote():
    c = config()
    if c["private_command_repo"]:
        repo = c["private_command_repo"]
        token = REPORT_TOKEN_PATH.read_text(encoding="ascii").strip()
        meta = private_repo_request(repo, "", token)
        if meta.get("private") is not True:
            raise PermissionError("private commands require a private repository")
        payload = private_repo_request(repo, "/contents/ai-phone-bridge/jobs/current.json?ref=main", token)
        data = base64.b64decode(payload["content"], validate=False)
    else:
        url = c["remote_url"]
        if not url.startswith("https://raw.githubusercontent.com/nazonoryutarou-stack/subeha-portfolio/"):
            raise ValueError("remote URL is not the approved project source")
        req = Request(url + "?v=" + str(int(time.time() // 30)), headers={"Cache-Control": "no-cache", "User-Agent": "AIPhoneBridge/0.1"})
        with urlopen(req, timeout=12) as response:
            data = response.read(MAX_JOB_BYTES + 1)
    if len(data) > MAX_JOB_BYTES:
        raise ValueError("remote job too large")
    job = json.loads(data.decode("utf-8"))
    validate_job(job)
    return job


def private_repo_request(repo, path, token, method="GET", payload=None):
    url = "https://api.github.com/repos/" + quote(repo, safe="/") + path
    headers = {"Accept": "application/vnd.github+json", "Authorization": "Bearer " + token,
               "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "AIPhoneBridge/0.1"}
    body = json.dumps(payload).encode() if payload is not None else None
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = Request(url, headers=headers, data=body, method=method)
    with urlopen(req, timeout=18) as response:
        return json.loads(response.read(4_000_000).decode())


def upload_private(repo, path, filename, token):
    # Check repository metadata every time. Never allow screenshot into public repos.
    meta = private_repo_request(repo, "", token)
    if meta.get("private") is not True:
        raise PermissionError("画像送信先は非公開GitHubリポジトリに限定")
    raw = filename.read_bytes()
    if len(raw) > 5_000_000:
        raise ValueError("private screenshot too large")
    remote_path = "/contents/ai-phone-bridge/" + quote(path, safe="")
    sha = None
    try:
        cur = private_repo_request(repo, remote_path, token)
        sha = cur.get("sha")
    except Exception as e:
        # 404 means file is new; other errors are not silently ignored.
        from urllib.error import HTTPError
        if not isinstance(e, HTTPError) or e.code != 404:
            raise
    body = {"message": "Update AI Phone Bridge snapshot (private)",
            "content": base64.b64encode(raw).decode("ascii"), "branch": "main"}
    if sha:
        body["sha"] = sha
    return private_repo_request(repo, remote_path, token, method="PUT", payload=body)


def report_if_enabled(result):
    repo = config()["private_report_repo"]
    if not repo:
        return "private reporting disabled"
    token = REPORT_TOKEN_PATH.read_text(encoding="ascii").strip()
    # Deliberately upload only the one screenshot from this job, after explicit opt-in.
    if result.get("image") and consent_active() and SCREENSHOT_PATH.exists():
        upload_private(repo, "latest.png", SCREENSHOT_PATH, token)
    tmp = ROOT / "result.json"
    safe = {"id": result.get("id"), "ok": result.get("ok"), "finished_at": result.get("finished_at"),
            "steps": [{"op": x.get("op")} for x in result.get("steps", [])]}
    json_save(tmp, safe)
    upload_private(repo, "latest.json", tmp, token)
    return "reported to private repo"


def get_dashboard_token():
    if TOKEN_PATH.exists():
        return TOKEN_PATH.read_text(encoding="ascii").strip()
    token = secrets.token_urlsafe(24)
    fd = os.open(TOKEN_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="ascii") as f:
        f.write(token)
    return token


class Dashboard(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        if not hmac.compare_digest(q.get("token", [""])[0], get_dashboard_token()):
            self.send_error(403, "Local token required")
            return
        route = urlparse(self.path).path
        if route == "/image" and SCREENSHOT_PATH.exists():
            body = SCREENSHOT_PATH.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
        elif route == "/":
            st, c = state(), config()
            armed = max(0, int(st["armed_until"]-time.time()))
            token = get_dashboard_token()
            image = '<img style="max-width:100%;border:1px solid #345" src="/image?token='+token+'">' if SCREENSHOT_PATH.exists() else '<p>No screenshot yet.</p>'
            body = ("<!doctype html><html lang='ja'><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>"
                    "<title>AI Phone Bridge</title><style>body{font:15px sans-serif;background:#101720;color:#eef5ff;padding:16px;max-width:740px;margin:auto}"
                    "pre{white-space:pre-wrap;overflow-wrap:anywhere}h1{font-size:24px}</style><h1>AI PHONE BRIDGE</h1>"
                    "<p>ローカル専用・リモート操作の許可はTermuxから</p><p>操作許可の残り: " + str(armed) + "秒</p><p>許可されたアプリ: "
                    + html.escape(", ".join(c["allowed_packages"])) + "</p><h2>最新のスクリーンショット</h2>" + image
                    + "<h2>最終作業</h2><pre>" + html.escape(json.dumps(st["last_result"], ensure_ascii=False, indent=2)[:4500]) + "</pre></html>").encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
        else:
            self.send_error(404)
            return
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run_poll(once=False):
    c = config()
    print("[bridge] remote:", c["remote_url"], flush=True)
    print("[bridge] allowlist:", c["allowed_packages"], flush=True)
    print("[bridge] press Ctrl+C to stop", flush=True)
    while True:
        try:
            job = fetch_remote()
            jid = job["id"]
            if jid not in state()["completed"]:
                result = run_job(job, capture=c["capture_after_actions"])
                print("[bridge] done:", jid, result.get("ok"), flush=True)
                try:
                    print("[bridge] report:", report_if_enabled(result), flush=True)
                except Exception as e:
                    print("[bridge] private report error:", str(e)[:200], flush=True)
        except (ValueError, PermissionError, RuntimeError, OSError) as e:
            print("[bridge] blocked/error:", type(e).__name__, str(e)[:200], flush=True)
        except Exception as e:
            print("[bridge] network/error:", type(e).__name__, str(e)[:200], flush=True)
        if once:
            break
        time.sleep(max(15, min(300, c["poll_seconds"])))


def main(argv=None):
    ap = argparse.ArgumentParser(description="User-consented local Android ADB control bridge")
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("doctor")
    p = sp.add_parser("allow"); p.add_argument("package")
    p = sp.add_parser("remove"); p.add_argument("package")
    p = sp.add_parser("arm"); p.add_argument("minutes", type=int, nargs="?", default=5)
    sp.add_parser("disarm")
    sp.add_parser("snapshot")
    sp.add_parser("status")
    sp.add_parser("once")
    sp.add_parser("run")
    sp.add_parser("serve")
    p = sp.add_parser("private-report"); p.add_argument("repo")
    sp.add_parser("private-report-off")
    a = ap.parse_args(argv)
    if a.cmd == "doctor":
        print("adb device:", device_ok(), "; front app:", foreground_package(), "; screen:", screen_dimensions())
    elif a.cmd == "allow":
        if not PACKAGE_RE.fullmatch(a.package) or a.package in ("com.android.systemui", "com.android.settings"):
            ap.error("invalid/unsafe package; do not allow System UI or Settings")
        c = config();c["allowed_packages"] = sorted(set(c["allowed_packages"]) | {a.package});json_save(CONFIG_PATH,c)
        print("APP ALLOWED:", a.package)
    elif a.cmd == "remove":
        c=config();c["allowed_packages"] = [x for x in c["allowed_packages"] if x != a.package];json_save(CONFIG_PATH,c)
        print("APP REMOVED:", a.package)
    elif a.cmd == "arm":
        if not 1 <= a.minutes <= 10:ap.error("arm is limited to 1-10 minutes")
        device_ok()
        json_save(CONSENT_PATH,{"armed_until":time.time()+60*a.minutes})
        print(f"ARMED for {a.minutes} minutes. To stop immediately: python phone_bridge.py disarm")
    elif a.cmd == "disarm":
        json_save(CONSENT_PATH,{"armed_until":0});print("DISARMED")
    elif a.cmd == "snapshot":
        if not consent_active():raise PermissionError("first arm locally")
        pkg=foreground_package();authorized_foreground(pkg)
        print("Screenshot:",screenshot(),"(local only; not uploaded)")
    elif a.cmd == "status":
        print(json.dumps({"config":config(),"state":state()},ensure_ascii=False,indent=2))
    elif a.cmd == "once":run_poll(once=True)
    elif a.cmd == "run":run_poll()
    elif a.cmd == "serve":
        t=get_dashboard_token()
        print("Local dashboard: http://127.0.0.1:8766/?token="+t)
        print("CTRL+C stops dashboard; no network access outside the phone")
        ThreadingHTTPServer(("127.0.0.1",8766),Dashboard).serve_forever()
    elif a.cmd == "private-report":
        if not SAFE_REPO_RE.fullmatch(a.repo):ap.error("repo must be owner/private-repo")
        if not REPORT_TOKEN_PATH.exists():
            ap.error("create ~/.ai_phone_bridge/github_report_token locally (chmod 600); do not share token")
        token=REPORT_TOKEN_PATH.read_text(encoding="ascii").strip()
        meta=private_repo_request(a.repo,"",token)
        if meta.get("private") is not True:ap.error("destination is not private")
        c=config();c["private_report_repo"]=a.repo;c["private_command_repo"]=a.repo;json_save(CONFIG_PATH,c)
        print("PRIVATE COMMANDS + REPORTING ON. Authorized images may upload to:", a.repo)
        print("Create ai-phone-bridge/jobs/current.json in this private repo before starting the poller.")
    elif a.cmd == "private-report-off":
        c=config();c["private_report_repo"]="";c["private_command_repo"]="";json_save(CONFIG_PATH,c)
        print("PRIVATE REPORTING OFF (public test command source restored)")
    return 0


if __name__ == "__main__":
    try: sys.exit(main())
    except (PermissionError, RuntimeError, ValueError) as e:
        print("[bridge]",type(e).__name__,str(e),file=sys.stderr)
        sys.exit(2)