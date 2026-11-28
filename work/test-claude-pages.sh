# Read-only: TEST Claude card pages — every block's kind, title and picture addresses.
cd /opt/neuraledge/app || exit 1
U="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
K="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
curl -s "$U/rest/v1/cards?username=eq.test-claude-ignore&select=data" -H "apikey: $K" -H "Authorization: Bearer $K" > /tmp/vipin-card.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/vipin-card.json'))[0]['data']
for pg in d.get('pages') or []:
    print('PAGE', pg.get('slug'))
    for b in pg.get('blocks') or []:
        urls=[]
        def walk(o,p=''):
            if isinstance(o,dict):
                for k,v in o.items(): walk(v,p+'.'+k)
            elif isinstance(o,list):
                for i,v in enumerate(o): walk(v,f'{p}[{i}]')
            elif isinstance(o,str) and o.startswith('http'): urls.append(p+'='+o.split('/')[-1])
        walk(b)
        print('  ', b.get('id'), b.get('kind'), '|', (b.get('title') or '')[:40], '|', urls[:8])
s=d.get('site') or {}
print('hero:', json.dumps({k:v for k,v in (s.get('hero') or {}).items() if k!='slides'})[:500])
print('slides:', json.dumps(s.get('hero',{}).get('slides'))[:800])
print('home:', json.dumps(s.get('home'))[:600])
PY
rm -f /tmp/vipin-card.json
U="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
K="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"'\r")"
echo "--- products"
curl -s "$U/rest/v1/poster_products?user_id=eq.b1269c12-5d10-4346-8a20-57af68c3d3c0&select=name,brand,price,mrp,benefits,photos&order=sort" -H "apikey: $K" -H "Authorization: Bearer $K" | python3 -c "
import sys,json
for r in json.load(sys.stdin): print(r['name'],'|',r['brand'],'| mrp',r['mrp'],'|',len(r.get('photos') or []),'photos |',' · '.join(r.get('benefits') or [])[:150])"
