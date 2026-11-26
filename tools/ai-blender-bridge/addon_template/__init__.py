bl_info = {
    "name": "AI Blender Bridge Autostart",
    "author": "AI Blender Bridge project",
    "version": (0, 3, 0),
    "blender": (3, 6, 0),
    "location": "Preferences > Add-ons",
    "description": "Reconnect to the locally running Termux Blender Bridge on launch",
    "category": "System",
}

import bpy
import json
import time
import urllib.request

# Local packager substitutes this marker. Never commit a real token.
BRIDGE_TOKEN = "__LOCAL_BRIDGE_TOKEN__"
BASE = "http://127.0.0.1:8765"
WATCHDOG_KEY = "ai_blender_autostart_watchdog"
AGENT_KEY = "ai_blender_bridge_tick"
_last_error_at = 0.0


def bootstrap_if_needed():
    global _last_error_at
    try:
        current = bpy.app.driver_namespace.get(AGENT_KEY)
        if current is not None and bpy.app.timers.is_registered(current):
            return 15.0
        if not BRIDGE_TOKEN or BRIDGE_TOKEN.startswith("__"):
            raise RuntimeError("This add-on has not been locally packaged with a bridge token")
        url = BASE + "/bootstrap?token=" + BRIDGE_TOKEN
        req = urllib.request.Request(url, headers={"Cache-Control": "no-store"})
        with urllib.request.urlopen(req, timeout=3) as response:
            script = response.read(200_000).decode("utf-8")
        # Only fetch from local Termux bridge, never arbitrary remote URLs.
        namespace = {"__name__": "ai_blender_bridge_autostart_agent", "__builtins__": __builtins__}
        exec(compile(script, "<local-ai-blender-bridge>", "exec"), namespace)
        print("[AI Bridge Add-on] Connected to local Blender Bridge")
        return 15.0
    except Exception as exc:
        if time.monotonic() - _last_error_at > 30:
            print("[AI Bridge Add-on] Waiting for local relay:", type(exc).__name__, str(exc)[:130])
            _last_error_at = time.monotonic()
        return 10.0


def register():
    old = bpy.app.driver_namespace.get(WATCHDOG_KEY)
    if old is not None and bpy.app.timers.is_registered(old):
        bpy.app.timers.unregister(old)
    bpy.app.driver_namespace[WATCHDOG_KEY] = bootstrap_if_needed
    bpy.app.timers.register(bootstrap_if_needed, first_interval=2.0, persistent=True)
    print("[AI Bridge Add-on] Autostart watchdog enabled")


def unregister():
    watcher = bpy.app.driver_namespace.pop(WATCHDOG_KEY, None)
    if watcher is not None and bpy.app.timers.is_registered(watcher):
        bpy.app.timers.unregister(watcher)
    agent = bpy.app.driver_namespace.pop(AGENT_KEY, None)
    if agent is not None and bpy.app.timers.is_registered(agent):
        bpy.app.timers.unregister(agent)
    print("[AI Bridge Add-on] Stopped")
