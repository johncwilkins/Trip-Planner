(function(root){
const BASE='https://www.navcen.uscg.gov/sites/default/files/msi/',SOURCE='https://www.navcen.uscg.gov/msi';
const categories={discFedAidCor:'Federal aid discrepancy',discPriAidCor:'Private aid discrepancy',discFedAid:'Federal aid discrepancy',discPriAid:'Private aid discrepancy',tmpChange:'Temporary aid change',bridge:'Bridge notice',changeAdvNot:'Advance change notice',changeProp:'Proposed change',change:'Navigation change',hazNav:'Hazard to navigation',marCon:'Marine construction',marEvent:'Marine event',misc:'General notice',msib:'Marine safety bulletin',navalAct:'Naval activity',safeZone:'Safety zone',tessAdv:'Traffic advisory',spaceOps:'Space operations',autoVesselPoint:'Autonomous vessel operations',autoVessel:'Autonomous vessel operations'};
function category(key){return key.replace(/(?:Poly|Line)?_$/,'');}
function files(index){return Object.entries(index).filter(([k])=>categories[category(k)]).flatMap(([k,v])=>Array.from({length:v.counter},(_,i)=>({key:k,url:BASE+k+(i+1)+'.geojson',sourceUpdatedAt:v.timestamp?new Date(v.timestamp*1000).toISOString():null})));}
function positions(g){if(!g)return [];if(g.type==='GeometryCollection')return g.geometries.flatMap(positions);const walk=x=>typeof x?.[0]==='number'?[x]:Array.isArray(x)?x.flatMap(walk):[];return walk(g.coordinates).filter(p=>p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90);}
function date(v){if(v==null||v==='')return null;const d=new Date(v);return Number.isFinite(+d)?d.toISOString().slice(0,10):null;}
function normalize(f,file){
 const p=f.properties||{},g=f.geometry,kind=categories[category(file.key)],uid=p.MSI_UID??p.LNM_UID??f.id;
 if(uid==null||!kind)throw Error('Unrecognized Coast Guard notice schema.');
 const status=String(p.STATUS??p.MSI_STATUS??''),aid=/aid discrepancy$/.test(kind);if(/disapproved|draft|deleted/i.test(status)||(!aid&&/cancel/i.test(status)))return null;
 const title=String(p.TITLE||p.NAME||p.AID_NAME||kind),extra=[p.DISCREP_STATUS,p.TC_STATUS,p.DISCREP_CORR_STATUS,p.BNM_NUM?'BNM '+p.BNM_NUM:null,p.LLNR?'Light List '+p.LLNR:null].filter(Boolean).join(' · ');
 let geometry=g;
 if(!positions(geometry).length){const lon=Number(p.DECIMAL_LONGITUDE),lat=Number(p.DECIMAL_LATITUDE);geometry=p.DECIMAL_LONGITUDE!=null&&p.DECIMAL_LATITUDE!=null&&Number.isFinite(lon)&&Number.isFinite(lat)&&Math.abs(lon)<=180&&Math.abs(lat)<=90?{type:'Point',coordinates:[lon,lat]}:null;}
 return {id:(p.MSI_UID!=null?'msi-':'lnm-')+uid,title,category:kind,description:String(p.DESCRIPTION||extra||'See the Coast Guard source for details.'),waterway:String(p.WATERWAY_NAME||''),begin:date(p.BEGIN_DATE),end:date(p.END_DATE),reported:date(p.CREATE_DATE),modified:date(p.MODIFIED_DATE||p.CREATE_DATE),district:p.ATU,...(aid?{aidSource:{...p,correctedFile:/AidCor/.test(file.key)}}:{}),geometry,sourceUrl:file.url,sourceUpdatedAt:file.sourceUpdatedAt,officialUrl:SOURCE};
}
function inRegion(n,bounds){const pp=positions(n.geometry);return pp.length?Math.min(...pp.map(p=>p[0]))<=bounds.east&&Math.max(...pp.map(p=>p[0]))>=bounds.west&&Math.min(...pp.map(p=>p[1]))<=bounds.north&&Math.max(...pp.map(p=>p[1]))>=bounds.south:Number(n.district)===5;}
function merge(notices){const out=new Map();for(const n of notices){if(!n)continue;const old=out.get(n.id);if(!old||(n.aidSource?.correctedFile&&!old.aidSource?.correctedFile))out.set(n.id,n);else if(n.geometry&&JSON.stringify(old.geometry)!==JSON.stringify(n.geometry)){old.geometry={type:'GeometryCollection',geometries:[...(old.geometry?.type==='GeometryCollection'?old.geometry.geometries:old.geometry?[old.geometry]:[]),n.geometry]};}}return [...out.values()];}
function active(n,start,end=start){return (!n.begin||n.begin<=end)&&(!n.end||n.end>=start);}
function pointSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],z=dx*dx+dy*dy,t=z?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/z)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function intersects(a,b,c,d){const cross=(u,v,w)=>(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]),x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return x*y<=0&&z*w<=0&&Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]));}
function inside(p,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function nearRoute(geometry,route,corridorNm=2){
 if(!geometry)return true;
 if(geometry.type==='GeometryCollection')return geometry.geometries.some(g=>nearRoute(g,route,corridorNm));
 if(!route.length)return false;
 const cos=Math.cos(route[0][1]*Math.PI/180),xy=p=>[p[0]*60*cos,p[1]*60],track=route.map(xy),pts=positions(geometry);
 if(!pts.length)return false;
 const xx=track.map(p=>p[0]),yy=track.map(p=>p[1]),bx=pts.map(p=>xy(p)[0]),by=pts.map(p=>xy(p)[1]);
 if(Math.min(...bx)>Math.max(...xx)+corridorNm||Math.max(...bx)<Math.min(...xx)-corridorNm||Math.min(...by)>Math.max(...yy)+corridorNm||Math.max(...by)<Math.min(...yy)-corridorNm)return false;
 const coords=geometry.coordinates,kind=geometry.type;
 const polygons=kind==='Polygon'?[coords]:kind==='MultiPolygon'?coords:[];
 if(polygons.some(poly=>route.some(p=>inside(p,poly[0])&&!poly.slice(1).some(h=>inside(p,h)))))return true;
 let lines=kind==='LineString'?[coords]:kind==='MultiLineString'?coords:polygons.flat();
 if(kind==='Point'||kind==='MultiPoint')lines=pts.map(p=>[p]);
 for(const line of lines){const q=line.map(xy);for(let i=0;i<track.length;i++){if(q.some(p=>pointSegment(p,track[i],track[Math.min(i+1,track.length-1)])<=corridorNm))return true;for(let j=1;j<q.length;j++){const a=track[i],b=track[Math.min(i+1,track.length-1)],c=q[j-1],d=q[j];if(intersects(a,b,c,d)||Math.min(pointSegment(a,c,d),pointSegment(b,c,d))<=corridorNm)return true;}}}
 return false;
}
// A timestamp-only source edit does not make longstanding shoaling recent.
function contentKey(n){return JSON.stringify([n.title,n.category,n.description,n.waterway,n.begin,n.end,n.geometry]);}
function trackChanges(notices,previous,now){const old=new Map(previous.map(n=>[n.id,n]));return notices.map(n=>{const p=old.get(n.id);return {...n,contentChangedAt:p?(contentKey(n)!==contentKey(p)?now:p.contentChangedAt||null):null};});}
function readable(n){
 const codes={'STRUCT DEST':'Destroyed structure','STRUCT DMGD':'Damaged structure','DBD DEST':'Destroyed dayboard','DBD DMGD':'Damaged dayboard','DAYMK DMGD':'Damaged daymark','LT EXT':'Light extinguished','LT IMCH':'Improper light characteristic','OFF STATION':'Off station','HAZ NAV':'Navigation hazard','TRLB':'Temporary lighted buoy','MISSING':'Missing'};
 let text=n.description.replace(/(?: · )?Correction Status Unreported/gi,'').trim();
 for(const [code,label] of Object.entries(codes))text=text.replaceAll(code,label);
 return text;
}
function headline(n){return n.description.match(/(?:Bridge Name|Aid Name):\s*([^\n]+)/i)?.[1]?.trim()||(n.title.includes('/')?n.title.split('/').at(-1)+' · '+(n.waterway||n.title.split('/')[0]):n.title);}
function recentReason(n,now=Date.now(),days=90){
 const text=n.title+' '+n.description,shoaling=/shoal/i.test(text);
 const cutoff=new Date(now-days*86400000).toISOString().slice(0,10),today=new Date(now).toISOString().slice(0,10);
 const recent=d=>d&&d.slice(0,10)>=cutoff&&d.slice(0,10)<=today;
 const dated=shoaling?(n.begin||n.reported):(n.modified||n.reported||n.begin);
 if(/Advance change notice|Proposed change/.test(n.category)||/WAMS|Waterways Analysis|PERMIT APPLICATION PROCESS/i.test(text))return null;
 if(!readable(n).replace(/Light List \S+|See the Coast Guard source for details\.|[ ·/]/g,'').trim())return null;
 if(recent(n.contentChangedAt))return 'Notice content changed recently';
 if(recent(dated))return shoaling?'Recently reported shoaling':'Reported or updated within '+days+' days';
 // Keep explicit bridge restrictions that are still in force even when old.
 if(n.category==='Bridge notice'&&/clos(?:ed|ure)|will not open|unable to open|restricted|restriction|clearance.*reduc/i.test(text))return 'Existing bridge restriction';
 return null;
}
root.USCGNotices={contentKey,trackChanges,readable,headline,recentReason,BASE,SOURCE,files,normalize,inRegion,merge,active,nearRoute,positions};if(typeof module!=='undefined')module.exports=root.USCGNotices;
})(globalThis);
