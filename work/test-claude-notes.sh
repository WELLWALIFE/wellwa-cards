# Read-only: what the server has sent to the TEST Claude account (notification_log) — types, channels, results. No numbers printed.
cd /opt/neuraledge/app || exit 1
U="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
K="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
curl -s "$U/rest/v1/notification_log?user_id=eq.b1269c12-5d10-4346-8a20-57af68c3d3c0&select=created_at,type,channel,ok,error&order=created_at.desc&limit=20" -H "apikey: $K" -H "Authorization: Bearer $K"; echo
