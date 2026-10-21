"""Refresh NAVCEN geographic notices; publish only a complete validated snapshot."""
import concurrent.futures,datetime as dt,json,pathlib,subprocess,urllib.request,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='https://www.navcen.uscg.gov/sites/default/files/msi/'
def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'BitterRadish-TripPlanner/1.0'}),timeout=40) as response:
                return json.load(response)
        except Exception:
            if attempt==2:raise
            time.sleep(2*(attempt+1))
def node(program,data):
    result=subprocess.run(['node','-e',program],input=json.dumps(data),text=True,capture_output=True,cwd=ROOT,check=True)
    return json.loads(result.stdout)
index=get(BASE+'fileIndexNew.json')
files=node("const U=require('./dist/uscg-notices.js');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(U.files(JSON.parse(s)))));",index)
if not files:raise ValueError('No supported NAVCEN notice files in index')
def fetch(file):
    try:
        doc=get(file['url'])
        if doc.get('type')!='FeatureCollection' or not isinstance(doc.get('features'),list):raise ValueError('Invalid notice data')
        print('Fetched '+file['url'].rsplit('/',1)[-1],flush=True)
        return {'file':file,'features':doc['features']}
    except Exception as e:
        print('Unavailable '+file['url']+': '+str(e),flush=True)
        return {'file':file,'features':[], 'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    batches=list(pool.map(fetch,files))
failed=[dict(url=b['file']['url'],error=b['error']) for b in batches if 'error' in b]
if len(failed)==len(files):raise ValueError('Every NAVCEN file failed; prior snapshot preserved')
# Five-mile bounding margin retains notices near the full recorded route,
# plus unlocated district-wide notices. The page applies the 2 nm corridor.
route=json.loads((ROOT/'dist/nj/route.json').read_text())['points']
import math
bounds=dict(west=min(p[1] for p in route)-5/(60*math.cos(math.radians(39.5))),east=max(p[1] for p in route)+5/(60*math.cos(math.radians(39.5))),south=min(p[0] for p in route)-5/60,north=max(p[0] for p in route)+5/60)
notices=node("const U=require('./dist/uscg-notices.js');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{const d=JSON.parse(s);const n=d.batches.flatMap(b=>b.features.map(f=>U.normalize(f,b.file))).filter(n=>n&&U.inRegion(n,d.bounds));process.stdout.write(JSON.stringify(U.merge(n)));});",dict(batches=batches,bounds=bounds))
p=ROOT/'dist/nj/uscg-notices.json'
prior=json.loads(p.read_text()) if p.exists() else {}
failed_urls={f['url'] for f in failed}
# Retain earlier records from unavailable files; flag that coverage separately.
notices=node("const U=require('./dist/uscg-notices.js');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(U.merge(JSON.parse(s)))));",notices+[n for n in prior.get('notices',[]) if n['sourceUrl'] in failed_urls])
now=dt.datetime.now(dt.timezone.utc).isoformat()
out=dict(schemaVersion=1,source='USCG NAVCEN geographic Local Notice to Mariners / MSI files',sourceUrl='https://www.navcen.uscg.gov/msi',retrievedAt=now,refreshCadenceDays=7,complete=not failed,lastCompleteAt=now if not failed else prior.get('lastCompleteAt'),unavailableFiles=failed,coverage='NJ recorded route plus a five-nautical-mile bounding margin; unlocated District 5 notices included',files=files,notices=notices)
tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(out,separators=(',',':')));tmp.replace(p)
print(f'Coast Guard snapshot saved: {len(files)} source files, {len(notices)} regional notices; {len(failed)} unavailable files; {now}',flush=True)
