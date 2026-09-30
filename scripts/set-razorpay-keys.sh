#!/usr/bin/env bash
# Put the Razorpay API keys on the server — once, or again whenever the keys are regenerated.
#
#   cd "/Users/jsrao/Desktop/Wellwa Life/wellwa-cards" && bash scripts/set-razorpay-keys.sh
#
# Asks for the Key ID and the Key Secret (the secret stays hidden while you type), writes both into the server's
# .env.local (a dated backup is kept next to it) and restarts the app. The keys never go into git, this folder or a
# command line. Payments (Growth, V-Card renewal, credit packs) switch on as soon as the app is back.
set -euo pipefail
SERVER="root@148.72.247.91"
KEY="$HOME/.ssh/neuraledge_vps"
APP="/opt/neuraledge/app"
SSH_CMD=${SSH_CMD:-"ssh -i $KEY -o IdentitiesOnly=yes -o ConnectTimeout=60 $SERVER"}

read -r -p "Razorpay Key ID (starts with rzp_live_): " RZP_ID
read -r -s -p "Razorpay Key Secret (hidden while typing): " RZP_SECRET; echo
RZP_ID="${RZP_ID//[[:space:]]/}"; RZP_SECRET="${RZP_SECRET//[[:space:]]/}"
if ! [[ "$RZP_ID" =~ ^rzp_(live|test)_[A-Za-z0-9]+$ ]]; then echo "That Key ID does not look right — it starts with rzp_live_. Nothing was changed."; exit 1; fi
if ! [[ ${#RZP_SECRET} -ge 16 && "$RZP_SECRET" =~ ^[A-Za-z0-9]+$ ]]; then echo "That Key Secret does not look right. Nothing was changed."; exit 1; fi
if [[ "$RZP_ID" == rzp_test_* ]]; then echo "Note: this is a TEST key — real customers cannot pay with it."; fi

printf 'RAZORPAY_KEY_ID=%s\nRAZORPAY_KEY_SECRET=%s\n' "$RZP_ID" "$RZP_SECRET" | $SSH_CMD "set -e; cd $APP; test -f .env.local; cp -p .env.local .env.local.bak-\$(date +%Y%m%d-%H%M%S); { grep -v -E '^RAZORPAY_KEY_(ID|SECRET)=' .env.local || true; cat; } > .env.local.new; cat .env.local.new > .env.local; rm -f .env.local.new; pm2 restart neuraledge-app >/dev/null 2>&1 || true; echo \"   saved on the server: \$(grep -c -E '^RAZORPAY_KEY_(ID|SECRET)=' .env.local) of 2 keys\""
unset RZP_SECRET
echo "→ App restarted. Open https://shubhora.com/poster/plan and tap Subscribe — the Razorpay payment window should open."
