# Read-only: Vipin Thakkar's products block and Showroom gallery block, full JSON.
cd /opt/neuraledge/app || exit 1
U="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
K="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
curl -s "$U/rest/v1/cards?username=eq.vipin-thakkar&select=id,data" -H "apikey: $K" -H "Authorization: Bearer $K" > /tmp/vipin-card.json
python3 - <<'PY'
import json
r=json.load(open('/tmp/vipin-card.json'))[0]; d=r['data']
print('card id', r['id'])
for pg in d['pages']:
    for b in pg['blocks']:
        if b['id'] in ('zpmimxgo','3twjg8d6'): print(json.dumps(b, ensure_ascii=False, indent=1))
PY
rm -f /tmp/vipin-card.json
