const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),N=require(path.join(root,'dist/nj-engine.js'));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const route=read('dist/nj/route.json');route.bridges=read('dist/nj/bridges.json');N.addCheckpoints(route,read('dist/nj/priority-checkpoints.json'));
const manifest=read('dist/nj/tides/manifest.json');
const data=Object.fromEntries(manifest.stations.map(st=>[st.id,[...new Map(manifest.weeks.flatMap(w=>read(`dist/nj/tides/${st.id}/${w}.json`).events).map(e=>[e[0],e])).values()].sort((a,b)=>a[0]-b[0])]));
assert.equal(N.priorityStations(route.stations).length,6);
const atlanticCity=route.stations.find(st=>st.id==='ac-railroad'),railBridge=route.bridges.find(b=>b.key==='railroad');
assert.equal(atlanticCity.name,'Atlantic City');
assert.ok(atlanticCity.distance<railBridge.distance-0.2,'Atlantic City checkpoint must be south of and separate from the rail bridge.');
assert.ok(atlanticCity.offsetNm<0.1,'G207 checkpoint should be close to the recorded passage.');
const start=N.eastern('2026-10-14','13:00'),profile=N.profile(route,26);
for(const reverse of [false,true]){
 const a=route.endpoints[reverse?route.endpoints.length-1:0],b=route.endpoints[reverse?0:route.endpoints.length-1];
 const zero=N.passage(route,profile,a,b,start,Object.fromEntries(route.bridges.map(b=>[b.key,0])));
 const trip=N.passage(route,profile,a,b,start);
 assert.equal(N.lowWaterFlags(trip,data,1).length,6);
 assert.equal(trip.end-zero.end,route.bridges.filter(b=>b.movable).length*15*60000);
 const rail=trip.bridges.find(b=>b.key==='railroad');assert.equal(trip.eta(rail.distance),rail.arrival);
 const changed=N.passage(route,profile,a,b,start,{railroad:30});
 for(const st of trip.stations){
  const downstream=reverse?st.distance<rail.distance-1e-7:st.distance>rail.distance+1e-7;
  assert.equal(changed.eta(st.distance)-trip.eta(st.distance),downstream?15*60000:0);
 }
 const flags=N.lowWaterFlags(trip,data,1);
 for(const q of flags)assert.equal(q.low,q.height<1);
 assert.equal(N.lowWaterFlags(trip,data,-5).filter(q=>q.low).length,0);
 assert.equal(N.lowWaterFlags(trip,data,15).filter(q=>q.low).length,6);
 // Both new checkpoints must be able to determine the recommendation minimum.
 for(const id of ['all-seasons','ac-railroad']){
  const synthetic=Object.fromEntries(trip.stations.map(st=>[st.id,[[start/1000-86400,st.id===id?-1:5,'H'],[start/1000+3*86400,st.id===id?-1:5,'L']]]));
  assert.equal(N.recommendationScore(trip,synthetic).st.id,id);
 }
 const scores=[];
 for(let t=start-10*3600000;t<=start+10*3600000;t+=600000)scores.push(N.recommendationScore(N.passage(route,profile,a,b,t),data).height);
 assert.equal(scores.length,121);assert.ok(scores.every(Number.isFinite));
 console.log(reverse?'Southbound':'Northbound', 'six checkpoints; 121 departure scores; rail ETA and downstream delay checks passed.');
}
const short=N.passage(route,profile,route.endpoints.find(e=>e.key==='barnegat'),route.endpoints.at(-1),start);
assert.equal(N.recommendationScore(short,data),null);assert.equal(N.lowWaterFlags(short,data,1).length,0);
const railEvents=data['ac-railroad'],sourceEvents=data['8534638'];assert.deepEqual(railEvents,sourceEvents);
console.log('Priority alerts, station proxy cache and short-passage checks passed.');

// Verify datum conversion, margin equality, unknown data, and fixed-vs-movable decisions.
const example={closedClearanceFt:10,mhwAboveMllwFt:4,tideStationId:'x',movable:true};
assert.equal(N.bridgeClearance(example,start,{boatHeightFt:11,marginFt:2,waterLevel:()=>2}).status,'open');
assert.equal(N.bridgeClearance(example,start,{boatHeightFt:11,marginFt:2,waterLevel:()=>1}).status,'closed-pass');
assert.equal(N.bridgeClearance(example,start,{boatHeightFt:11,marginFt:2,waterLevel:()=>2}).maxTideFt,1);
assert.equal(N.bridgeClearance({...example,movable:false},start,{boatHeightFt:11,marginFt:2,waterLevel:()=>2}).status,'blocked');
assert.equal(N.bridgeClearance(example,start,{boatHeightFt:11,waterLevel:()=>{throw Error('missing');}}).status,'check');
assert.equal(N.bridgeClearance(example,start,{}).status,'height-needed');
assert.throws(()=>N.bridgeClearance(example,start,{boatHeightFt:0,waterLevel:()=>0}));
// Waiting at an earlier bridge can change whether a later bridge needs an opening.
const mock={referenceCruiseKnots:26,points:[[39,-74,0,0,null],[39.01,-74,7200,2,null]],stations:[],endpoints:[],bridges:[{key:'a',distance:.5,movable:true,closedClearanceFt:5,mhwAboveMllwFt:0,tideStationId:'a',defaultDelayMinutes:15},{key:'b',distance:1.5,movable:true,closedClearanceFt:12,mhwAboveMllwFt:0,tideStationId:'b',defaultDelayMinutes:15}]};
const opts={boatHeightFt:10,marginFt:0,waterLevel:(id,t)=>id==='b'&&t>=start+1.75*3600000?4:0};
const noHold=N.passage(mock,N.profile(mock,26),{distance:0},{distance:2},start,{a:0},opts);
const hold=N.passage(mock,N.profile(mock,26),{distance:0},{distance:2},start,{a:30},opts);
assert.equal(noHold.bridges[1].status,'closed-pass');assert.equal(hold.bridges[1].status,'open');assert.equal(hold.end-noHold.end,45*60000);
for(const reverse of [false,true]){
 const a=route.endpoints[reverse?route.endpoints.length-1:0],b=route.endpoints[reverse?0:route.endpoints.length-1];
 for(let t=start-10*3600000;t<=start+10*3600000;t+=600000){
  const q=N.passage(route,profile,a,b,t,{}, {boatHeightFt:15,marginFt:2,waterLevel:(id,time)=>N.tide(data[id],time).height});
  assert.equal(q.bridges.length,16);assert.equal(q.uncheckedBridges.length,0);assert.equal(q.blockedBridges.length,0);
  for(const bridge of q.bridges){assert.equal(q.eta(bridge.distance),bridge.arrival);if(!bridge.movable||bridge.status==='closed-pass')assert.equal(bridge.delayMinutes,0);}
 }
 const tooTall=N.passage(route,profile,a,b,start,{}, {boatHeightFt:80,marginFt:2,waterLevel:(id,time)=>N.tide(data[id],time).height});assert.ok(tooTall.blockedBridges.length>0);
}
console.log('Datum conversion, boundary, missing-data, sequential opening decisions, fixed obstructions and 242 real height-aware departure scenarios passed.');

// A coordinated pair applies only one wait in either travel direction, never hides an unknown clearance.
const pairRoute={...mock,bridges:mock.bridges.map((b,i)=>({...b,key:i?'dorset':'albany',name:i?'Dorset':'Albany',closedClearanceFt:5}))};
for(const reverse of [false,true]){
 const a={distance:reverse?2:0},b={distance:reverse?0:2},opts={boatHeightFt:10,marginFt:2,waterLevel:()=>0,coordinateAlbanyDorset:true};
 const linked=N.passage(pairRoute,N.profile(mock,26),a,b,0,{},opts),separate=N.passage(pairRoute,N.profile(mock,26),a,b,0,{}, {...opts,coordinateAlbanyDorset:false});
 assert.equal(linked.bridgeDelayMinutes,15);assert.equal(separate.bridgeDelayMinutes,30);
 assert.equal(linked.bridges[0].delayMinutes,15);assert.equal(linked.bridges[1].delayMinutes,0);assert.equal(linked.bridges[1].coordinatedWith,linked.bridges[0].name);
 const blank=N.passage(pairRoute,N.profile(mock,26),a,b,0,{}, {...opts,boatHeightFt:null});assert.equal(blank.bridgeDelayMinutes,30);
 const onePassRoute={...pairRoute,bridges:pairRoute.bridges.map((b,i)=>i?{...b,closedClearanceFt:20}:b)};
 const one=N.passage(onePassRoute,N.profile(mock,26),a,b,0,{},opts);assert.equal(one.bridgeDelayMinutes,15);assert.equal(one.bridges.filter(b=>b.coordinatedWith).length,0);
}
console.log('Albany/Dorset shared wait verified in both directions, including blank height and one closed pass.');
