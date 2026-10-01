#!/usr/bin/env bash
# Headless Chrome on the app server, so Shubhora can read websites that only exist after their JavaScript
# runs (see src/lib/render-page.ts). Run once, on the VPS, as root:
#
#   bash /opt/neuraledge/app/server/install-chromium.sh
#
# Safe to run again: it only adds, and re-running just re-points CHROME_PATH at the newest build.
#
# NOT dnf. EPEL's chromium wants a newer libavcodec, which wants a newer svt-av1-libs, which cPanel's
# ea-php83-php-gd is pinned against — dnf offers --allowerasing, and taking it would remove cPanel's PHP GD
# and break the PHP sites on this box. Tried on 1 Oct 2026; do not try it again. The standalone build below
# carries what it needs and touches no system package.
set -euo pipefail

ROOT=/opt/neuraledge
ENVFILE=$ROOT/app/.env.local

echo "→ downloading Chrome for Testing (headless shell)…"
# Prints the path of the binary it installed on the last line.
BIN="$(cd "$ROOT" && npx --yes @puppeteer/browsers install chrome-headless-shell@stable 2>&1 | tail -1 | awk '{print $NF}')"

if [ -z "${BIN:-}" ] || [ ! -x "$BIN" ]; then
  echo "!! Could not install it. Reading JavaScript-built websites stays off; everything else works."
  exit 1
fi
echo "   $BIN"
echo "   $("$BIN" --version 2>&1 | head -1)"

# Everything it links against should already be on the box — say so plainly if not.
MISSING="$(ldd "$BIN" 2>/dev/null | grep 'not found' | sort -u || true)"
if [ -n "$MISSING" ]; then
  echo "!! Missing system libraries:"; echo "$MISSING"
  echo "   Install just these (never with --allowerasing on this box) and run again."
  exit 1
fi

if grep -q '^CHROME_PATH=' "$ENVFILE" 2>/dev/null; then
  sed -i "s|^CHROME_PATH=.*|CHROME_PATH=$BIN|" "$ENVFILE"
  echo "   CHROME_PATH updated in .env.local"
else
  printf '\nCHROME_PATH=%s\n' "$BIN" >> "$ENVFILE"
  echo "   CHROME_PATH added to .env.local"
fi

# Chrome dies on heavier pages when /dev/shm is the old 64 MB default. The app also passes
# --disable-dev-shm-usage, so this is belt and braces — and it only ever RAISES it, never shrinks a box
# that already has plenty.
SHM_MB=$(df -m --output=size /dev/shm 2>/dev/null | tail -1 | tr -d ' ')
if [ -n "${SHM_MB:-}" ] && [ "$SHM_MB" -lt 512 ]; then
  mount -o remount,size=512M /dev/shm 2>/dev/null && echo "   /dev/shm raised from ${SHM_MB}M to 512M for this boot"
else
  echo "   /dev/shm is ${SHM_MB:-?}M — left alone"
fi

pm2 restart neuraledge-app >/dev/null 2>&1 && echo "   app restarted"
echo "✓ done"
