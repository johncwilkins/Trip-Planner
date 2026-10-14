"""Build shared NOAA current prediction files. Resumable; no visitor API calls."""
import json,pathlib,datetime as dt,urllib.request,urllib.parse,time,concurrent.futures,calendar
root=pathlib.Path(__file__).resolve().parents[1];out=root/'dist'/'predictions';out.mkdir(exist_ok=True)
stations=json.load(open(root/'config/stations.json'))
months=[]
for i in range(13):
 m=10+i;y=2026+(m-1)//12;m=(m-1)%12+1;start=dt.date(y,m,1);end=dt.date(y,m,calendar.monthrange(y,m)[1]);
 if i==12:end=dt.date(2027,10,10)
 months.append((start,end))
manifest={'source':'NOAA CO-OPS currents_predictions','retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'departureStart':'2026-10-07','departureEnd':'2027-10-06','dataStart':'2026-10-01','dataEnd':'2027-10-10','stations':stations,'months':[a.strftime('%Y-%m') for a,b in months]}
(out/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
def get(job):
 s,a,b=job;folder=out/s['id'];folder.mkdir(exist_ok=True);file=folder/(a.strftime('%Y-%m')+'.json')
 if file.exists():
  d=json.loads(file.read_text())
  if d.get('bin')==s['bin'] and d.get('end')==str(b):return False
 params=dict(begin_date=a.strftime('%Y%m%d'),end_date=b.strftime('%Y%m%d'),station=s['id'],product='currents_predictions',time_zone='gmt',interval='max_slack' if s['sub'] else '6',units='english',format='json',bin=s['bin'],application='CoastalCurrentPassagePlanner')
 u='https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+urllib.parse.urlencode(params)
 for attempt in range(4):
  try:
   with urllib.request.urlopen(u,timeout=65) as res:d=json.load(res)
   if d.get('error'):raise RuntimeError(str(d['error']))
   cp=d['current_predictions']['cp'];assert len(cp)>2
   fd=float(cp[0]['meanFloodDir']);ed=float(cp[0]['meanEbbDir'])
   assert all(float(x['meanFloodDir'])==fd and float(x['meanEbbDir'])==ed for x in cp)
   epoch=lambda x:int(dt.datetime.fromisoformat(x['Time']).replace(tzinfo=dt.timezone.utc).timestamp()/60)
   p=dict(id=s['id'],bin=s['bin'],start=str(a),end=str(b),fd=fd,ed=ed,depth=cp[0]['Depth'],sub=s['sub'])
   if s['sub']:p['events']=[[epoch(x),round(float(x['Velocity_Major'])*100)] for x in cp]
   else:
    assert all(epoch(cp[i])-epoch(cp[i-1])==6 for i in range(1,len(cp)))
    expected=(b-a).days*240+240;assert len(cp)==expected,(s['id'],len(cp),expected)
    p.update(t0=epoch(cp[0]),step=6,v=[round(float(x['Velocity_Major'])*100) for x in cp])
   temp=file.with_suffix('.tmp');temp.write_text(json.dumps(p,separators=(',',':')));temp.replace(file)
   return True
  except Exception:
   if attempt==3:raise
   time.sleep(1+attempt*2)
jobs=[(s,a,b) for s in stations for a,b in months]
print('Fetching',len(jobs),'station-month files for',len(stations),'stations',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 done=0
 for result in ex.map(get,jobs):
  done+=1
  if done%13==0:print('Completed',done,'/',len(jobs),flush=True)
print('Year of predictions complete.',flush=True)
