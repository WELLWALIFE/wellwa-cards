# Read-only: the "TEST Claude" account(s) — plan, set-up, cards, products. Prints no keys, no emails, no phones.
cd /opt/neuraledge/app || exit 1
U="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
K="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
H=(-H "apikey: $K" -H "Authorization: Bearer $K")
curl -s "$U/rest/v1/profiles?or=(full_name.ilike.*test*claude*,business.ilike.*test*claude*)&select=id,full_name,business,plan,plan_source,plan_expires_at,package,package_until,saas_tier,saas_expires_at,created_at" "${H[@]}" > /tmp/tc.json
python3 - <<'PY'
import json
rows=json.load(open('/tmp/tc.json'))
print(len(rows),'profile(s)')
for r in rows: print(json.dumps(r, ensure_ascii=False))
open('/tmp/tc-ids','w').write('\n'.join(r['id'] for r in rows))
PY
for id in $(cat /tmp/tc-ids); do
  echo "--- $id"
  curl -s "$U/rest/v1/cards?owner_id=eq.$id&select=username,name" "${H[@]}"; echo
  curl -s "$U/rest/v1/poster_products?user_id=eq.$id&select=name" "${H[@]}" | head -c 300; echo
  curl -s "$U/rest/v1/poster_profiles?user_id=eq.$id&select=*" "${H[@]}" | python3 -c "import sys,json; d=json.load(sys.stdin); [print({k:(str(v)[:120]) for k,v in r.items() if k not in ('phone','email','whatsapp')}) for r in d]" 2>/dev/null | head -c 2500; echo
done
rm -f /tmp/tc.json /tmp/tc-ids
