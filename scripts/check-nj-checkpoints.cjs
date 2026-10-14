const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),N=require(path.join(root,'dist/nj-engine.js'));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const route=read('dist/nj/route.json');route.bridges=read('dist/nj/bridges.json');N.addCheckpoints(route,read('dist/nj/priority-checkpoints.json'));
const manifest=read('dist/nj/tides/manifest.json');
const data=Object.fromEntries(route.stations.map(st=>[st.id,[...new Map(manifest.weeks.flatMap(w=>read(`dist/nj/tides/${st.id}/${w}.json`).events).map(e=>[e[0],e])).values()].sort((a,b)=>a[0]-b[0])]));
assert.equal(N.priorityStations(route.stations).length,6);
assert.equal(route.stations.find(st=>st.id==='ac-railroad').distance,route.bridges.find(b=>b.key==='railroad').distance);
const start=N.eastern('2026-10-14','13:00'),profile=N.profile(route,26);
for(const reverse of [false,true]){
 const a=route.endpoints[reverse?route.endpoints.length-1:0],b=route.endpoints[reverse?0:route.endpoints.length-1];
 const zero=N.passage(route,profile,a,b,start,Object.fromEntries(route.bridges.map(b=>[b.key,0])));
 const trip=N.passage(route,profile,a,b,start);
 assert.equal(N.lowWaterFlags(trip,data,1).length,6);
 assert.equal(trip.end-zero.end,45*60000);
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
