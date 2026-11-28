# Read-only: what the database says about Radhe_Radhe's "Answer only new numbers" switch, and when the card was last saved.
cd /opt/neuraledge/app || exit 1
U="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
K="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
H=(-H "apikey: $K" -H "Authorization: Bearer $K")
curl -s "$U/rest/v1/cards?username=eq.jai-dev-rajwal&select=username,onlyNew:data->botFollow->onlyNew" "${H[@]}"; echo
date -u
pm2 logs --lines 8000 --nostream 2>/dev/null | grep "tenant:d3987693" | grep -v -i "key\|token" | tail -6
