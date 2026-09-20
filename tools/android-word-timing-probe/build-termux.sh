#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SDK="$HOME/android-sdk-subeha"
BUILD_TOOLS="35.0.0"
WORK="$ROOT/.manual-build"
ANDROID_JAR="$SDK/platforms/android-35/android.jar"
D8_JAR="$SDK/build-tools/$BUILD_TOOLS/lib/d8.jar"
APKSIGNER_JAR="$SDK/build-tools/$BUILD_TOOLS/lib/apksigner.jar"
APK_UNSIGNED="$WORK/SubehaWordTimingProbe-unsigned.apk"
APK_ALIGNED="$WORK/SubehaWordTimingProbe-aligned.apk"
APK_SIGNED="$WORK/SubehaWordTimingProbe.apk"
KEYSTORE="$HOME/.android/debug.keystore"

pkg update -y
pkg install -y openjdk-21 wget unzip zip aapt2

export JAVA_HOME="$PREFIX/lib/jvm/java-21-openjdk"
export PATH="$JAVA_HOME/bin:$PATH"

if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
  mkdir -p "$SDK/cmdline-tools"
  cd "$PREFIX/tmp"
  FILE=commandlinetools-linux-9123335_latest.zip
  wget -O "$FILE" "https://dl.google.com/android/repository/$FILE"
  rm -rf "$SDK/cmdline-tools/latest" "$PREFIX/tmp/cmdline-tools"
  unzip -q "$FILE" -d "$PREFIX/tmp"
  mv "$PREFIX/tmp/cmdline-tools" "$SDK/cmdline-tools/latest"
fi

SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"
yes | "$SDKMANAGER" --sdk_root="$SDK" --licenses >/dev/null || true
"$SDKMANAGER" --sdk_root="$SDK" "platforms;android-35" "build-tools;$BUILD_TOOLS"

test -f "$ANDROID_JAR"
test -f "$D8_JAR"
test -f "$APKSIGNER_JAR"

rm -rf "$WORK"
mkdir -p "$WORK/classes" "$WORK/dex"

echo "[1/5] javac"
javac   --release 17   -cp "$ANDROID_JAR"   -d "$WORK/classes"   "$ROOT/app/src/main/java/jp/subeha/wordtiming/MainActivity.java"

echo "[2/5] aapt2 package"
aapt2 link   -I "$ANDROID_JAR"   --manifest "$ROOT/app/src/main/AndroidManifest.xml"   --min-sdk-version 34   --target-sdk-version 35   --version-code 1   --version-name 0.1.0   -o "$APK_UNSIGNED"

echo "[3/5] d8"
mapfile -t CLASS_FILES < <(find "$WORK/classes" -type f -name '*.class' | sort)
java -cp "$D8_JAR" com.android.tools.r8.D8   --lib "$ANDROID_JAR"   --min-api 34   --output "$WORK/dex"   "${CLASS_FILES[@]}"

test -f "$WORK/dex/classes.dex"
(
  cd "$WORK/dex"
  zip -q -u "$APK_UNSIGNED" classes.dex
)

echo "[4/6] 4-byte APK alignment"
APK_UNSIGNED="$APK_UNSIGNED" APK_ALIGNED="$APK_ALIGNED" python - <<'PY'
import os, struct, zipfile

src=os.environ["APK_UNSIGNED"]
dst=os.environ["APK_ALIGNED"]

with zipfile.ZipFile(src, "r") as zin, zipfile.ZipFile(dst, "w", allowZip64=True) as zout:
    for old in zin.infolist():
        data=zin.read(old.filename)
        zi=zipfile.ZipInfo(old.filename, date_time=old.date_time)
        zi.comment=old.comment
        zi.external_attr=old.external_attr
        zi.internal_attr=old.internal_attr
        zi.create_system=old.create_system
        zi.flag_bits=old.flag_bits

        # Android 11+ requires resources.arsc to be stored uncompressed.
        zi.compress_type = zipfile.ZIP_STORED if old.filename == "resources.arsc" else old.compress_type

        # Align every STORED entry to a 4-byte data boundary using a padding
        # extra field. This is the relevant zipalign behavior for this APK,
        # which contains no native .so libraries.
        if zi.compress_type == zipfile.ZIP_STORED:
            name_bytes=zi.filename.encode("utf-8")
            local_header=zout.fp.tell()
            base=local_header + 30 + len(name_bytes)
            pad=(-base) % 4
            if pad:
                zi.extra=struct.pack("<HH", 0xFFFF, pad) + (b"\0" * pad)

        zout.writestr(zi, data)

# Self-check resources.arsc.
with open(dst, "rb") as fp, zipfile.ZipFile(fp) as z:
    info=z.getinfo("resources.arsc")
    fp.seek(info.header_offset)
    hdr=fp.read(30)
    name_len, extra_len=struct.unpack_from("<HH", hdr, 26)
    data_offset=info.header_offset + 30 + name_len + extra_len
    if info.compress_type != zipfile.ZIP_STORED:
        raise SystemExit("resources.arsc is compressed")
    if data_offset % 4:
        raise SystemExit(f"resources.arsc is not 4-byte aligned: offset={data_offset}")
    print(f"resources.arsc OK: stored, offset={data_offset}, mod4={data_offset%4}")
PY

echo "[5/6] debug signing"
mkdir -p "$(dirname "$KEYSTORE")"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair     -keystore "$KEYSTORE"     -storepass android     -alias androiddebugkey     -keypass android     -dname "CN=Android Debug,O=Android,C=US"     -keyalg RSA     -keysize 2048     -validity 10000     -noprompt
fi

java -jar "$APKSIGNER_JAR" sign   --ks "$KEYSTORE"   --ks-pass pass:android   --key-pass pass:android   --out "$APK_SIGNED"   "$APK_UNSIGNED"

java -jar "$APKSIGNER_JAR" verify --verbose "$APK_SIGNED"

echo "[6/6] copy"
termux-setup-storage >/dev/null 2>&1 || true
cp "$APK_SIGNED" "$HOME/storage/downloads/SubehaWordTimingProbe.apk"

echo
echo "BUILT: $HOME/storage/downloads/SubehaWordTimingProbe.apk"
echo "APK resources were 4-byte aligned before signing."
