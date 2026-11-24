#!/data/data/com.termux/files/usr/bin/sh
# Installs user-controlled Android ADB bridge. Does NOT pair, arm or start it.
set -eu
command -v python3 >/dev/null 2>&1 || { echo 'First: pkg install python android-tools curl -y'; exit 1; }
command -v adb >/dev/null 2>&1 || { echo 'First: pkg install python android-tools curl -y'; exit 1; }
command -v curl >/dev/null 2>&1 || { echo 'First: pkg install python android-tools curl -y'; exit 1; }
DIR="$HOME/ai-phone-bridge"
BASE="https://raw.githubusercontent.com/nazonoryutarou-stack/subeha-portfolio/main/tools/ai-phone-bridge"
mkdir -p "$DIR"
chmod 700 "$DIR"
curl -fLsS --retry 2 --connect-timeout 12 -o "$DIR/phone_bridge.py" "$BASE/phone_bridge.py"
curl -fLsS --retry 2 --connect-timeout 12 -o "$DIR/test_phone_bridge.py" "$BASE/test_phone_bridge.py"
python3 -m py_compile "$DIR/phone_bridge.py"
python3 "$DIR/test_phone_bridge.py" -q
printf '\nAI PHONE BRIDGE installed at %s\n' "$DIR"
printf 'No permissions were enabled and no screenshots were uploaded.\n'
printf 'Now follow README_JA.md for ADB pairing and app allowlisting.\n'