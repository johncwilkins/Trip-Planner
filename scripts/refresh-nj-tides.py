"""Fetch and maintain the NJ page's shared NOAA weekly tide cache.
Uses the main current cache's 57-week coverage; downloads only missing station-weeks
on refresh. Initial population batches missing weeks into at most yearly requests.
"""
import json,pathlib,datetime as dt,urllib.request,urllib.parse,time,concurrent.futures
root=pathlib.Path(__file__).resolve().parents[1];out=root/'dist/nj/tides';out.mkdir(parents=True,exist_ok=True)
manifest=json.load(open(root/'dist/predictions/manifest.json'));stations=json.load(open(root/'config/nj-tide-stations.json'));weeks=manifest['weeks']
def fetch(st):
 folder=out/st['id'];folder.mkdir(exist_ok=True);missing=[w for w in weeks if not (folder/(w+'.json')).exists()]
 if not missing:return 0
 # Initial load in broad batches, incremental load only for missing weeks.
 groups=[]
 for w in missing:
  a=dt.date.fromisoformat(w)
  if groups and a-groups[-1][-1]==dt.timedelta(days=7) and (a-groups[-1][0]).days<350:groups[-1].append(a)
  else:groups.append([a])
 count=0
 for group in groups:
  begin=group[0]-dt.timedelta(days=1);end=group[-1]+dt.timedelta(days=8)
  params=dict(station=st.get('sourceStationId',st['id']),product='predictions',datum='MLLW',interval='hilo',units='english',time_zone='gmt',format='json',begin_date=begin.strftime('%Y%m%d'),end_date=end.strftime('%Y%m%d'),application='NJInsidePassagePlanner')
  url='https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+urllib.parse.urlencode(params)
  for attempt in range(4):
   try:
    raw=json.load(urllib.request.urlopen(url,timeout=60))
    if raw.get('error'):raise RuntimeError(str(raw['error']))
    rows=[[int(dt.datetime.fromisoformat(x['t']).replace(tzinfo=dt.timezone.utc).timestamp()),float(x['v']),x['type']] for x in raw['predictions']];assert len(rows)>5
    break
   except Exception:
    if attempt==3:raise
    time.sleep(attempt+1)
  for a in group:
   lo=int(dt.datetime.combine(a-dt.timedelta(days=1),dt.time(),dt.timezone.utc).timestamp());hi=lo+9*86400
   block=dict(id=st['id'],sourceStationId=st.get('sourceStationId',st['id']),datum='MLLW',units='ft',interval='hilo',events=[x for x in rows if lo<=x[0]<=hi]);assert len(block['events'])>=28
   path=folder/(str(a)+'.json');temp=path.with_suffix('.tmp');temp.write_text(json.dumps(block,separators=(',',':')));temp.replace(path);count+=1
 return count
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for st,n in zip(stations,pool.map(fetch,stations)):print(st['id'],st['name'],n,'blocks',flush=True)
coverage=dict(source='NOAA CO-OPS predictions',datum='MLLW',units='ft',departureStart=manifest['departureStart'],departureEnd=manifest['departureEnd'],weeks=weeks,retrievedAt=dt.datetime.now(dt.timezone.utc).isoformat(),stations=stations)
path=out/'manifest.json';temp=path.with_suffix('.tmp');temp.write_text(json.dumps(coverage,separators=(',',':')));temp.replace(path)
for st in stations:
 for p in (out/st['id']).glob('*.json'):
  if p.stem not in weeks:p.unlink()
print('NJ tide cache complete',len(stations)*len(weeks),'blocks',flush=True)
