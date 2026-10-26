import xml.etree.ElementTree as E,json,math,datetime as dt
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description='Build Absecon and Barnegat ocean route alternatives from owner-approved recorded GPX files.');parser.add_argument('absecon_gpx');parser.add_argument('barnegat_gpx');args=parser.parse_args()
root=Path(__file__).resolve().parents[1];r=json.loads((root/'dist/nj/route.json').read_text());ns={'g':'http://www.topografix.com/GPX/1/1'}
def load(name):
 return [[float(p.get('lat')),float(p.get('lon')),dt.datetime.fromisoformat(p.findtext('g:time',namespaces=ns).replace('Z','+00:00')).timestamp()] for p in E.parse(name).findall('.//g:trkpt',ns)]
def d(a,b):return math.hypot((a[0]-b[0])*60,(a[1]-b[1])*60*math.cos(math.radians((a[0]+b[0])/2)))
a=load(args.absecon_gpx);b=load(args.barnegat_gpx)
def join(raw,low,high):
 return min(( (d(p,q),i,j) for i,p in enumerate(raw) if low<p[0]<high and i%5==0 for j,q in enumerate(r['points']) if low<q[0]<high))
ja=join(a,39.39,39.44);jb=join(b,39.79,39.81);print('joins distance/index',ja,jb)
def sample(raw,first,last):
 ids=list(range(first,last,10))+[last];out=[]
 for i in ids:
  lo=max(first,i-30);hi=min(last,i+30);speed=d(raw[lo],raw[hi])*3600/max(1,raw[hi][2]-raw[lo][2]);out.append(raw[i][:2]+[None if speed>=18 else round(max(2,speed),2)])
 return out
# Each alternative is a replacement for the southern ICW, stored Cape May -> northern junction.
ac=sample(a,ja[1],14923);ac.reverse()
bar=sample(b,jb[1],2900);bar.reverse()
# Retain recorded Cape May/Absecon ocean track south of 39.34; connect seaward of the coast.
outi=min(range(len(a)),key=lambda i:d(a[i],[39.3331,-74.4334]));south=sample(a,outi,14923);south.reverse()
connector=[[39.34,-74.40,None],[39.40,-74.32,None],[39.50,-74.22,None],[39.60,-74.13,None],[39.70,-74.04,None]]
# Northern exit of connector joins recorded Barnegat track at its offshore endpoint.
obj={'schemaVersion':1,'alternatives':{'absecon':{'label':'Ocean via Absecon ↔ Cape May','joinDistance':r['points'][ja[2]][3],'points':ac,'sourceDate':'2022-08-25','joinOffsetNm':ja[0],'note':'Recorded Absecon and Cape May approaches; offshore timing uses ocean cruise speed.'},'barnegat':{'label':'Ocean via Barnegat ↔ Cape May','joinDistance':r['points'][jb[2]][3],'points':south+connector+bar,'sourceDate':'2026-08-22 / 2022-08-25','joinOffsetNm':jb[0],'note':'Recorded Barnegat approach and Cape May approach joined by a constructed offshore planning leg. Fishing and return portions excluded; offshore connector is not a recorded track.'}}}
for alt in obj['alternatives'].values():
 for pt in alt['points']:
  if 38.96<pt[0]<39.34:pt[2]=None
(root/'dist/nj/ocean-routes.json').write_text(json.dumps(obj,separators=(',',':')))
