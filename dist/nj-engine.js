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
const bridgeTimeFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function bridgeLocal(t){const p=Object.fromEntries(bridgeTimeFormat.formatToParts(t).map(x=>[x.type,x.value]));return {year:+p.year,month:+p.month,day:+p.day,minute:+p.hour*60+ +p.minute,date:`${p.year}-${p.month}-${p.day}`};}
function bridgeRegime(key,p,noticeArranged){
 const m=p.minute,summer=p.month>=6&&p.month<=9;
 if(key==='albany'){
  const weekday=new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay();
  if(p.month===8&&weekday===3&&p.day>=15&&p.day<=28)return {review:true,label:'Air-show exception: third or fourth Wednesday in August. Confirm the event date and use a manual wait.'};
  if(p.month===7&&p.day===5&&m>=1300&&m<1395)return {review:true,label:'Possible July 5 fireworks rain-date restriction. Confirm current notices and use a manual wait.'};
  if(p.month===7&&p.day===4&&m>=1300&&m<1395)return {allowed:false,label:'July 4 fireworks closure, 9:40–11:15 p.m.'};
  if(summer&&m>=960&&m<1080)return {allowed:false,label:'Summer closure, 4–6 p.m.'};
 }
 const notice=m>=1380||m<420||(key==='albany'&&(p.month>=11||p.month<=3)&&m>=900);
 if(notice)return {allowed:!!noticeArranged,notice:true,label:noticeArranged?'Four-hour advance notice confirmed arranged':'Four-hour advance notice required; waiting for regular service (notice not assumed)'};
 if(summer&&key==='albany'&&((m>=540&&m<960)||(m>=1080&&m<1260)))return {allowed:m%30===0,scheduled:true,label:'June–September: openings at :00 / :30; 4–6 p.m. closure'};
 if(summer&&key==='dorset'&&m>=555&&m<1275)return {allowed:m%30===15,scheduled:true,label:'June–September, 9:15 a.m.–9:15 p.m.: openings at :15 / :45'};
 return {allowed:true,label:'On signal · no timetable wait'};
}
function bridgeSchedule(key,arrival,{noticeArranged=false}={}){
 if(!['albany','dorset'].includes(key))return null;
 arrival=Math.round(arrival);
 const p=bridgeLocal(arrival),initial=bridgeRegime(key,p,noticeArranged),onMinute=arrival%60000===0;
 if(initial.review)return {...initial,delayMinutes:null};
 if(initial.allowed&&(!initial.scheduled||onMinute))return {...initial,delayMinutes:0,opening:arrival};
 // Test actual opening instants, in Eastern civil time; midnight/date/DST changes
 // are resolved for each day rather than advancing a fixed 24-hour clock.
 for(let day=0;day<3;day++){
  const d=new Date(Date.UTC(p.year,p.month-1,p.day+day)),date=d.toISOString().slice(0,10);
  for(let minute=0;minute<1440;minute+=15){
   if(day===0&&minute<=p.minute)continue;
   const q={year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),minute},rule=bridgeRegime(key,q,noticeArranged);
   if(rule.review)return {...rule,delayMinutes:null};
   if(!rule.allowed)continue;
   const opening=eastern(date,`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`);
   if(opening>=arrival)return {...initial,delayMinutes:(opening-arrival)/60000,opening,openingLabel:rule.label};
  }
 }
 throw Error('No regular bridge opening found within three days.');
}
function passage(route,profile,start,finish,departure,bridgeDelays={},clearanceOptions={}){
 const sa=secondsAt(route,profile,start.distance),sb=secondsAt(route,profile,finish.distance),reverse=finish.distance<start.distance,totalDistance=Math.abs(finish.distance-start.distance),sign=reverse?-1:1,progress=s=>(s-start.distance)*sign;
 let bridgeDelayMinutes=0;
 const bridges=(route.bridges||[]).filter(b=>progress(b.distance)>1e-7&&progress(b.distance)<totalDistance-1e-7).map(b=>({...b,progress:progress(b.distance)})).sort((a,b)=>a.progress-b.progress);
 let firstPairOpening=null;
 for(const b of bridges){
  const assumedDelayMinutes=bridgeDelays[b.key]??b.defaultDelayMinutes??15;
  if(!Number.isFinite(assumedDelayMinutes)||assumedDelayMinutes<0||assumedDelayMinutes>30)throw Error('Bridge delays must be between 0 and 30 minutes.');
  b.arrival=departure+Math.abs(secondsAt(route,profile,b.distance)-sa)*1000+bridgeDelayMinutes*60000;
  Object.assign(b,bridgeClearance(b,b.arrival,clearanceOptions));
  const movable=b.movable!==false;
  b.assumedDelayMinutes=movable?assumedDelayMinutes:0;
  b.delayMinutes=movable&&b.status!=='closed-pass'?assumedDelayMinutes:0;
  const scheduled=clearanceOptions.bridgeModes?.[b.key]==='schedule'&&['albany','dorset'].includes(b.key);
  if(scheduled&&movable&&b.status!=='closed-pass'){
   b.schedule=bridgeSchedule(b.key,b.arrival,{noticeArranged:!!clearanceOptions.bridgeNotices?.[b.key]});
   b.scheduleReview=!!b.schedule.review;
   if(!b.scheduleReview)b.delayMinutes=b.schedule.delayMinutes>0?Math.max(0,(b.schedule.opening-b.arrival)/60000):0;
  }
  if(clearanceOptions.bridgeModes?.albany!=='schedule'&&clearanceOptions.bridgeModes?.dorset!=='schedule'&&clearanceOptions.coordinateAlbanyDorset&&['albany','dorset'].includes(b.key)&&b.status==='open'){
   if(firstPairOpening){b.coordinatedWith=firstPairOpening.name;b.pairTransitMinutes=Math.abs(secondsAt(route,profile,b.distance)-secondsAt(route,profile,firstPairOpening.distance))/60;b.delayMinutes=0;}
   else firstPairOpening=b;
  }
  bridgeDelayMinutes+=b.delayMinutes;b.clear=b.schedule&&!b.scheduleReview&&b.delayMinutes>0?b.schedule.opening:b.arrival+b.delayMinutes*60000;
 }
 const eta=s=>departure+Math.abs(secondsAt(route,profile,s)-sa)*1000+bridges.filter(b=>b.progress<progress(s)-1e-7).reduce((sum,b)=>sum+b.delayMinutes*60000,0);
 const movingHours=Math.abs(sb-sa)/3600;
 const stations=route.stations.filter(s=>s.distance>=Math.min(start.distance,finish.distance)-1e-6&&s.distance<=Math.max(start.distance,finish.distance)+1e-6).sort((a,b)=>reverse?b.distance-a.distance:a.distance-b.distance);
 const endpoints=route.endpoints.filter(s=>s.distance>=Math.min(start.distance,finish.distance)-1e-6&&s.distance<=Math.max(start.distance,finish.distance)+1e-6);if(reverse)endpoints.reverse();
 return{start,finish,departure,reverse,eta,stations,endpoints,bridges,bridgeDelayMinutes,movingHours,hours:movingHours+bridgeDelayMinutes/60,end:departure+(movingHours*3600+bridgeDelayMinutes*60)*1000,distance:totalDistance,blockedBridges:bridges.filter(b=>b.status==='blocked'),uncheckedBridges:bridges.filter(b=>b.status==='check'),scheduleReviewBridges:bridges.filter(b=>b.scheduleReview)};
}
function tide(events,t){t/=1000;let[a,b,f]=bracket(events,t,0);if(a===b)throw Error('Tide predictions do not cover this arrival.');let before=events[a],after=events[b],height=before[1]+(after[1]-before[1])*(1-Math.cos(Math.PI*f))/2;return{height,state:f<.02||f>.98?'Near '+(f<.02?before[2]:after[2])+' tide':after[1]>before[1]?'Rising':'Falling',before,after,nextHigh:events.slice(b).find(x=>x[2]==='H'),nextLow:events.slice(b).find(x=>x[2]==='L')};}
function eastern(date,time){let a=(date+'T'+time).split(/[-T:]/).map(Number),wanted=Date.UTC(a[0],a[1]-1,a[2],a[3],a[4]),t=wanted;const f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});for(let i=0;i<4;i++){let p=Object.fromEntries(f.formatToParts(t).map(x=>[x.type,x.value])),delta=wanted-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);t+=delta;if(!delta)return t;}throw Error('This Eastern time does not exist during the daylight-saving transition.');}
const priorityIds=new Set(['8534393','8535221','8535661','8535838','all-seasons','ac-railroad']);
function priorityStations(stations){return stations.filter(st=>priorityIds.has(st.id));}
function lowWaterFlags(passage,data,threshold){if(!Number.isFinite(threshold)||threshold< -5||threshold>15)throw Error('Low-water alert level must be between -5 and 15 feet MLLW.');return priorityStations(passage.stations).map(st=>{const arrival=passage.eta(st.distance),height=tide(data[st.id],arrival).height;return {st,arrival,height,low:height<threshold};});}
function recommendationScore(passage,data){const stations=priorityStations(passage.stations);if(!stations.length)return null;return stations.map(st=>({st,height:tide(data[st.id],passage.eta(st.distance)).height})).reduce((a,b)=>a.height<b.height?a:b);}
root.NJTide={addCheckpoints,bridgeSchedule,bridgeClearance,profile,secondsAt,position,passage,tide,eastern,priorityStations,recommendationScore,lowWaterFlags};if(typeof module!=='undefined')module.exports=root.NJTide;
})(globalThis);
