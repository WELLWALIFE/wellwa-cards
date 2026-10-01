#!/usr/bin/env bash
# Chromium on the app server, so Shubhora can read websites that only exist after their JavaScript runs
# (see src/lib/render-page.ts). Run once, on the VPS, as root:
#
#   bash /opt/neuraledge/app/server/install-chromium.sh
#
# It is safe to run again: everything here is idempotent.
set -euo pipefail

echo "→ installing Chromium (AlmaLinux 9 / EPEL)…"
dnf install -y epel-release >/dev/null 2>&1 || true
dnf install -y chromium >/dev/null 2>&1 || dnf install -y chromium-headless >/dev/null 2>&1

BIN="$(command -v chromium-browser || command -v chromium || command -v chromium-headless || true)"
if [ -z "$BIN" ]; then
  echo "!! Chromium did not install. Reading JavaScript-built websites will stay off; everything else works."
  exit 1
fi
echo "   found: $BIN ($("$BIN" --version 2>/dev/null || echo 'version unknown'))"

# The app reads this to find it. Added once; an existing line is left alone.
ENVFILE=/opt/neuraledge/app/.env.local
if grep -q '^CHROME_PATH=' "$ENVFILE" 2>/dev/null; then
  echo "   CHROME_PATH already set in .env.local — not changed"
else
  printf '\nCHROME_PATH=%s\n' "$BIN" >> "$ENVFILE"
  echo "   CHROME_PATH=$BIN added to .env.local"
fi

# Chromium needs more shared memory than the default 64 MB or it dies on heavier pages. The app also passes
# --disable-dev-shm-usage, so this is a belt-and-braces measure.
if ! grep -q '^tmpfs /dev/shm' /etc/fstab 2>/dev/null; then
  mount -o remount,size=512M /dev/shm 2>/dev/null || true
  echo "   /dev/shm raised to 512M for this boot"
fi

echo "✓ done — restart the app so it picks up CHROME_PATH:  pm2 restart neuraledge-app"
