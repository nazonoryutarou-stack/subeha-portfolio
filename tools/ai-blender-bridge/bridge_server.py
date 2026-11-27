#!/usr/bin/env python3
"""AI Blender Bridge v0.1 — Termux loopback relay; Python stdlib only.

Starts a local server, polls one public GitHub JSON instruction file, and
provides a Blender Python agent over localhost. No public ports, cloud keys,
or arbitrary remote Python evaluation. Run explicitly from Termux.
"""
import argparse
import collections
import html
import json
import os
from pathlib import Path
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse, quote
from urllib.request import Request, urlopen

APP_DIR = Path(__file__).resolve().parent
DATA_DIR = Path.home() / ".ai_blender_bridge"
DATA_DIR.mkdir(parents=True, exist_ok=True)
TOKEN_FILE = DATA_DIR / "token"
STATE_FILE = DATA_DIR / "state.json"
OUTPUT_DIR = DATA_DIR / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
JOB_URL = "https://raw.githubusercontent.com/nazonoryutarou-stack/subeha-portfolio/main/tools/ai-blender-bridge/jobs/current.json"
AGENT_FILE = APP_DIR / "blender_agent.py"
OPERATIONS = {"reset", "box", "cylinder", "sphere", "mesh", "material", "light", "camera", "world", "render_settings", "render", "save", "restore", "status"}
MAX_JOB_BYTES = 512_000
MAX_ARTIFACT_BYTES = 20 * 1024 * 1024


def read_token():
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text(encoding="ascii").strip()
    token = secrets.token_hex(18)
    fd = os.open(TOKEN_FILE, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="ascii") as f:
        f.write(token + "\n")
    return token

TOKEN = read_token()
LOCK = threading.RLock()
PENDING = collections.deque()
INFLIGHT = {}
STATUS = {"blender_last_seen": 0, "github_last_check": None, "github_error": None, "last_result": None}


def load_state():
    try:
        d = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if isinstance(d, dict):
            return d
    except (OSError, ValueError):
        pass
    return {"completed": [], "rejected": []}

STATE = load_state()


def save_state():
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(STATE, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STATE_FILE)


def verify_job(job):
    if not isinstance(job, dict):
        raise ValueError("job must be an object")
    jid = job.get("id")
    if not isinstance(jid, str) or not (3 <= len(jid) <= 80) or not all(c.isalnum() or c in "-_." for c in jid):
        raise ValueError("id must be 3-80 ASCII-safe characters")
    steps = job.get("steps")
    if not isinstance(steps, list) or not (1 <= len(steps) <= 240):
        raise ValueError("steps must contain 1-240 commands")
    total_vertices = 0
    for i, step in enumerate(steps):
        if not isinstance(step, dict) or step.get("op") not in OPERATIONS:
            raise ValueError(f"invalid operation at step {i}")
        if step["op"] == "mesh":
            if len(step.get("vertices", [])) > 12000 or len(step.get("faces", [])) > 16000:
                raise ValueError("mesh too large")
            total_vertices += len(step["vertices"])
        elif step["op"] in ("box", "cylinder", "sphere"):
            total_vertices += 320
        if total_vertices > 100000:
            raise ValueError("job exceeds mobile geometry budget")
    if len(json.dumps(job, ensure_ascii=False).encode()) > MAX_JOB_BYTES:
        raise ValueError("job too large")
    return jid


def enqueue(job, source="github"):
    jid = verify_job(job)
    with LOCK:
        if jid in STATE["completed"] or jid in INFLIGHT or jid in {j["id"] for j in PENDING}:
            return False
        PENDING.append(job)
        STATUS["last_enqueue"] = {"id": jid, "source": source, "time": time.time()}
    print("[bridge] queued", jid, "from", source, flush=True)
    return True


def github_loop(interval=60):
    while True:
        try:
            req = Request(JOB_URL + "?nonce=" + str(int(time.time() // 45)), headers={"User-Agent": "TermuxBlenderBridge/0.1", "Accept": "application/json", "Cache-Control": "no-cache"})
            with urlopen(req, timeout=12) as response:
                data = response.read(MAX_JOB_BYTES + 1)
            if len(data) > MAX_JOB_BYTES:
                raise ValueError("online job oversized")
            job = json.loads(data)
            enqueue(job)
            with LOCK:
                STATUS["github_error"] = None
                STATUS["github_last_check"] = time.time()
        except Exception as exc:
            with LOCK:
                STATUS["github_error"] = str(exc)[:240]
                STATUS["github_last_check"] = time.time()
            print("[bridge] GitHub check:", type(exc).__name__, exc, flush=True)
        time.sleep(interval)


def latest_kowloon_checkpoint():
    """Only completed Kowloon models; never choose before-restore backups or PNGs."""
    allowed_suffixes = (
        "_completed-kowloon.blend",
        "_restored-persistent.blend",
        "_checkpoint.blend",
        "_autosave.blend",
    )
    matches = [
        p for p in OUTPUT_DIR.iterdir()
        if p.is_file() and p.name.endswith(allowed_suffixes)
        and (p.name.startswith("kowloon-") or p.name.startswith("kowloon_"))
        and 64 <= p.stat().st_size <= MAX_ARTIFACT_BYTES
    ]
    if not matches:
        return None
    latest = max(matches, key=lambda p: (p.stat().st_mtime_ns, p.name))
    return {"filename": latest.name, "size": latest.stat().st_size,
            "modified": latest.stat().st_mtime}


def local_demo():
    return {
        "id": "local-demo-" + str(int(time.time() * 1000)),
        "title": "Local connectivity and Blender modelling test",
        "steps": [
            {"op": "reset"},
            {"op": "box", "name": "AI_Bridge_Floor", "location": [0, 0, -0.15], "size": [8, 7, .3], "material": {"name": "Warm concrete", "color": [.52,.50,.45,1], "roughness": .86}},
            {"op": "box", "name": "AI_Bridge_Tabletop", "location": [0, 0, 1.0], "size": [2.6, 1.4, .14], "bevel": .06, "material": {"name": "Oak wood", "color": [.36,.19,.09,1], "roughness": .42}},
            {"op": "cylinder", "name": "AI_Bridge_Lamp", "location": [1.6, .4, .95], "radius": .17, "depth": 1.9, "material": {"name": "Brushed steel", "color": [.28,.33,.37,1], "metallic": .75}},
            {"op": "sphere", "name": "AI_Bridge_Orb", "location": [-1, 0, 1.8], "radius": .54, "material": {"name": "Amber glass test", "color": [.93,.21,.04,1], "metallic": .22, "roughness": .16}},
            {"op": "light", "name": "Softbox", "type": "AREA", "location": [-3, 3, 5], "target": [0, 0, 1], "energy": 850, "size": 5.0},
            {"op": "camera", "location": [7, -9, 5], "target": [0,0,1], "lens": 33},
            {"op": "world", "color": [.16, .18, .22], "strength": .48},
            {"op": "status"}
        ]
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "AI-Blender-Bridge/0.1"

    def log_message(self, fmt, *args):
        if os.environ.get("BRIDGE_VERBOSE"):
            super().log_message(fmt, *args)

    def reply_json(self, value, code=200):
        b = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def get_token(self):
        q = parse_qs(urlparse(self.path).query)
        return q.get("token", [""])[0]

    def authorized(self):
        if not secrets.compare_digest(self.get_token(), TOKEN):
            self.reply_json({"error": "unauthorized"}, 403)
            return False
        return True

    def do_GET(self):
        route = urlparse(self.path).path
        if not self.authorized():
            return
        if route == "/bootstrap":
            try:
                code = AGENT_FILE.read_text(encoding="utf-8")
            except OSError as ex:
                return self.reply_json({"error": str(ex)}, 500)
            data = ("BRIDGE_TOKEN = " + repr(TOKEN) + "\n" + code).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/x-python; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            return self.wfile.write(data)
        if route == "/latest-kowloon":
            return self.reply_json({"latest": latest_kowloon_checkpoint()})
        if route == "/next":
            with LOCK:
                STATUS["blender_last_seen"] = time.time()
                if PENDING:
                    job = PENDING.popleft()
                    INFLIGHT[job["id"]] = time.time()
                else:
                    job = None
            return self.reply_json({"job": job})
        if route == "/status":
            with LOCK:
                return self.reply_json({"pending": [j["id"] for j in PENDING], "inflight": list(INFLIGHT), "completed": STATE["completed"][-12:], "status": dict(STATUS)})
        if route == "/":
            with LOCK:
                status = dict(STATUS)
                queued = list(PENDING)
                output_list = [p.name for p in OUTPUT_DIR.iterdir() if p.is_file()][:35]
                completed = STATE["completed"][-10:]
            seen = status.get("blender_last_seen", 0)
            online = "🟢 Blender connection detected" if seen and time.time() - seen < 15 else "⚪ Blender not connected"
            items = "".join("<li>" + html.escape(j["id"]) + "</li>" for j in queued) or "<li>No queued jobs</li>"
            items2 = "".join("<li>" + html.escape(j) + "</li>" for j in completed) or "<li>No completed jobs</li>"
            outputs = "".join('<li><a href="/output/'+quote(n)+'?token='+TOKEN+'">'+html.escape(n)+'</a></li>' for n in output_list)
            result = status.get("last_result")
            body = '''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AI Blender Bridge</title><style>body{font:16px system-ui;background:#111b26;color:#eff6fb;padding:22px;max-width:760px;margin:auto}h1{font-size:26px}code,pre{background:#263747;padding:7px;border-radius:7px;overflow-wrap:anywhere;white-space:pre-wrap}a{color:#83d5ff}button{background:#fa954e;color:#1c120c;padding:12px 24px;border:0;border-radius:8px;font-weight:700}section{border:1px solid #354b5a;border-radius:12px;padding:14px;margin:12px 0}</style><h1>AI BLENDER BRIDGE / 0.1</h1><p>'''+html.escape(online)+'''</p><section><h2>Local test</h2><form action="/demo?token='''+TOKEN+'''" method="POST"><button type="submit">Create demo modelling job</button></form><p>Only commands from the allowlist are accepted. Reset affects the dedicated AI scene.</p></section><section><h2>Pending</h2><ul>'''+items+'''</ul><h2>Completed</h2><ul>'''+items2+'''</ul></section><section><h2>Last result</h2><pre>'''+html.escape(json.dumps(result, ensure_ascii=False, indent=2) if result else "None")+'''</pre></section><section><h2>Saved output files</h2><ul>'''+outputs+'''</ul></section><p>GitHub: '''+html.escape(status.get("github_error") or "online / no error")+'''</p><p><a href="/?token='''+TOKEN+'''">Refresh</a></p></html>'''
            data = body.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return self.wfile.write(data)
        if route.startswith("/output/"):
            name = route[len("/output/"):]
            if name not in {p.name for p in OUTPUT_DIR.iterdir() if p.is_file()}:
                return self.reply_json({"error": "not found"}, 404)
            f = OUTPUT_DIR / name
            data = f.read_bytes()
            typ = "image/png" if name.endswith(".png") else "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", typ)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            return self.wfile.write(data)
        self.reply_json({"error": "route not found"}, 404)

    def do_POST(self):
        route = urlparse(self.path).path
        if not self.authorized():
            return
        if route == "/demo":
            added = enqueue(local_demo(), "local")
            self.send_response(303)
            self.send_header("Location", "/?token="+TOKEN)
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > (MAX_ARTIFACT_BYTES if route == "/artifact" else MAX_JOB_BYTES):
            return self.reply_json({"error": "body length invalid"}, 413)
        raw = self.rfile.read(length)
        if route == "/submit":
            try:
                job = json.loads(raw)
                added = enqueue(job, "localhost")
                return self.reply_json({"queued": added, "id": job["id"]})
            except Exception as exc:
                return self.reply_json({"error": str(exc)}, 422)
        if route == "/result":
            try:
                msg = json.loads(raw)
                jid = str(msg.get("id", ""))
                with LOCK:
                    if jid not in INFLIGHT:
                        return self.reply_json({"error": "job is not inflight"}, 409)
                    del INFLIGHT[jid]
                    if jid not in STATE["completed"]:
                        STATE["completed"].append(jid)
                        STATE["completed"] = STATE["completed"][-200:]
                    STATUS["last_result"] = {k: msg.get(k) for k in ("id", "ok", "message", "elapsed", "step", "object_count")}
                    save_state()
                print("[bridge] RESULT:", jid, "OK" if msg.get("ok") else "ERROR", msg.get("message", ""), flush=True)
                return self.reply_json({"ok": True})
            except Exception as exc:
                return self.reply_json({"error": str(exc)}, 422)
        if route == "/artifact":
            name = parse_qs(urlparse(self.path).query).get("name", ["preview.png"])[0]
            if not name.endswith((".png", ".glb", ".blend")) or len(name) > 90 or any(c not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-" for c in name):
                return self.reply_json({"error": "filename refused"}, 422)
            path = OUTPUT_DIR / name
            path.write_bytes(raw)
            # Keep local artifacts bounded. A phone must not silently fill its storage.
            candidates = sorted((f for f in OUTPUT_DIR.iterdir() if f.is_file()), key=lambda f: f.stat().st_mtime)
            while sum(f.stat().st_size for f in candidates) > 100 * 1024 * 1024 and len(candidates) > 1:
                oldest = candidates.pop(0)
                oldest.unlink(missing_ok=True)
            return self.reply_json({"ok": True, "bytes": len(raw), "filename": name})
        self.reply_json({"error": "route not found"}, 404)


def main():
    parser = argparse.ArgumentParser(description="AI Blender Bridge (Termux local relay)")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-github", action="store_true", help="disable GitHub job watcher for local testing")
    args = parser.parse_args()
    if not AGENT_FILE.is_file():
        raise SystemExit("Missing blender_agent.py in " + str(APP_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    if not args.no_github:
        threading.Thread(target=github_loop, name="GitHub-watcher", daemon=True).start()
    url = f"http://127.0.0.1:{args.port}"
    bootstrap = f"import urllib.request; exec(urllib.request.urlopen('{url}/bootstrap?token={TOKEN}',timeout=6).read().decode('utf-8'))"
    print("\nAI BLENDER BRIDGE — running (local only)", flush=True)
    print("STATUS URL: " + url + "/?token=" + TOKEN, flush=True)
    print("\nPASTE THIS ONCE IN BLENDER'S PYTHON CONSOLE:\n"+bootstrap+"\n", flush=True)
    try:
        server.serve_forever(poll_interval=.3)
    except KeyboardInterrupt:
        print("Stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()