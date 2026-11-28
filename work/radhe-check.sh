# Read-only check of one account's WhatsApp bot (no change on the server). Usage: ssh … 'bash -s' < work/radhe-check.sh
cd /opt/neuraledge/app || exit 1
U="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
K="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
H=(-H "apikey: $K" -H "Authorization: Bearer $K")
P="$(curl -s "$U/rest/v1/profiles?username=ilike.radhe*&select=id,username" "${H[@]}")"
echo "accounts: $(echo "$P" | grep -o '"username":"[^"]*"' | cut -d'"' -f4 | tr '\n' ' ')"
OWNER="$(echo "$P" | grep -o '"id":"[^"]*","username":"radhe_radhe"' | cut -d'"' -f4)"
[ -z "$OWNER" ] && OWNER="$(echo "$P" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)"
[ -z "$OWNER" ] && { echo "no account like radhe"; exit 0; }
ROW="$(curl -s "$U/rest/v1/cards?owner_id=eq.$OWNER&select=username,active" "${H[@]}")"
echo "owner: ${OWNER:0:8}  cards: $(echo "$ROW" | grep -o '"username":"[^"]*","active":[a-z]*' | tr '\n' ' ')"
T="bridge/tenants/$OWNER"
echo "linked on server: $( [ -f "$T/auth/creds.json" ] && echo yes || echo NO )"
echo "--- last lines of this account's bot ---"
pm2 logs --lines 8000 --nostream 2>/dev/null | grep "tenant:${OWNER:0:8}" | grep -v -i "key\|token" | tail -25
