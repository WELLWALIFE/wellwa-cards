#!/usr/bin/env bash
# Festival wishes to every owner's customers, 9:00 IST daily (sends only on a festival day). Run by
# /etc/cron.d/shubhora-festival-wishes (deploy.sh writes it once). Reads CRON_KEY from the app's own .env.local.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY="$(grep -E '^CRON_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
if [ -z "$KEY" ]; then echo "$(date -Is) CRON_KEY missing in .env.local"; exit 1; fi
# One run stops starting sends after ~4 min and answers "more":true; call again (up to 24 runs, under 2 hours) until everyone
# is covered. Already-wished numbers are skipped by the route, so a repeat never sends twice.
for i in $(seq 1 24); do
  OUT="$(curl -sS -m 290 -H "x-cron-key: $KEY" http://127.0.0.1:3001/api/cron/festival-wishes || true)"
  echo "$(date -Is) run $i: $OUT"
  case "$OUT" in *'"more":true'*|"") sleep 5 ;; *) break ;; esac   # empty = curl itself failed: try again too
done
