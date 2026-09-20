#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
INPUT="${1:?usage: $0 <audio> [out-dir]}"
OUT="${2:-$HOME/storage/downloads/SubehaWhisperToken}"
CACHE="${SUBEHA_WHISPER_CACHE:-$HOME/.local/share/subeha-whisper-token}"
SRC="$CACHE/whisper.cpp"; MODEL_DIR="$CACHE/models"; MODEL="$MODEL_DIR/ggml-small-q5_1.bin"
BUILD="$SRC/build"; CLI="$BUILD/bin/whisper-cli"; WAV="$OUT/input-16k.wav"
BASE="$OUT/whisper-full"; PARTS="$OUT/word-timing.jsonl"
THREADS="${SUBEHA_THREADS:-4}"; JOBS="${SUBEHA_BUILD_JOBS:-2}"
mkdir -p "$OUT" "$CACHE" "$MODEL_DIR"

echo "[1/7] dependencies"
pkg install -y git cmake clang make ffmpeg wget python

echo "[2/7] whisper.cpp"
if [ ! -d "$SRC/.git" ]; then
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git "$SRC"
else
  git -C "$SRC" fetch --depth 1 origin master
  git -C "$SRC" reset --hard origin/master
fi
COMMIT="$(git -C "$SRC" rev-parse HEAD)"
echo "whisper.cpp commit: $COMMIT"

echo "[3/7] build"
cmake -S "$SRC" -B "$BUILD" -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON
cmake --build "$BUILD" --target whisper-cli -j "$JOBS"

echo "[4/7] model"
if [ ! -s "$MODEL" ]; then bash "$SRC/models/download-ggml-model.sh" small-q5_1 "$MODEL_DIR"; fi

echo "[5/7] audio -> 16k mono PCM WAV"
ffmpeg -hide_banner -loglevel error -y -i "$INPUT" -vn -ar 16000 -ac 1 -c:a pcm_s16le "$WAV"

echo "[6/7] token timestamps (no VAD, processors=1)"
"$CLI" -m "$MODEL" -f "$WAV" -l ja -t "$THREADS" -p 1 -ng -ojf -of "$BASE" -pp
test -s "$BASE.json"

echo "[7/7] full JSON -> parts"
python "$HERE/whisper-json-to-parts.py" "$BASE.json" "$PARTS" --audio "$WAV"
echo "DONE: $PARTS"
