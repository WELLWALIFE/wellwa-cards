#!/usr/bin/env bash
# Daily V-Card renewal reminders. Run by /etc/cron.d/shubhora-card-renewals (deploy.sh writes it once).
# Reads CRON_KEY from the app's own .env.local and calls the reminder route on the local app port.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY="$(grep -E '^CRON_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
if [ -z "$KEY" ]; then echo "$(date -Is) CRON_KEY missing in .env.local"; exit 1; fi
echo "$(date -Is) $(curl -sS -m 120 -H "x-cron-key: $KEY" http://127.0.0.1:3001/api/cron/card-renewals)"
