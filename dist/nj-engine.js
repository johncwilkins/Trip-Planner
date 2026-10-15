(function(root){
function addCheckpoints(route,definitions){
 for(const definition of definitions){
  let best=null;
  for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i],c=Math.cos((a[0]+b[0])*Math.PI/360),dx=(b[1]-a[1])*c,dy=b[0]-a[0],z=dx*dx+dy*dy;
   const f=z?Math.max(0,Math.min(1,((definition.lon-a[1])*c*dx+(definition.lat-a[0])*dy)/z)):0;
   const lat=a[0]+f*(b[0]-a[0]),lon=a[1]+f*(b[1]-a[1]),error=((definition.lon-lon)*c)**2+(definition.lat-lat)**2;
   if(!best||error<best.error)best={error,seconds:a[2]+f*(b[2]-a[2]),distance:a[3]+f*(b[3]-a[3]),routeLat:lat,routeLon:lon,offsetNm:Math.sqrt(error)*60};
  }
  const c=Math.cos(definition.lat*Math.PI/180),sourceOffsetNm=Math.hypot((definition.sourceLon-definition.lon)*c,definition.sourceLat-definition.lat)*60;
  const checkpoint={...definition,...best,sourceOffsetNm,checkpoint:true,sub:true};delete checkpoint.error;
  if(definition.id==='ac-railroad'){const bridge=(route.bridges||[]).find(b=>b.key==='railroad');if(bridge)Object.assign(checkpoint,{distance:bridge.distance,routeLat:bridge.routeLat,routeLon:bridge.routeLon});}
  route.stations=route.stations.filter(st=>st.id!==definition.id);route.stations.push(checkpoint);
 }
 route.stations.sort((a,b)=>a.distance-b.distance);return route;
}
function profile(route,cruise){if(!Number.isFinite(cruise)||cruise<1||cruise>50)throw Error('Cruise speed must be between 1 and 50 knots.');let seconds=[0];for(let i=1;i<route.points.length;i++){let a=route.points[i-1],b=route.points[i],cap=a[4]??b[4],dt=b[2]-a[2];let factor=cap==null?route.referenceCruiseKnots/cruise:Math.max(1,cap/cruise);seconds.push(seconds[i-1]+dt*factor);}return seconds;}
function bracket(points,s,column=3){let lo=0,hi=points.length-1;if(s<=points[0][column])return[0,0,0];if(s>=points[hi][column])return[hi,hi,0];while(hi-lo>1){let m=(hi+lo)>>1;if(points[m][column]<=s)lo=m;else hi=m;}let span=points[hi][column]-points[lo][column];return[lo,hi,span?(s-points[lo][column])/span:0];}
function secondsAt(route,profile,s){let[a,b,f]=bracket(route.points,s);return profile[a]+f*(profile[b]-profile[a]);}
function position(route,s){let[a,b,f]=bracket(route.points,s);return {lat:route.points[a][0]+f*(route.points[b][0]-route.points[a][0]),lon:route.points[a][1]+f*(route.points[b][1]-route.points[a][1]),cap:route.points[a][4]??route.points[b][4]};}
function bridgeClearance(bridge,arrival,options={}){
 const height=options.boatHeightFt,margin=options.marginFt??2;
 if(height==null)return {status:'height-needed',needsOpening:null,clearanceFt:null,tideFt:null,maxTideFt:null,remainingFt:null};
 if(!Number.isFinite(height)||height<=0||height>100||!Number.isFinite(margin)||margin<0||margin>10)throw Error('Enter a boat height above 0 and up to 100 feet, and a bridge margin from 0 to 10 feet.');
 const maxTideFt=bridge.closedClearanceFt+bridge.mhwAboveMllwFt-height-margin;
 let tideFt;try{tideFt=options.waterLevel(bridge.tideStationId,arrival);}catch(e){return {status:'check',needsOpening:null,clearanceFt:null,tideFt:null,maxTideFt,remainingFt:null};}
 if(!Number.isFinite(tideFt)||!Number.isFinite(bridge.closedClearanceFt)||!Number.isFinite(bridge.mhwAboveMllwFt))return {status:'check',needsOpening:null,clearanceFt:null,tideFt:null,maxTideFt:null,remainingFt:null};
 const clearanceFt=bridge.closedClearanceFt+bridge.mhwAboveMllwFt-tideFt,remainingFt=clearanceFt-height-margin,needsOpening=remainingFt< -1e-9;
 return {status:needsOpening?(bridge.movable?'open':'blocked'):'closed-pass',needsOpening:bridge.movable?needsOpening:false,clearanceFt,tideFt,maxTideFt,remainingFt};
}
function passage(route,profile,start,finish,departure,bridgeDelays={},clearanceOptions={}){
 const sa=secondsAt(route,profile,start.distance),sb=secondsAt(route,profile,finish.distance),reverse=finish.distance<start.distance,totalDistance=Math.abs(finish.distance-start.distance),sign=reverse?-1:1,progress=s=>(s-start.distance)*sign;
 let bridgeDelayMinutes=0;
 const bridges=(route.bridges||[]).filter(b=>progress(b.distance)>1e-7&&progress(b.distance)<totalDistance-1e-7).map(b=>({...b,progress:progress(b.distance)})).sort((a,b)=>a.progress-b.progress);
 for(const b of bridges){
  const assumedDelayMinutes=bridgeDelays[b.key]??b.defaultDelayMinutes??15;
  if(!Number.isFinite(assumedDelayMinutes)||assumedDelayMinutes<0||assumedDelayMinutes>30)throw Error('Bridge delays must be between 0 and 30 minutes.');
  b.arrival=departure+Math.abs(secondsAt(route,profile,b.distance)-sa)*1000+bridgeDelayMinutes*60000;
  Object.assign(b,bridgeClearance(b,b.arrival,clearanceOptions));
  const movable=b.movable!==false;
  b.assumedDelayMinutes=movable?assumedDelayMinutes:0;
  b.delayMinutes=movable&&b.status!=='closed-pass'?assumedDelayMinutes:0;
  bridgeDelayMinutes+=b.delayMinutes;b.clear=b.arrival+b.delayMinutes*60000;
 }
 const eta=s=>departure+Math.abs(secondsAt(route,profile,s)-sa)*1000+bridges.filter(b=>b.progress<progress(s)-1e-7).reduce((sum,b)=>sum+b.delayMinutes*60000,0);
 const movingHours=Math.abs(sb-sa)/3600;
 const stations=route.stations.filter(s=>s.distance>=Math.min(start.distance,finish.distance)-1e-6&&s.distance<=Math.max(start.distance,finish.distance)+1e-6).sort((a,b)=>reverse?b.distance-a.distance:a.distance-b.distance);
 const endpoints=route.endpoints.filter(s=>s.distance>=Math.min(start.distance,finish.distance)-1e-6&&s.distance<=Math.max(start.distance,finish.distance)+1e-6);if(reverse)endpoints.reverse();
 return{start,finish,departure,reverse,eta,stations,endpoints,bridges,bridgeDelayMinutes,movingHours,hours:movingHours+bridgeDelayMinutes/60,end:departure+(movingHours*3600+bridgeDelayMinutes*60)*1000,distance:totalDistance,blockedBridges:bridges.filter(b=>b.status==='blocked'),uncheckedBridges:bridges.filter(b=>b.status==='check')};
}
function tide(events,t){t/=1000;let[a,b,f]=bracket(events,t,0);if(a===b)throw Error('Tide predictions do not cover this arrival.');let before=events[a],after=events[b],height=before[1]+(after[1]-before[1])*(1-Math.cos(Math.PI*f))/2;return{height,state:f<.02||f>.98?'Near '+(f<.02?before[2]:after[2])+' tide':after[1]>before[1]?'Rising':'Falling',before,after,nextHigh:events.slice(b).find(x=>x[2]==='H'),nextLow:events.slice(b).find(x=>x[2]==='L')};}
function eastern(date,time){let a=(date+'T'+time).split(/[-T:]/).map(Number),wanted=Date.UTC(a[0],a[1]-1,a[2],a[3],a[4]),t=wanted;const f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});for(let i=0;i<4;i++){let p=Object.fromEntries(f.formatToParts(t).map(x=>[x.type,x.value])),delta=wanted-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);t+=delta;if(!delta)return t;}throw Error('This Eastern time does not exist during the daylight-saving transition.');}
const priorityIds=new Set(['8534393','8535221','8535661','8535838','all-seasons','ac-railroad']);
function priorityStations(stations){return stations.filter(st=>priorityIds.has(st.id));}
function lowWaterFlags(passage,data,threshold){if(!Number.isFinite(threshold)||threshold< -5||threshold>15)throw Error('Low-water alert level must be between -5 and 15 feet MLLW.');return priorityStations(passage.stations).map(st=>{const arrival=passage.eta(st.distance),height=tide(data[st.id],arrival).height;return {st,arrival,height,low:height<threshold};});}
function recommendationScore(passage,data){const stations=priorityStations(passage.stations);if(!stations.length)return null;return stations.map(st=>({st,height:tide(data[st.id],passage.eta(st.distance)).height})).reduce((a,b)=>a.height<b.height?a:b);}
root.NJTide={addCheckpoints,bridgeClearance,profile,secondsAt,position,passage,tide,eastern,priorityStations,recommendationScore,lowWaterFlags};if(typeof module!=='undefined')module.exports=root.NJTide;
})(globalThis);
