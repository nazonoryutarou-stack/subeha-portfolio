#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SDK="$HOME/android-sdk-subeha"
GRADLE_VERSION=8.9
GRADLE_HOME="$HOME/.cache/subeha-gradle/gradle-$GRADLE_VERSION"

pkg update -y
pkg install -y openjdk-21 wget unzip aapt2 zipalign

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
"$SDKMANAGER" --sdk_root="$SDK" "platforms;android-35" "build-tools;35.0.0"

mkdir -p "$HOME/.gradle"
printf '%s\n' "android.aapt2FromMavenOverride=$PREFIX/bin/aapt2" > "$HOME/.gradle/gradle.properties"
if command -v zipalign >/dev/null; then
  rm -f "$SDK/build-tools/35.0.0/zipalign"
  ln -s "$PREFIX/bin/zipalign" "$SDK/build-tools/35.0.0/zipalign"
fi

if [ ! -x "$GRADLE_HOME/bin/gradle" ]; then
  mkdir -p "$(dirname "$GRADLE_HOME")"
  cd "$PREFIX/tmp"
  wget -O "gradle-$GRADLE_VERSION-bin.zip" "https://services.gradle.org/distributions/gradle-$GRADLE_VERSION-bin.zip"
  rm -rf "$GRADLE_HOME"
  unzip -q "gradle-$GRADLE_VERSION-bin.zip" -d "$(dirname "$GRADLE_HOME")"
fi

cd "$ROOT"
printf 'sdk.dir=%s\n' "$SDK" > local.properties
"$GRADLE_HOME/bin/gradle" --no-daemon :app:assembleDebug

APK="$ROOT/app/build/outputs/apk/debug/app-debug.apk"
termux-setup-storage >/dev/null 2>&1 || true
cp "$APK" "$HOME/storage/downloads/SubehaWordTimingProbe.apk"
echo "BUILT: $HOME/storage/downloads/SubehaWordTimingProbe.apk"
