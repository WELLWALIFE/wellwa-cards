#!/usr/bin/env bash
# Server watch every 10 minutes: /etc/cron.d/shubhora-server-watch (deploy.sh writes it once). Alarms the owners on a disguised program
# or a long CPU overload (owner, 6 Nov 2026, after the hack). Reads CRON_KEY from the app's own .env.local.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY="$(grep -E '^CRON_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
if [ -z "$KEY" ]; then echo "$(date -Is) CRON_KEY missing in .env.local"; exit 1; fi
echo "$(date -Is) $(curl -sS -m 60 -H "x-cron-key: $KEY" http://127.0.0.1:3001/api/cron/server-watch | head -c 400)"
