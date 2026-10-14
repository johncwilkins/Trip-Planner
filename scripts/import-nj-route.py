import xml.etree.ElementTree as E,datetime as D,math,json,pathlib,statistics,bisect
import argparse
parser=argparse.ArgumentParser(description='Import a timestamped NJ inside passage track.');parser.add_argument('gpx');args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];n={'g':'http://www.topografix.com/GPX/1/1'};raw=E.parse(args.gpx).findall('.//g:trkpt',n)
a=[[float(x.get('lat')),float(x.get('lon')),D.datetime.fromisoformat(x.find('g:time',n).text.replace('Z','+00:00')).timestamp()] for x in raw]
def distance(a,b):
 la,lo,lb,lob=map(math.radians,[a[0],a[1],b[0],b[1]]);return 3440.065*2*math.asin(min(1,math.sqrt(math.sin((lb-la)/2)**2+math.cos(la)*math.cos(lb)*math.sin((lob-lo)/2)**2)))
# Keep docking approach, trim sustained stationary tail. Find final movement outside the dock cluster.
end=next(i for i in range(len(a)-1,-1,-1) if distance(a[i],a[-1])>0.012)
start=next(i for i,x in enumerate(a) if distance(x,a[0])>0.002)
# These low-progress waits are distinguishable from the slow but steady channel passage.
windows=[(11210,11430,'Margate bridge wait'),(12976,14224,'Margate/Ventnor bridge-area hold')]
remove={i for lo,hi,_ in windows for i in range(lo+1,hi)}
keep=[i for i in range(start,end+1) if i not in remove];clean=[a[i] for i in keep];points=[];s=0;elapsed=0;removed=0
for j,i in enumerate(keep):
 if j:
  prev=keep[j-1];dist=distance(a[prev],a[i]);dt=a[i][2]-a[prev][2]
  if i-prev>1:replacement=dist/6*3600;removed+=dt-replacement;dt=replacement
  elapsed+=dt;s+=dist
 if not points or elapsed-points[-1][2]>=10 or j==len(keep)-1:points.append([a[i][0],a[i][1],elapsed,s])
# Smoothed progress identifies speed-restricted sections. A recorded low speed is a timing proxy,
# not an assertion of the legally designated no-wake boundary.
for j,p in enumerate(points):
 lo=max(0,j-3);hi=min(len(points)-1,j+3);dt=points[hi][2]-points[lo][2];kn=(points[hi][3]-points[lo][3])*3600/dt if dt else 3
 p.append(None if kn>=18 else round(max(1,min(18,kn)),2))
stations=json.load(open(root/'config/nj-tide-catalog.json'))['stations']
def near(st):
 best=None
 for x,y in zip(points,points[1:]):
  c=math.cos(math.radians((x[0]+y[0])/2));dx=(y[1]-x[1])*c;dy=y[0]-x[0];z=dx*dx+dy*dy
  f=max(0,min(1,((st['lng']-x[1])*c*dx+(st['lat']-x[0])*dy)/z)) if z else 0
  lat=x[0]+f*(y[0]-x[0]);lon=x[1]+f*(y[1]-x[1]);d=distance([lat,lon],[st['lat'],st['lng']])
  if best is None or d<best['offsetNm']:best=dict(offsetNm=round(d,3),seconds=x[2]+f*(y[2]-x[2]),distance=x[3]+f*(y[3]-x[3]),routeLat=lat,routeLon=lon)
 return best
ss=[]
for st in stations:
 if st.get('state')!='NJ' or not 38.94<=st['lat']<=39.97 or any(w in st['name'].lower() for w in ['ocean','pier','ferry terminal','cape island']):continue
 q=near(st)
 if q['offsetNm']<=1.2 or st['id'] in ['8533615','8533051']:
  ss.append(dict(id=st['id'],name=st['name'],lat=st['lat'],lon=st['lng'],sub=st['type']=='S',**q))
ss.sort(key=lambda x:x['distance'])
ends=[dict(key='cape-may',name='Cape May · Canyon Club',distance=0,lat=points[0][0],lon=points[0][1])]
for key,name,station in [('stone-harbor','Stone Harbor','8535581'),('avalon','Avalon · Ingram Thorofare','8535451'),('sea-isle','Sea Isle · Ludlam Bay','8535221'),('ocean-city','Ocean City · north end','8534836'),('atlantic-city','Atlantic City · Absecon Channel','8534638'),('beach-haven','LBI · Beach Haven','8534208'),('lbi','LBI · Manahawkin Bridge','8533935'),('barnegat','Barnegat Inlet · ICW junction','8533631')]:
 st=next(x for x in ss if x['id']==station);ends.append(dict(key=key,name=name,distance=st['distance'],lat=st['routeLat'],lon=st['routeLon']))
ends.append(dict(key='toms-river',name="Toms River · Dillon’s Creek",distance=points[-1][3],lat=points[-1][0],lon=points[-1][1]));ends.sort(key=lambda x:x['distance'])
report=dict(originalHours=(a[-1][2]-a[0][2])/3600,trimmedStartMinutes=(a[start][2]-a[0][2])/60,trimmedFinishMinutes=(a[-1][2]-a[end][2])/60,bridgeWaitMinutes=removed/60,cleanedRecordedHours=elapsed/3600,bridgeWindows=[x[2] for x in windows])
(root/'dist/nj/route.json').write_text(json.dumps(dict(name="Canyon Club Resort Marina → Dillon's Creek Marina",recordedDate='2022-08-29',referenceCruiseKnots=26,totalNm=s,points=points,endpoints=ends,stations=ss,timing=report),separators=(',',':')))
(root/'config/nj-tide-stations.json').write_text(json.dumps(ss,indent=2));print(report);print('distance',s,'points',len(points),'stations',len(ss))
