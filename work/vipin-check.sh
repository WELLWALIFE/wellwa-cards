# Read-only: Vipin Thakkar's card (vipin-thakkar) — products, gallery, banners.
cd /opt/neuraledge/app || exit 1
U="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
K="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
H=(-H "apikey: $K" -H "Authorization: Bearer $K")
UID_="$(curl -s "$U/rest/v1/cards?username=eq.vipin-thakkar&select=owner_id" "${H[@]}" | grep -o '"owner_id":"[^"]*"' | head -1 | cut -d'"' -f4)"
echo "user: $UID_"
echo "--- poster_products ---"
curl -s "$U/rest/v1/poster_products?user_id=eq.$UID_&select=*" "${H[@]}" | sed 's/},{/},\n{/g'; echo
echo "--- card data keys ---"
curl -s "$U/rest/v1/cards?username=eq.vipin-thakkar&select=data" "${H[@]}" > /tmp/vipin-card.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/vipin-card.json'))[0]['data']
s=d.get('site') or {}
print('site keys:', list(s.keys()) if isinstance(s,dict) else type(s))
def walk(o,path=''):
    if isinstance(o,dict):
        for k,v in o.items(): walk(v,path+'.'+k)
    elif isinstance(o,list):
        for i,v in enumerate(o): walk(v,f'{path}[{i}]')
    elif isinstance(o,str) and (o.startswith('http') or any(w in path.lower() for w in ['title','name','layout','design','template','fit','crop','position'])):
        print(path, '=', o[:160])
walk(s,'site')
print('template =', d.get('template'), ' pages keys =', list((d.get('pages') or {}).keys()) if isinstance(d.get('pages'),dict) else str(d.get('pages'))[:300])
PY
rm -f /tmp/vipin-card.json
