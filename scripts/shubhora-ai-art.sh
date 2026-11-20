#!/usr/bin/env bash
# Makes Shubhora's own website pictures with the AI image model — ONCE — and brings them into this repo.
# Run on the Mac:   bash scripts/shubhora-ai-art.sh            (every picture not made yet)
#                   bash scripts/shubhora-ai-art.sh hero-1     (that one again)
# The pictures are made on the server (the Gemini key is there) and copied back to public/art/shubhora/ai/.
set -euo pipefail
cd "$(dirname "$0")/.."
SERVER="root@148.72.247.91"; KEY="$HOME/.ssh/neuraledge_vps"; APP="/opt/neuraledge/app"
SSH="ssh -i $KEY -o IdentitiesOnly=yes -o ConnectTimeout=60 -o ServerAliveInterval=30"
echo "→ sending the script…"
rsync -az -e "$SSH" scripts/shubhora-ai-art.mjs "$SERVER:$APP/scripts/"
echo "→ making the pictures (a few minutes)…"
$SSH "$SERVER" "cd $APP && node scripts/shubhora-ai-art.mjs $*"
echo "→ bringing them back…"
mkdir -p public/art/shubhora/ai
rsync -az -e "$SSH" "$SERVER:$APP/public/art/shubhora/ai/" public/art/shubhora/ai/
ls -la public/art/shubhora/ai/
echo "✓ done — tell Claude the pictures are ready."
