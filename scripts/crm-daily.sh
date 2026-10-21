#!/usr/bin/env bash
# CRM Pro automations on the clock (docs/crm-pro.md 3.13): morning 09:00 IST = birthday/anniversary wishes + "going cold"
# nudge; evening 20:00 IST = the owner's daily summary. Run by /etc/cron.d/shubhora-crm-daily (deploy.sh writes it once).
#   bash scripts/crm-daily.sh morning | evening
set -euo pipefail
cd "$(dirname "$0")/.."
JOB="${1:-evening}"
KEY="$(grep -E '^CRON_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
if [ -z "$KEY" ]; then echo "$(date -Is) CRON_KEY missing in .env.local"; exit 1; fi
echo "$(date -Is) $JOB $(curl -sS -m 290 -H "x-cron-key: $KEY" "http://127.0.0.1:3001/api/cron/crm-daily?job=$JOB")"
