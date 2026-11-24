#!/data/data/com.termux/files/usr/bin/sh
# AI Blender Bridge installer for Termux. Inspect this script before running it.
set -eu
command -v python3 >/dev/null 2>&1 || { echo "Run: pkg install python curl -y"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "Run: pkg install python curl -y"; exit 1; }
DIR="$HOME/ai-blender"
BASE="https://raw.githubusercontent.com/nazonoryutarou-stack/subeha-portfolio/main/tools/ai-blender-bridge"
mkdir -p "$DIR"
cd "$DIR"
curl -fL --retry 3 --connect-timeout 12 -o bridge_server.py "$BASE/bridge_server.py"
curl -fL --retry 3 --connect-timeout 12 -o blender_agent.py "$BASE/blender_agent.py"
python3 -m py_compile bridge_server.py blender_agent.py
echo "Code downloaded. Starting the local service at 127.0.0.1:8765."
echo "Use the one-line command printed below inside Blender's Python Console."
exec python3 bridge_server.py
