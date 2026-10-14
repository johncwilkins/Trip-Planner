"""Maintain 57 weekly NOAA current blocks: four historical, 52 departure, one buffer. Resumable; prune only after success."""
import json,pathlib,datetime as dt,urllib.request,urllib.parse,time,concurrent.futures,os
from zoneinfo import ZoneInfo
root=pathlib.Path(__file__).resolve().parents[1];out=root/'dist/predictions';stations=json.load(open(root/'config/stations.json'))
today=dt.date.fromisoformat(os.environ['PASSAGE_REFRESH_DATE']) if os.environ.get('PASSAGE_REFRESH_DATE') else dt.datetime.now(ZoneInfo('America/New_York')).date()
start=today-dt.timedelta(days=today.weekday());weeks=[start+dt.timedelta(weeks=i) for i in range(-4,53)]
def stamp(d):return int(dt.datetime.combine(d,dt.time(),dt.timezone.utc).timestamp()/60)
def unpack(d):return d.get('events') or [[d['t0']+i*d['step'],v] for i,v in enumerate(d['v'])]
monthly={}
for s in stations:
 rows=[];meta=None
 for p in sorted((out/s['id']).glob('????-??.json')):
  d=json.loads(p.read_text());rows.extend(unpack(d));meta=d
 if rows:monthly[s['id']]=(meta,sorted(dict(rows).items()))
def get(job):
 s,a=job;b=a+dt.timedelta(days=6);folder=out/s['id'];folder.mkdir(parents=True,exist_ok=True);file=folder/(str(a)+'.json')
 if file.exists():
  d=json.loads(file.read_text())
  if d.get('bin')==s['bin'] and d.get('end')==str(b):return False
 begin=stamp(a);end=stamp(b+dt.timedelta(days=1));d=None;rows=[]
 if s['id'] in monthly:
  m,allrows=monthly[s['id']]
  if allrows[0][0]<=begin and allrows[-1][0]>=end-6:
   d=m;rows=[r for r in allrows if (begin-720 if s['sub'] else begin)<=r[0]<(end+720 if s['sub'] else end)]
 if not d:
  # Include adjacent events for subordinate interpolation at weekly boundaries.
  qa=a-dt.timedelta(days=1) if s['sub'] else a;qb=b+dt.timedelta(days=1) if s['sub'] else b
  params=dict(begin_date=qa.strftime('%Y%m%d'),end_date=qb.strftime('%Y%m%d'),station=s['id'],product='currents_predictions',time_zone='gmt',interval='max_slack' if s['sub'] else '6',units='english',format='json',bin=s['bin'],application='CoastalCurrentPassagePlanner')
  u='https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+urllib.parse.urlencode(params)
  for attempt in range(4):
   try:
    raw=json.load(urllib.request.urlopen(u,timeout=60))
    if raw.get('error'):raise RuntimeError(str(raw['error']))
    cp=raw['current_predictions']['cp'];assert len(cp)>2
    d=dict(fd=float(cp[0]['meanFloodDir']),ed=float(cp[0]['meanEbbDir']),depth=cp[0]['Depth'])
    rows=[[int(dt.datetime.fromisoformat(x['Time']).replace(tzinfo=dt.timezone.utc).timestamp()/60),round(float(x['Velocity_Major'])*100)] for x in cp]
    if s['sub']:rows=[r for r in rows if begin-720<=r[0]<end+720]
    break
   except Exception:
    if attempt==3:raise
    time.sleep(1+attempt*2)
 p=dict(id=s['id'],bin=s['bin'],start=str(a),end=str(b),fd=d['fd'],ed=d['ed'],depth=d['depth'],sub=s['sub'])
 if s['sub']:p['events']=rows
 else:
  assert len(rows)==7*240,(s['id'],a,len(rows));assert all(rows[i][0]-rows[i-1][0]==6 for i in range(1,len(rows)))
  p.update(t0=rows[0][0],step=6,v=[v for t,v in rows])
 temp=file.with_suffix('.tmp');temp.write_text(json.dumps(p,separators=(',',':')));temp.replace(file);return True
jobs=[(s,a) for s in stations for a in weeks];print('Maintaining',len(weeks),'weekly blocks for',len(stations),'stations',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 count=0
 for i,changed in enumerate(ex.map(get,jobs),1):
  count+=changed
  if i%57==0:print('Checked',i,'/',len(jobs),flush=True)
manifest=dict(source='NOAA CO-OPS currents_predictions',retrievedAt=dt.datetime.now(dt.timezone.utc).isoformat(),departureStart=str(start-dt.timedelta(weeks=4)),departureEnd=str(start+dt.timedelta(days=363)),dataStart=str(start-dt.timedelta(weeks=4)),dataEnd=str(start+dt.timedelta(days=370)),stations=stations,weeks=[str(a) for a in weeks],cacheWeeks=57,departureWeeks=52,historyWeeks=4,arrivalBufferHours=120)
p=out/'manifest.json';temp=p.with_suffix('.tmp');temp.write_text(json.dumps(manifest,separators=(',',':')));temp.replace(p)
keep=set(manifest['weeks'])
for s in stations:
 for p in (out/s['id']).glob('*.json'):
  if p.stem not in keep:p.unlink()
print('Weekly cache complete;',count,'new station-week files. Expired blocks pruned.',flush=True)

# Keep the NJ tide page on the same rolling 57-week window and deployment.
import subprocess,sys
if (root/'config/nj-tide-stations.json').exists():
 subprocess.run([sys.executable,str(root/'scripts/refresh-nj-tides.py')],check=True)
