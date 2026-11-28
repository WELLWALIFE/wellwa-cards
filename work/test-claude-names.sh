# Read-only: the names the WhatsApp test-account rule looks at for TEST Claude (profile + cards). No phones, no emails.
cd /opt/neuraledge/app || exit 1
U="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
K="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
ID=b1269c12-5d10-4346-8a20-57af68c3d3c0
curl -s "$U/rest/v1/profiles?id=eq.$ID&select=full_name,business" -H "apikey: $K" -H "Authorization: Bearer $K"; echo
curl -s "$U/rest/v1/cards?owner_id=eq.$ID&select=username,name,company" -H "apikey: $K" -H "Authorization: Bearer $K"; echo
