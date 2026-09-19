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

echo "[4/5] debug signing"
mkdir -p "$(dirname "$KEYSTORE")"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair     -keystore "$KEYSTORE"     -storepass android     -alias androiddebugkey     -keypass android     -dname "CN=Android Debug,O=Android,C=US"     -keyalg RSA     -keysize 2048     -validity 10000     -noprompt
fi

java -jar "$APKSIGNER_JAR" sign   --ks "$KEYSTORE"   --ks-pass pass:android   --key-pass pass:android   --out "$APK_SIGNED"   "$APK_UNSIGNED"

java -jar "$APKSIGNER_JAR" verify --verbose "$APK_SIGNED"

echo "[5/5] copy"
termux-setup-storage >/dev/null 2>&1 || true
cp "$APK_SIGNED" "$HOME/storage/downloads/SubehaWordTimingProbe.apk"

echo
echo "BUILT: $HOME/storage/downloads/SubehaWordTimingProbe.apk"
echo "zipalign is intentionally not used; this APK has no native libraries and is signed after packaging."
