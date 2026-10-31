#!/usr/bin/env bash
# Tells owners whose website (or first Premium design) has just gone live, hourly: /etc/cron.d/shubhora-site-live (deploy.sh writes it once).
# The website itself shows by time (src/lib/site-ready.ts); this only sends the message. Reads CRON_KEY from the app's own .env.local.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY="$(grep -E '^CRON_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
if [ -z "$KEY" ]; then echo "$(date -Is) CRON_KEY missing in .env.local"; exit 1; fi
echo "$(date -Is) $(curl -sS -m 240 -H "x-cron-key: $KEY" http://127.0.0.1:3001/api/cron/site-live)"
