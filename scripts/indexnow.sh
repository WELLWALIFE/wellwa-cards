#!/usr/bin/env bash
# Tells the search engines (IndexNow) about the Premium websites that changed. Run hourly by /etc/cron.d/shubhora-indexnow (deploy.sh writes it once).
# Reads CRON_KEY from the app's own .env.local and calls the route on the local app port.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY="$(grep -E '^CRON_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
if [ -z "$KEY" ]; then echo "$(date -Is) CRON_KEY missing in .env.local"; exit 1; fi
echo "$(date -Is) $(curl -sS -m 240 -H "x-cron-key: $KEY" http://127.0.0.1:3001/api/cron/indexnow)"
