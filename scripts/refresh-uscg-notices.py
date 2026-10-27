"""Refresh NAVCEN notices; retain prior data and report failed source coverage."""
import concurrent.futures,datetime as dt,json,pathlib,subprocess,urllib.request,urllib.error,time,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='https://www.navcen.uscg.gov/sites/default/files/msi/'
def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'BitterRadish-TripPlanner/1.0'}),timeout=40) as response:
                return json.load(response)
        except urllib.error.HTTPError as e:
            if e.code==403 and 'www.navcen.uscg.gov' in url:
                # NAVCEN publishes both official hostnames. Try its canonical
                # non-www download host with the same ordinary request headers.
                return get(url.replace('https://www.navcen.uscg.gov/','https://navcen.uscg.gov/',1))
            if e.code in (403,404) or attempt==2:raise
            time.sleep(2*(attempt+1))
        except Exception:
            if attempt==2:raise
            time.sleep(2*(attempt+1))
def node(program,data):
    result=subprocess.run(['node','-e',program],input=json.dumps(data),text=True,capture_output=True,cwd=ROOT,check=True)
    return json.loads(result.stdout)
def main():
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
    # plus unlocated district-wide notices. The page applies its selected route corridor.
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
    notices=node("const U=require('./dist/uscg-notices.js');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{const d=JSON.parse(s);process.stdout.write(JSON.stringify(U.trackChanges(d.notices,d.prior,d.now)));});",dict(notices=notices,prior=prior.get('notices',[]),now=now))
    out=dict(schemaVersion=1,source='USCG NAVCEN geographic Local Notice to Mariners / MSI files',sourceUrl='https://www.navcen.uscg.gov/msi',retrievedAt=now,refreshCadenceDays=7,complete=not failed,lastCompleteAt=now if not failed else prior.get('lastCompleteAt'),unavailableFiles=failed,coverage='NJ recorded route plus a five-nautical-mile bounding margin; unlocated District 5 notices included',files=files,notices=notices)
    tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(out,separators=(',',':')));tmp.replace(p)
    audit=node("const A=require('./scripts/audit-uscg-aids.cjs');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{const d=JSON.parse(s);process.stdout.write(JSON.stringify(A.buildAudit(d.before,d.after)));});",dict(before=prior,after=out))
    audit_path=ROOT/'dist/nj/aid-audit.json'
    audit_temp=audit_path.with_suffix('.tmp');audit_temp.write_text(json.dumps(audit,indent=2));audit_temp.replace(audit_path)
    # Keep a separate coastal snapshot: unlike the NJ cache, cover the whole
    # published C&D-to-Nantucket course and retain only located records.
    coast_path=ROOT/'dist/nj/currents-uscg-notices.json'
    coast_prior=dict(notices=prior.get('coastalNotices',[]),lastCompleteAt=prior.get('coastalLastCompleteAt'))
    coastal=node("const U=require('./dist/uscg-notices.js'),P=require('./dist/engine.js');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{const d=JSON.parse(s),route=P.routes.coast.points.map(p=>[p.lon,p.lat]);const n=d.batches.flatMap(b=>b.features.map(f=>U.normalize(f,b.file))).filter(n=>n&&n.geometry&&U.nearRoute(n.geometry,route,5));process.stdout.write(JSON.stringify(U.merge(n)));});",dict(batches=batches))
    coastal=node("const U=require('./dist/uscg-notices.js');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{const d=JSON.parse(s);process.stdout.write(JSON.stringify(U.trackChanges(U.merge(d.notices),d.prior,d.now)));});",dict(notices=coastal+[n for n in coast_prior.get('notices',[]) if n['sourceUrl'] in failed_urls],prior=coast_prior.get('notices',[]),now=now))
    coast_out=dict(schemaVersion=1,source='USCG NAVCEN geographic Local Notice to Mariners / MSI files',sourceUrl='https://www.navcen.uscg.gov/msi',retrievedAt=now,refreshCadenceDays=7,complete=not failed,lastCompleteAt=now if not failed else coast_prior.get('lastCompleteAt'),unavailableFiles=failed,coverage='Located notices within five nautical miles of the C&D-to-Nantucket planning course; unlocated district notices excluded',files=files,notices=coastal)
    out['coastalNotices']=coastal;out['coastalCoverage']=coast_out['coverage'];out['coastalLastCompleteAt']=coast_out['lastCompleteAt']
    tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(out,separators=(',',':')));tmp.replace(p)
    print(f'Coast Guard snapshot saved: {len(files)} source files, {len(notices)} regional notices; {len(failed)} unavailable files; {now}',flush=True)
    write_status('complete' if not failed else 'partial',unavailableFiles=failed)
def write_status(status,**details):
    p=ROOT/'dist/nj/uscg-refresh-status.json'
    temp=p.with_suffix('.tmp');temp.write_text(json.dumps(dict(status=status,attemptedAt=dt.datetime.now(dt.timezone.utc).isoformat(),**details),separators=(',',':')));temp.replace(p)
if __name__=='__main__':
    try:main()
    except Exception as e:
        write_status('failed',error=str(e))
        print('Coast Guard refresh failed; prior snapshot preserved: '+str(e),file=sys.stderr)
        sys.exit(1)
