const assert=require('node:assert/strict'),fs=require('fs'),N=require('../dist/nj-engine.js'),P=require('../dist/nj-planning.js'),U=require('../dist/uscg-notices.js');
const base=JSON.parse(fs.readFileSync('dist/nj/route.json'));base.bridges=JSON.parse(fs.readFileSync('dist/nj/bridges.json'));N.addCheckpoints(base,JSON.parse(fs.readFileSync('dist/nj/priority-checkpoints.json')));const original=JSON.stringify(base),alts=JSON.parse(fs.readFileSync('dist/nj/ocean-routes.json')).alternatives;
for(const key of ['inside','absecon','barnegat']){
 const r=P.mixed(base,alts[key],key),p=P.profile(r,26,26),a=r.endpoints.find(e=>e.key==='toms-river'),b=r.endpoints.find(e=>e.key==='cape-may');
 for(let i=1;i<r.points.length;i++){assert.ok(r.points[i][3]>=r.points[i-1][3]);assert.ok(p[i]>=p[i-1]);assert.ok(P.nm(r.points[i-1],r.points[i])<10,'No giant route jumps');}
 for(const reverse of [false,true]){const t=N.passage(r,p,reverse?b:a,reverse?a:b,N.eastern('2026-10-26','09:00'));assert.ok(t.hours>0&&t.hours<15);assert.ok(!P.eligible(r,t,{deadline:t.end-1}));assert.ok(P.eligible(r,t,{deadline:t.end}));if(key!=='inside'){assert.ok(!t.bridges.some(b=>['albany','dorset','railroad','stone-harbor'].includes(b.key)));assert.equal(N.priorityStations(t.stations).length,key==='absecon'?1:0);}console.log(key,reverse?'northbound':'southbound',t.distance.toFixed(2)+' nm',t.hours.toFixed(2)+' h');}
 if(key!=='inside'){const slow=P.profile(r,26,15),fast=P.profile(r,26,30);assert.ok(slow.at(-1)>fast.at(-1));}
}
assert.equal(JSON.stringify(base),original,'No mutation of the inside route');
const minimal={points:[[40,-74,0,0,null],[40.04,-74,360,2.4,null]],referenceCruiseKnots:24,routeKey:'inside',bridges:[],stations:[],endpoints:[]};
const p=P.profile(minimal,24,26),track=Array.from({length:81},(_,i)=>({lat:40+.04*i/80,lon:-74,t:i*4500})),rows=P.compare(minimal,p,track);assert.ok(rows.some(r=>r.usable));assert.ok(Math.abs(rows[0].factor-1)<.001);
const withBridge=P.compare({...minimal,bridges:[{distance:1}]},p,track);assert.equal(withBridge[0].usable,false);assert.equal(P.compare(minimal,p,track.map(q=>({...q,lon:-70}))).length,0);
assert.equal(P.daylight(Date.parse('2026-10-26T16:00Z'),40,-74),true);assert.equal(P.daylight(Date.parse('2026-10-26T04:00Z'),40,-74),false);
const event=[[0,0,'L'],[3600,4,'H'],[7200,0,'L']],fake={stations:[{id:'8534393',name:'test',distance:1}],eta:()=>3600000},range=P.envelope(fake,{'8534393':event},30)[0];assert.equal(range.high,4);assert.ok(Math.abs(range.low-2)<1e-9);
const bad={blockedBridges:[],uncheckedBridges:[],scheduleReviewBridges:[],bridges:[{delayMinutes:60}]};assert.equal(P.eligible(minimal,bad),false);
const land=JSON.parse(fs.readFileSync('dist/land-detail.geojson')),pts=alts.barnegat.points,ids=pts.map((p,i)=>[p,i]).filter(([p])=>[39.34,39.4,39.5,39.6,39.7].includes(p[0])),line=pts.slice(ids[0][1]-1,ids.at(-1)[1]+2).map(p=>[p[1],p[0]]);assert.equal(land.features.filter(f=>U.nearRoute(f.geometry,line,0)).length,0,'Constructed connector intersects no saved land polygon');
console.log('Planning: mixed-route geometry, skipped priorities/bridges, cruise controls, deadline, long waits, daylight, uncertainty extrema, GPX matching, bridge exclusions and land check passed.');
