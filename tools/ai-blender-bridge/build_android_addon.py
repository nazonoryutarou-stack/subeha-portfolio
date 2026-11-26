#!/usr/bin/env python3
"""Build a per-device Blender add-on ZIP. Uses the local Termux bridge token.

No account/cloud upload. The ZIP includes a secret: keep private and remove
the ZIP from Downloads after installing the add-on.
"""
from pathlib import Path
from urllib.request import Request, urlopen
import os
import tempfile
import zipfile

BASE = "https://raw.githubusercontent.com/nazonoryutarou-stack/subeha-portfolio/main/tools/ai-blender-bridge"
TOKEN_FILE = Path.home() / ".ai_blender_bridge" / "token"
SOURCE = Path.home() / "ai-blender" / "addon_template" / "__init__.py"
OUTPUT = Path.home() / "storage" / "downloads" / "AI_Blender_Bridge_Autostart.zip"
ZIP_ENTRY = "ai_blender_autostart/__init__.py"
MARKER = "__LOCAL_BRIDGE_TOKEN__"


def main():
    token = TOKEN_FILE.read_text(encoding="ascii").strip()
    if len(token) < 24 or not token.isalnum():
        raise SystemExit("Bridge token missing or invalid; run bridge_server.py first")
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    req = Request(BASE + "/addon_template/__init__.py", headers={"User-Agent": "BlenderAddonPackager/0.3"})
    with urlopen(req, timeout=20) as r:
        code = r.read(100_000).decode("utf-8")
    if code.count(MARKER) != 1:
        raise SystemExit("Template marker missing or repeated")
    code = code.replace(MARKER, token)
    compile(code, ZIP_ENTRY, "exec")
    if not OUTPUT.parent.is_dir():
        raise SystemExit("Downloads folder not available. Run termux-setup-storage once.")
    with tempfile.NamedTemporaryFile(prefix="blender-addon-", suffix=".zip", dir=str(OUTPUT.parent),
                                     delete=False) as tmp:
        staging = Path(tmp.name)
    try:
        with zipfile.ZipFile(staging, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(ZIP_ENTRY, code)
        os.chmod(staging, 0o600)
        staging.replace(OUTPUT)
    finally:
        staging.unlink(missing_ok=True)
    print("ADD-ON ZIP READY:", OUTPUT)
    print("Contains a LOCAL TOKEN. Never share or upload this ZIP.")
    print("Blender: Preferences > Get Extensions/Add-ons > Install from Disk")
    print("Select Downloads/AI_Blender_Bridge_Autostart.zip and enable the add-on.")
    print("Save Preferences if necessary. Test after closing and reopening Blender.")
    print("After installation delete the ZIP from Downloads; the installed copy remains.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, TimeoutError) as exc:
        raise SystemExit("Build failed: " + str(exc))
