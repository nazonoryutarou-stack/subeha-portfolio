#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <audio.m4a> <android-word-timing.jsonl> [portfolio-root]"
  exit 2
fi

AUDIO="$(realpath "$1")"
WORDS="$(realpath "$2")"
ROOT="${3:-$HOME/subeha-portfolio}"
ROOT="$(realpath "$ROOT")"

REMOTION="$ROOT/remotion/vrm-lipsync"
WORK="$ROOT/.work/vtuber-backup"
PCM="$WORK/voice-16k-mono.pcm"
MOUTH="$REMOTION/input/mouth.jsonl"
WORD_DEST="$REMOTION/input/word-timing.jsonl"

command -v ffmpeg >/dev/null || {
  echo "ffmpeg missing; installing"
  pkg install -y ffmpeg
}

python -c 'import numpy' >/dev/null 2>&1 || {
  echo "numpy missing; installing"
  pkg install -y python-numpy || pip install numpy
}

test -f "$AUDIO"
test -f "$WORDS"
test -d "$REMOTION"

mkdir -p "$WORK" "$REMOTION/input" "$REMOTION/public"

echo "[1/5] audio -> PCM16LE 16k mono"
ffmpeg -hide_banner -loglevel error -y -i "$AUDIO" -vn -ac 1 -ar 16000 -f s16le "$PCM"

echo "[2/5] mouth curve"
python "$ROOT/tools/vtuber-backup/make_mouth_curve.py" "$PCM" --out "$MOUTH"

echo "[3/5] word timing"
cp "$WORDS" "$WORD_DEST"

echo "[4/5] render audio asset"
ffmpeg -hide_banner -loglevel error -y -i "$AUDIO" -vn -c:a aac -b:a 192k "$REMOTION/public/voice.m4a"

if [ ! -e "$REMOTION/public/Subeha.vrm" ]; then
  echo "[4b/5] VRM link"
  ln -s ../../../Subeha.vrm "$REMOTION/public/Subeha.vrm"
fi

echo "[5/5] build timeline"
cd "$REMOTION"
npm run build:backup-timeline

echo
echo "READY"
echo "  words: $WORD_DEST"
echo "  mouth: $MOUTH"
echo "  audio: $REMOTION/public/voice.m4a"
echo "next:"
echo "  cd '$REMOTION' && npm run render:backup"
