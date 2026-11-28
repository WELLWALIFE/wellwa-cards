# Read-only: Radhe_Radhe's AI Training data as saved (links, notes start) — what the bot should send.
cd /opt/neuraledge/app || exit 1
U="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
K="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
H=(-H "apikey: $K" -H "Authorization: Bearer $K")
echo "--- AI Training: files and links ---"
curl -s "$U/rest/v1/cards?username=eq.jai-dev-rajwal&select=f:data->botFiles" "${H[@]}" | sed 's/},{/},\n{/g'; echo
echo "--- card buttons with a join / signup link ---"
curl -s "$U/rest/v1/cards?username=eq.jai-dev-rajwal&select=data" "${H[@]}" | grep -o '"joinUrl":"[^"]*"\|"referralCode":"[^"]*"' | sort -u
echo "--- last messages the bot SENT (links) ---"
pm2 logs --lines 8000 --nostream 2>/dev/null | grep "tenant:d3987693" | grep -i "http" | grep -v -i "key\|token" | tail -8
