#!/usr/bin/env bash
# Growth autopay needs Razorpay to tell the app about every monthly debit (a webhook). Run this once:
#
#   cd "/Users/jsrao/Desktop/Wellwa Life/wellwa-cards" && bash scripts/set-razorpay-webhook.sh
#
# It makes a new random webhook secret, saves it on the server as RAZORPAY_WEBHOOK_SECRET (a dated backup of
# .env.local is kept), restarts the app, and prints the three things to paste into Razorpay:
#   Razorpay Dashboard → Account & Settings → Webhooks → + Add New Webhook.
# The secret is shown only here, once. Running it again makes a new secret — then paste the new one in Razorpay too.
set -euo pipefail
SERVER="root@148.72.247.91"
KEY="$HOME/.ssh/neuraledge_vps"
APP="/opt/neuraledge/app"
SSH_CMD=${SSH_CMD:-"ssh -i $KEY -o IdentitiesOnly=yes -o ConnectTimeout=60 $SERVER"}

SECRET="$(openssl rand -hex 24)"
printf 'RAZORPAY_WEBHOOK_SECRET=%s\n' "$SECRET" | $SSH_CMD "set -e; cd $APP; test -f .env.local; cp -p .env.local .env.local.bak-\$(date +%Y%m%d-%H%M%S); { grep -v -E '^RAZORPAY_WEBHOOK_SECRET=' .env.local || true; cat; } > .env.local.new; cat .env.local.new > .env.local; rm -f .env.local.new; pm2 restart neuraledge-app >/dev/null 2>&1 || true; echo \"   saved on the server: \$(grep -c -E '^RAZORPAY_WEBHOOK_SECRET=' .env.local) of 1\""

cat <<EOF

→ Now in Razorpay: Account & Settings → Webhooks → + Add New Webhook, and fill in:

   Webhook URL:     https://shubhora.com/api/billing/webhook
   Secret:          $SECRET
   Alert email:     your email
   Active events:   tick all "subscription." events —
                    subscription.authenticated, subscription.activated, subscription.charged,
                    subscription.pending, subscription.halted, subscription.cancelled,
                    subscription.completed, subscription.paused, subscription.resumed, subscription.updated

   Then press Create Webhook. After that you can clear this Terminal (Cmd+K).
EOF
unset SECRET
