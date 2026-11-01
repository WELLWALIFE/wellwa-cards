#!/usr/bin/env bash
# Ads v2 sync (src/lib/ads-sync.ts): hourly status / spend / messages; with "daily" the 8 pm "today's ads" line. /etc/cron.d/shubhora-ads-sync
# (deploy.sh writes it once). Reads CRON_KEY from the app's own .env.local.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY="$(grep -E '^CRON_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
if [ -z "$KEY" ]; then echo "$(date -Is) CRON_KEY missing in .env.local"; exit 1; fi
MODE="${1:-hourly}"
echo "$(date -Is) $(curl -sS -m 290 -H "x-cron-key: $KEY" "http://127.0.0.1:3001/api/cron/ads-sync?mode=$MODE")"
