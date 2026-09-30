#!/usr/bin/env bash
# Builds the Shubhora Android app (Capacitor shell around shubhora.com/poster) ON THE SERVER — the Mac has no Java /
# Android SDK. First run installs JDK 17 + the Android command-line tools (~1.5 GB, once) and creates the signing key.
#
#   From the Mac (uploads the android project, builds, brings the APK back):
#     bash scripts/build-apk.sh
#
# The signing key lives at /opt/neuraledge/keys/shubhora-release.jks — KEEP IT (and its password file next to it):
# every future update must be signed with the same key, or phones refuse to install over the old app.
set -euo pipefail
# RETIRED (owner's call, 24 Sep 2026): the app is installed from the website now (PWA, "Install app" button).
# No APK is built or offered any more; this guard stops an old copy from ever being published again.
echo "The APK is retired — Shubhora installs from the website (Install app). Nothing was built."; exit 0
SERVER="root@148.72.247.91"; KEY="$HOME/.ssh/neuraledge_vps"
# Keep-alives: the first build downloads the Android tools (~1.5 GB) and can stay quiet for minutes.
SSH="ssh -i $KEY -o IdentitiesOnly=yes -o ConnectTimeout=60 -o ServerAliveInterval=30 -o ServerAliveCountMax=40"
SRC="/Users/jsrao/Desktop/Wellwa Life/aaj-ka-poster-android"
SITE="/Users/jsrao/Desktop/Wellwa Life/wellwa-cards"
REMOTE="/opt/neuraledge/android-app"

echo "→ uploading android project…"
rsync -az --delete -e "$SSH" --exclude node_modules --exclude 'android/.gradle' --exclude 'android/app/build' --exclude 'android/build' "$SRC/" "$SERVER:$REMOTE/"

echo "→ building on the server…"
$SSH "$SERVER" bash -s <<'REMOTE_EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export ANDROID_HOME=/opt/android-sdk
export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which javac 2>/dev/null || echo /usr/lib/jvm/java-17-openjdk-amd64/bin/javac))))
if ! command -v javac >/dev/null 2>&1 || ! javac -version 2>&1 | grep -q ' 17'; then
  echo "   installing JDK 17…"; apt-get update -qq && apt-get install -y -qq openjdk-17-jdk unzip >/dev/null
  export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
fi
if [ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "   installing Android command-line tools…"
  mkdir -p "$ANDROID_HOME/cmdline-tools" && cd /tmp
  curl -sSL -o cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  rm -rf "$ANDROID_HOME/cmdline-tools/latest" && unzip -q cmdtools.zip -d "$ANDROID_HOME/cmdline-tools" && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"
yes | sdkmanager --licenses >/dev/null 2>&1 || true
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" >/dev/null

# signing key (created once, then reused for ever)
KEYS=/opt/neuraledge/keys; mkdir -p "$KEYS"; chmod 700 "$KEYS"
if [ ! -f "$KEYS/shubhora-release.jks" ]; then
  PASS=$(openssl rand -hex 16); echo "$PASS" > "$KEYS/shubhora-release.pass"; chmod 600 "$KEYS/shubhora-release.pass"
  keytool -genkeypair -v -keystore "$KEYS/shubhora-release.jks" -alias shubhora -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" -dname "CN=Shubhora, O=Shubhora, L=Rewari, S=Haryana, C=IN" >/dev/null 2>&1
  echo "   new signing key created at $KEYS/shubhora-release.jks — back it up"
fi
PASS=$(cat "$KEYS/shubhora-release.pass")

cd /opt/neuraledge/android-app
[ -d node_modules ] || npm ci --silent
cat > android/keystore.properties <<EOP
storeFile=$KEYS/shubhora-release.jks
storePassword=$PASS
keyAlias=shubhora
keyPassword=$PASS
EOP
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
npx --yes @capacitor/cli@6 sync android >/dev/null 2>&1 || npx cap sync android >/dev/null
cd android && chmod +x gradlew && ./gradlew --no-daemon -q assembleRelease
APK=app/build/outputs/apk/release/app-release.apk
[ -f "$APK" ] || { echo "no signed APK produced"; ls app/build/outputs/apk/release/; exit 1; }
# Replace the old APK for good (the new file lands first, then takes its name — never a half-written download).
cp "$APK" /opt/neuraledge/app/public/poster/Shubhora.apk.new
mv -f /opt/neuraledge/app/public/poster/Shubhora.apk.new /opt/neuraledge/app/public/poster/Shubhora.apk
ls -lh /opt/neuraledge/app/public/poster/Shubhora.apk
echo "   version: $(grep -m1 versionName app/build.gradle | tr -d ' ')"
REMOTE_EOF

echo "→ copying the APK back to the Mac…"
# The site folder gets the new APK too — otherwise the next deploy would upload the old one again.
scp -i "$KEY" "$SERVER:/opt/neuraledge/app/public/poster/Shubhora.apk" "$SITE/public/poster/Shubhora.apk"
mkdir -p "$SRC/keys-backup" && scp -i "$KEY" "$SERVER:/opt/neuraledge/keys/shubhora-release.jks" "$SERVER:/opt/neuraledge/keys/shubhora-release.pass" "$SRC/keys-backup/" 2>/dev/null || true
ls -lh "$SITE/public/poster/Shubhora.apk"
echo "✓ APK ready — it is already live at https://shubhora.com/poster/Shubhora.apk and saved in the site folder for the next deploy."
