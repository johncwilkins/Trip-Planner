(function(root){
const nm=(a,b)=>{const r=Math.PI/180,la=a[0]*r,lb=b[0]*r,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r;return 6880.13*Math.asin(Math.min(1,Math.sqrt(Math.sin(dl/2)**2+Math.cos(la)*Math.cos(lb)*Math.sin(dn/2)**2)));};
function betweenInlets(alternatives){
 const south=alternatives.absecon,north=alternatives.barnegat;
 let shared=0;while(shared<Math.min(south.points.length,north.points.length)&&nm(south.points[shared],north.points[shared])<1e-7)shared++;
 if(shared<2||shared===Math.min(south.points.length,north.points.length))throw Error('Saved inlet approaches cannot be joined.');
 // Leave the recorded Absecon approach at its seaward turn, avoiding a detour toward Cape May.
 const seaward=south.points.reduce((best,p,i)=>i>=shared-1&&p[1]>south.points[best][1]?i:best,shared-1),mouth=south.points[seaward];
 const join=north.points.findIndex((p,i)=>i>=shared&&p[0]>mouth[0]&&p[1]>mouth[1]);
 if(join<0)throw Error('Saved offshore connector is unavailable.');
 return {startDistance:south.joinDistance,joinDistance:north.joinDistance,points:[...south.points.slice(seaward).reverse(),...north.points.slice(join)],constructedJoin:[mouth,north.points[join]],note:'Barnegat ↔ Absecon: recorded inlet approaches joined by a constructed offshore planning connector. Inside travel continues beyond both junctions. The connector is not a recorded track; inlet currents and water depths are not validated.'};
}
function isOcean(route,s){return route.routeKey!=='inside'&&s>=(route.oceanStartNm??0)&&s<route.oceanJoinNm;}
function boundedMixed(base,alt,key){
 const low=alt.startDistance,high=alt.joinDistance,head=base.points.filter(p=>p[3]<=low),tail=base.points.filter(p=>p[3]>=high),pts=head.map(p=>p.slice());
 if(!pts.length||!tail.length||low>=high)throw Error('Invalid inlet junctions.');
 const oceanStartNm=pts.at(-1)[3];
 for(const p of [...alt.points,[tail[0][0],tail[0][1],tail[0][4]]]){
  const prev=pts.at(-1),ds=nm(prev,p);if(ds<1e-7)continue;
  pts.push([p[0],p[1],prev[2]+ds/(p[2]??base.referenceCruiseKnots)*3600,prev[3]+ds,p[2]]);
 }
 const oceanJoinNm=pts.at(-1)[3],shift=oceanJoinNm-high,timeShift=pts.at(-1)[2]-tail[0][2];
 for(const p of tail.slice(1))pts.push([p[0],p[1],p[2]+timeShift,p[3]+shift,p[4]]);
 const mapItem=p=>p.distance>=high-1e-8?{...p,distance:p.distance+shift,seconds:p.seconds==null?undefined:p.seconds+timeShift}:{...p};
 const keep=items=>(items||[]).filter(p=>p.distance<=low+1e-8||p.distance>=high-1e-8).map(mapItem);
 const endpoints=[...keep(base.endpoints),{key:'absecon-approach',name:'Absecon approach · ICW turnoff',distance:oceanStartNm,lat:head.at(-1)[0],lon:head.at(-1)[1]},{key:'barnegat-approach',name:'Barnegat approach · ICW turnoff',distance:oceanJoinNm,lat:tail[0][0],lon:tail[0][1]}].sort((a,b)=>a.distance-b.distance);
 const timingOverrides=(base.timingOverrides||[]).flatMap(o=>[...(o.startNm<low?[{...o,endNm:Math.min(o.endNm,low)}]:[]),...(o.endNm>high?[{...o,startNm:Math.max(o.startNm,high)+shift,endNm:o.endNm+shift}]:[])]);
 const canal=base.canalCurrent;
 return {...base,routeKey:key,points:pts,totalNm:pts.at(-1)[3],stations:keep(base.stations),bridges:keep(base.bridges),endpoints,timingOverrides,canalCurrent:canal?{...canal,startNm:canal.startNm+shift,endNm:canal.endNm+shift}:null,oceanStartNm,oceanJoinNm,oceanEndNm:oceanJoinNm,sourceNote:alt.note};
}
function mixed(base,alt,key){
 if(!alt)return {...base,routeKey:'inside'};
 if(alt.startDistance!=null)return boundedMixed(base,alt,key);
 const join=alt.joinDistance,tail=base.points.filter(p=>p[3]>=join),raw=[base.points[0].slice(0,2).concat([null]),...alt.points,tail[0].slice(0,2).concat([null])],pts=[];
 for(const p of raw){const prev=pts.at(-1),ds=prev?nm(prev,p):0;if(prev&&ds<1e-7)continue;pts.push([p[0],p[1],prev?prev[2]+ds/(p[2]??26)*3600:0,prev?prev[3]+ds:0,p[2]]);}
 const shift=pts.at(-1)[3]-join,secondsShift=pts.at(-1)[2]-tail[0][2];for(const p of tail.slice(1))pts.push([p[0],p[1],p[2]+secondsShift,p[3]+shift,p[4]]);
 const mapItem=p=>({...p,distance:p.distance+shift,seconds:p.seconds==null?undefined:p.seconds+secondsShift});
 const keep=items=>items.filter(p=>p.distance>=join-1e-8).map(mapItem);
 const end=base.endpoints.find(e=>e.key==='cape-may'),stations=keep(base.stations),cape=base.stations.reduce((a,b)=>a.distance<b.distance?a:b);stations.unshift({...cape,distance:0});
 return {...base,routeKey:key,points:pts,totalNm:pts.at(-1)[3],stations,bridges:keep(base.bridges),endpoints:[end,{key:key+'-approach',name:(key==='absecon'?'Absecon':'Barnegat')+' approach · ICW turnoff',distance:join+shift,lat:tail[0][0],lon:tail[0][1]},...keep(base.endpoints)],timingOverrides:(base.timingOverrides||[]).filter(o=>o.startNm>=join).map(o=>({...o,startNm:o.startNm+shift,endNm:o.endNm+shift})),canalCurrent:base.canalCurrent?{...base.canalCurrent,startNm:base.canalCurrent.startNm+shift,endNm:base.canalCurrent.endNm+shift}:null,oceanStartNm:0,oceanEndNm:pts[raw.length-1]?.[3]??join+shift,oceanJoinNm:join+shift,sourceNote:alt.note};
}
function profile(route,cruise,ocean,adjustments=[]){if(!Number.isFinite(ocean)||ocean<1||ocean>50)throw Error('Ocean speed must be between 1 and 50 knots.');const N=root.NJTide,normal=N.profile(route,cruise),out=[0];for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],s=(a[3]+b[3])/2;let dt=normal[i]-normal[i-1];if(isOcean(route,s)&&((a[4]==null&&b[4]==null)||nm(a,b)>.5))dt=(b[3]-a[3])/ocean*3600;const adj=adjustments.find(x=>s>=x.startNm&&s<x.endNm);out.push(out[i-1]+dt*(adj?.factor??1));}out.cruiseKnots=cruise;return out;}
function daylight(t,lat,lon){const rad=Math.PI/180,j=t/86400000+2440587.5,n=j-2451545,L=(280.460+.9856474*n)*rad,g=(357.528+.9856003*n)*rad,lambda=L+(1.915*Math.sin(g)+.020*Math.sin(2*g))*rad,e=(23.439-.0000004*n)*rad,ra=Math.atan2(Math.cos(e)*Math.sin(lambda),Math.cos(lambda)),dec=Math.asin(Math.sin(e)*Math.sin(lambda)),sidereal=(280.46061837+360.98564736629*n+lon)*rad,h=sidereal-ra;return Math.asin(Math.sin(lat*rad)*Math.sin(dec)+Math.cos(lat*rad)*Math.cos(dec)*Math.cos(h))/rad>=-.833;}
function tripDaylight(route,trip){for(let t=trip.departure;t<=trip.end;t+=5*60000){let lo=Math.min(trip.start.distance,trip.finish.distance),hi=Math.max(trip.start.distance,trip.finish.distance);for(let k=0;k<14;k++){const mid=(lo+hi)/2;if((trip.eta(mid)<t)!==trip.reverse)lo=mid;else hi=mid;}const p=root.NJTide.position(route,(lo+hi)/2);if(!daylight(t,p.lat,p.lon))return false;}const p=root.NJTide.position(route,trip.finish.distance);return daylight(trip.end,p.lat,p.lon);}
function eligible(route,trip,{deadline=null,daylightOnly=false}={}){return !trip.blockedBridges.length&&!trip.uncheckedBridges.length&&!trip.scheduleReviewBridges.length&&!trip.bridges.some(b=>b.delayMinutes>=60)&&(deadline==null||trip.end<=deadline)&&(!daylightOnly||tripDaylight(route,trip));}
function envelope(trip,data,minutes){const N=root.NJTide;return N.priorityStations(trip.stations).map(st=>{const t=trip.eta(st.distance),events=data[st.id],begin=t-minutes*60000,end=t+minutes*60000,heights=[N.tide(events,begin).height,N.tide(events,end).height,...events.filter(e=>e[0]*1000>begin&&e[0]*1000<end).map(e=>e[1])];return {name:st.name,arrival:t,low:Math.min(...heights),high:Math.max(...heights)};});}
function compare(route,baseline,points){
 if(points.length<2)throw Error('GPX needs timestamped track points.');const bins=new Map();let last=null;const routePts=route.points;
 for(const p of points){let best=null;for(let i=1;i<routePts.length;i++){const a=routePts[i-1],b=routePts[i],c=Math.cos(p.lat*Math.PI/180),dx=(b[1]-a[1])*c,dy=b[0]-a[0],z=dx*dx+dy*dy,f=z?Math.max(0,Math.min(1,((p.lon-a[1])*c*dx+(p.lat-a[0])*dy)/z)):0,lat=a[0]+f*(b[0]-a[0]),lon=a[1]+f*(b[1]-a[1]),offset=Math.hypot((p.lat-lat)*60,(p.lon-lon)*c*60);if(!best||offset<best.offset)best={s:a[3]+f*(b[3]-a[3]),offset};}
  if(best.offset>.15){last=null;continue;}const bin=Math.floor(best.s/2),row=bins.get(bin)||{startNm:bin*2,endNm:(bin+1)*2,seconds:0,expected:0,distance:0,positive:0,negative:0,bad:false};bins.set(bin,row);
  if(last&&last.bin===bin){const dt=(p.t-last.t)/1000,ds=best.s-last.s;if(dt>0&&dt<=90){row.seconds+=dt;row.expected+=Math.abs(root.NJTide.secondsAt(route,baseline,best.s)-root.NJTide.secondsAt(route,baseline,last.s));row.distance+=Math.abs(ds);if(ds>0)row.positive+=ds;else row.negative-=ds;if(Math.abs(ds)/dt*3600<1.5)row.bad=true;}else row.bad=true;}
  last={...best,t:p.t,bin};
 }
 return [...bins.values()].filter(r=>r.distance>.25).sort((a,b)=>a.startNm-b.startNm).map(r=>{const bridge=route.bridges.some(b=>b.distance>=r.startNm-.1&&b.distance<=r.endNm+.1),canal=route.canalCurrent&&r.endNm>route.canalCurrent.startNm&&r.startNm<route.canalCurrent.endNm,factor=r.seconds/r.expected,usable=r.distance>=1&&!r.bad&&!bridge&&!canal&&Math.min(r.positive,r.negative)<r.distance*.05&&factor>=.5&&factor<=2;return {...r,factor,usable,reason:bridge?'Bridge section: wait may be included':canal?'Canal: historical current must be removed':r.bad?'Pause, fishing or timestamp gap':r.distance<1?'Too little matching track':Math.min(r.positive,r.negative)>=r.distance*.05?'Backtracking / mixed directions':factor<.5||factor>2?'Large timing difference needs administrator review':'Eligible personal timing comparison'};});
}
root.NJPlanning={nm,mixed,betweenInlets,isOcean,profile,daylight,tripDaylight,eligible,envelope,compare};if(typeof module!=='undefined')module.exports=root.NJPlanning;
})(globalThis);
