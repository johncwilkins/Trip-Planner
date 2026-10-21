"""Join the saved southern track to a timestamped northern GPX; omit marina branch.
Usage: python scripts/extend-nj-route.py BASE_ROUTE NORTHERN_GPX NOAA_CATALOG
The base is the pre-extension route.json. Original southern timing stays intact.
"""
import argparse,datetime as dt,json,math,pathlib,xml.etree.ElementTree as E
args=argparse.ArgumentParser();args.add_argument('base');args.add_argument('gpx');args.add_argument('catalog');a=args.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];route=json.loads(pathlib.Path(a.base).read_text());original=route['points']
if route.get('extension'):raise ValueError('Supply the original southern route, not an extended route')
ns={'g':'http://www.topografix.com/GPX/1/1'}
raw=[[float(p.get('lat')),float(p.get('lon')),dt.datetime.fromisoformat(p.find('g:time',ns).text.replace('Z','+00:00')).timestamp()] for p in E.parse(a.gpx).findall('.//g:trkpt',ns)]
def dist(a,b):
 x,y,u,v=map(math.radians,[a[0],a[1],b[0],b[1]]);return 6880.13*math.asin(min(1,math.sqrt(math.sin((u-x)/2)**2+math.cos(x)*math.cos(u)*math.sin((v-y)/2)**2)))
# Main-channel join south of Route 37. The branch west into Dillon's Creek is omitted.
cut=min(range(len(original)),key=lambda i:dist(original[i],[39.931601,-74.101599]));first=min(range(300,600),key=lambda i:dist(raw[i],[39.941060,-74.106960]));last=min(range(4000,4300),key=lambda i:dist(raw[i],[40.1008333333,-74.0319444444]))
points=[p[:] for p in original[:cut+1]];start=points[-1];end=raw[first];controls=[start,[39.9345,-74.1040],[39.9385,-74.1083],end]
for i in range(1,31):
 t=i/30;lat,lon=[sum(controls[j][k]*[(1-t)**3,3*(1-t)**2*t,3*(1-t)*t*t,t**3][j] for j in range(4)) for k in [0,1]]
 d=dist(points[-1],[lat,lon]);points.append([lat,lon,points[-1][2]+d/26*3600,points[-1][3]+d,None])
joinEnd=points[-1][3];sample=[raw[first]]
for p in raw[first+1:last+1]:
 if p[2]-sample[-1][2]>=10:sample.append(p)
if sample[-1]!=raw[last]:sample.append(raw[last])
# Derive slow patterns from recorded distance/time; no stationary bridge holds occur here.
for i in range(1,len(sample)):
 p=sample[i];lo=max(0,i-3);hi=min(len(sample)-1,i+3);speed=sum(dist(x,y) for x,y in zip(sample[lo:hi],sample[lo+1:hi+1]))*3600/(sample[hi][2]-sample[lo][2]);cap=None if speed>=18 else round(max(1,min(18,speed)),2)
 d=dist(sample[i-1],p);seconds=d/26*3600 if cap is None else p[2]-sample[i-1][2]
 points.append([p[0],p[1],points[-1][2]+seconds,points[-1][3]+d,cap])
def near(lat,lon):
 best=None
 for x,y in zip(points,points[1:]):
  c=math.cos(math.radians(lat));dx=(y[1]-x[1])*c;dy=y[0]-x[0];z=dx*dx+dy*dy;f=max(0,min(1,((lon-x[1])*c*dx+(lat-x[0])*dy)/z)) if z else 0
  la=x[0]+f*(y[0]-x[0]);lo=x[1]+f*(y[1]-x[1]);offset=dist([lat,lon],[la,lo])
  if best is None or offset<best['offsetNm']:best=dict(offsetNm=offset,seconds=x[2]+f*(y[2]-x[2]),distance=x[3]+f*(y[3]-x[3]),routeLat=la,routeLon=lo)
 return best
stations=route['stations']
for st in stations:
 if st['distance']>=original[cut][3]:st.update(near(st['lat'],st['lon']))
catalog={s['id']:s for s in json.loads(pathlib.Path(a.catalog).read_text())['stations']}
for id in ['8533005','8532885','8532786','8532715','8532585','8532591']:
 st=catalog[id];stations=[s for s in stations if s['id']!=id];stations.append(dict(id=id,name=st['name'],lat=st['lat'],lon=st['lng'],sub=st['type']=='S',**near(st['lat'],st['lng'])))
route['stations']=sorted(stations,key=lambda s:s['distance']);route['points']=points;route['totalNm']=points[-1][3];route['name']='Cape May → Manasquan Inlet · inside passage';route['recordedDates']=['2022-08-29','2025-07-18']
ends=[e for e in route['endpoints'] if e['key']!='toms-river']
for key,name,lat,lon in [('toms-river','Toms River · ICW junction',39.936,-74.106),('lavallette','Lavallette · ICW',39.970,-74.103),('bay-head','Bay Head · canal entrance',40.067,-74.054)]:
 q=near(lat,lon);ends.append(dict(key=key,name=name,distance=q['distance'],lat=q['routeLat'],lon=q['routeLon']))
ends.append(dict(key='manasquan',name='Manasquan Inlet',distance=points[-1][3],lat=points[-1][0],lon=points[-1][1]));route['endpoints']=sorted(ends,key=lambda x:x['distance'])
route['extension']=dict(recordedDate='2025-07-18',source='Owner-supplied recorded GPX, northern inside portion only',joinStartNm=original[cut][3],joinEndNm=joinEnd,joinMethod='Short smooth main-channel connector; marina detour omitted. Connector checked against NOAA ENC land polygons; not a recorded or depth-validated leg.',openWaterTiming='Normalized to 26 kn; recorded slow-section timing retained',movingHours=points[-1][2]/3600)
canal=json.loads((root/'config/nj-canal-current.json').read_text());canal['startNm']=near(*canal['startPosition'])['distance'];canal['endNm']=near(*canal['endPosition'])['distance'];route['canalCurrent']=canal
(root/'dist/nj/route.json').write_text(json.dumps(route,separators=(',',':')))
config=json.loads((root/'config/nj-tide-stations.json').read_text());extras=[s for s in config if s.get('bridgeSourceOnly') or s.get('sourceStationId')];(root/'config/nj-tide-stations.json').write_text(json.dumps(route['stations']+extras,indent=2)+'\n')
print('Extended',round(route['totalNm'],2),'nm;',len(points),'points;',round(points[-1][2]/3600,2),'moving hours')
