#!/usr/bin/env bash
# Deploy Shubhora to the production VPS.
#
# IMPORTANT: .env.local is EXCLUDED. The server keeps its own production env
# (NEXT_PUBLIC_SITE_URL=https://shubhora.com, service-role key, …). Syncing the
# local dev env over it once broke live SEO by publishing a dead tunnel URL.
# (The server folder /opt/neuraledge and the pm2 names neuraledge-* are the old internal
# names: invisible to customers, and renaming them would mean downtime — so they stay.)
set -euo pipefail

SERVER="root@148.72.247.91"
# The platform address. Change this one line (and NEXT_PUBLIC_SITE_URL in the server's .env.local) to move domains.
SITE_URL="https://shubhora.com"
SITE_HOST="${SITE_URL#https://}"
KEY="$HOME/.ssh/neuraledge_vps"
APP="/opt/neuraledge/app"
# Keep-alives so a stalled connection fails in ~1 min instead of hanging the
# deploy for half an hour (the VPS drops SSH under load).
SSH="ssh -i $KEY -o IdentitiesOnly=yes -o ConnectTimeout=60 -o ServerAliveInterval=30 -o ServerAliveCountMax=10"

echo "→ building production release locally…"
NEXT_PUBLIC_SITE_URL="$SITE_URL" npm run build

echo "→ uploading source (env + runtime state preserved)…"
# Only what the server runs goes up: not the Mac's own work folders (work/ = old Wellwa deck and video files,
# ~25 MB; docs/; git history; editor files) — the server never uses them (owner's call, 27 Sep 2026).
rsync -az --partial --timeout=120 -e "$SSH" \
  --exclude node_modules \
  --exclude .next \
  --exclude .env.local \
  --exclude /work \
  --exclude /docs \
  --exclude /.git \
  --exclude /.claude \
  --exclude '*.tsbuildinfo' \
  --exclude bridge/auth \
  --exclude bridge/tenants \
  --exclude bridge/config.json \
  --exclude bridge/followups.json \
  --exclude bridge/contacts.json \
  ./ "$SERVER:$APP/"

# Next.js 16 renamed middleware.ts to proxy.ts. rsync intentionally does not
# delete server-only state, so remove this one known retired source file.
$SSH "$SERVER" "rm -f $APP/src/middleware.ts"

echo "→ uploading compiled release…"
rsync -az --delete --partial --timeout=120 \
  --exclude cache \
  --exclude dev \
  -e "$SSH" .next/ "$SERVER:$APP/.next/"

echo "→ verifying production env…"
$SSH "$SERVER" "grep -q 'NEXT_PUBLIC_SITE_URL=$SITE_URL' $APP/.env.local \
  || { echo '!! production SITE_URL is wrong'; exit 1; }"

echo "→ installing locked dependencies…"
$SSH "$SERVER" "cd $APP && npm ci --no-audit --no-fund"

# Poster fonts (bridge/fonts, Google Fonts OFL) registered system-wide for root's processes, so the app, the media
# worker and every cron render the Signature posters with the same faces. fontconfig reads its font list once per
# process, so this runs BEFORE the restarts below.
# /usr/local/share/fonts is on every fontconfig's default list and needs no HOME (pm2's processes have none set).
$SSH "$SERVER" "mkdir -p /usr/local/share/fonts && ln -sfn $APP/bridge/fonts /usr/local/share/fonts/shubhora && rm -f ~/.local/share/fonts/shubhora 2>/dev/null; (fc-cache -f >/dev/null 2>&1 || true) && echo \"   fonts: \$(fc-list 2>/dev/null | grep -c '/usr/local/share/fonts/shubhora/') faces registered\""

echo "→ restarting…"
$SSH "$SERVER" "pm2 restart neuraledge-app >/dev/null 2>&1 && sleep 6"

# The media worker and WhatsApp manager are long-running bridge processes: restart them only when
# their code changed. On boot the worker gives an interrupted job ONE more try and then fails and
# refunds it — there is no clip cache on that path, so it never silently re-pays for the same clips.
#
# The hash covers EVERY bridge/*.mjs file plus the music beds, because the worker imports ad-v2,
# stock-reel, kling, prompt-builders, ad-rules and qc-judge too. Hashing only media-worker.mjs and
# the engines is how an engine fix used to ship a new UI against an old worker with nothing to show
# for it — the bug looked fixed in the code and was still live on the box.
$SSH "$SERVER" "cd $APP && new=\$( { find bridge -name '*.mjs' -not -path '*/node_modules/*' | sort | xargs cat; md5sum bridge/music/* 2>/dev/null; } | md5sum | cut -d' ' -f1); old=\$(cat .media-worker.hash 2>/dev/null); if [ \"\$new\" != \"\$old\" ]; then echo '   media worker code changed → restarting neuraledge-media'; pm2 restart neuraledge-media >/dev/null 2>&1; echo \$new > .media-worker.hash; else echo '   media worker unchanged'; fi"

# The WhatsApp manager (bridge/manager.mjs, started as `npm run wa` under pm2) is restarted only when its own
# code changed (the manager, the per-number worker index.mjs and the two files it imports). Its pm2 name is looked up from the script path, so a rename never leaves it running old code.
$SSH "$SERVER" "cd $APP && new=\$(cat bridge/manager.mjs bridge/index.mjs bridge/shubhora-kb.mjs bridge/shubhora-agent.mjs | md5sum | cut -d' ' -f1); old=\$(cat .wa-manager.hash 2>/dev/null); if [ \"\$new\" != \"\$old\" ]; then id=\$(pm2 jlist 2>/dev/null | node -e 'let d=\"\";process.stdin.on(\"data\",c=>d+=c).on(\"end\",()=>{try{const p=JSON.parse(d.slice(d.indexOf(\"[\"))).find(x=>/manager\\.mjs$|bridge$/.test(String(x.pm2_env.pm_exec_path||\"\"))||/wa|whatsapp/i.test(x.name));if(p)console.log(p.pm_id)}catch{}})'); if [ -n \"\$id\" ]; then echo \"   WhatsApp manager code changed → restarting pm2 id \$id\"; pm2 restart \$id >/dev/null 2>&1 || true; else echo '   WhatsApp manager code changed but no pm2 process found — restart it by hand'; fi; echo \$new > .wa-manager.hash; else echo '   WhatsApp manager unchanged'; fi"

# Generated files live 30 days (posters on disk, videos in the media bucket). One cron file, written once.
$SSH "$SERVER" "test -f /etc/cron.d/shubhora-cleanup || printf '%s\n' 'PATH=/usr/local/bin:/usr/bin:/bin' '30 20 * * * root cd $APP && node scripts/cleanup-30d.mjs --apply >> /var/log/shubhora-cleanup.log 2>&1' > /etc/cron.d/shubhora-cleanup"
# V-Card renewal reminders (the card's year: 30 / 7 / 1 days before it ends, the end day, 2 days before the pause, the
# pause), every day at 10:45 IST. One cron file, written once.
$SSH "$SERVER" "test -f /etc/cron.d/shubhora-card-renewals || printf '%s\n' 'PATH=/usr/local/bin:/usr/bin:/bin' '15 5 * * * root bash $APP/scripts/card-renewals.sh >> /var/log/shubhora-card-renewals.log 2>&1' > /etc/cron.d/shubhora-card-renewals"
# Weekly website report (views, WhatsApp taps, enquiries, orders) to every owner, Monday 9:30 IST. One cron file, written once.
$SSH "$SERVER" "test -f /etc/cron.d/shubhora-weekly-report || printf '%s\n' 'PATH=/usr/local/bin:/usr/bin:/bin' '0 4 * * 1 root bash $APP/scripts/weekly-report.sh >> /var/log/shubhora-weekly-report.log 2>&1' > /etc/cron.d/shubhora-weekly-report"
# Booking reminders (customer a day and two hours before, owner two hours before), every 15 minutes. One cron file, written once.
$SSH "$SERVER" "test -f /etc/cron.d/shubhora-booking-reminders || printf '%s\n' 'PATH=/usr/local/bin:/usr/bin:/bin' '*/15 * * * * root bash $APP/scripts/booking-reminders.sh >> /var/log/shubhora-booking-reminders.log 2>&1' > /etc/cron.d/shubhora-booking-reminders"
echo "→ health check…"
curl --fail --silent --show-error -o /dev/null -w "   homepage %{http_code}\n" \
  --resolve $SITE_HOST:443:148.72.247.91 $SITE_URL/ --max-time 30
curl --fail --silent --show-error -o /dev/null -w "   application %{http_code}\n" \
  --resolve $SITE_HOST:443:148.72.247.91 $SITE_URL/api/health --max-time 30
echo "✓ deployed"
