#!/usr/bin/env bash
# CRM → Lead sources: pulls new IndiaMART enquiries for every owner who saved a key. Every 15 minutes, run by
# /etc/cron.d/shubhora-lead-pull (deploy.sh writes it once). IndiaMART allows one call per key per 5 minutes.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY="$(grep -E '^CRON_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
if [ -z "$KEY" ]; then echo "$(date -Is) CRON_KEY missing in .env.local"; exit 1; fi
echo "$(date -Is) $(curl -sS -m 280 -H "x-cron-key: $KEY" http://127.0.0.1:3001/api/cron/lead-pull)"
