const assert=require('node:assert/strict'),N=require('../dist/nj-engine.js'),fs=require('node:fs');
const route={referenceCruiseKnots:26,points:[[40,-74,0,0,6],[40.03,-74,1200,2,6]],stations:[],endpoints:[],bridges:[],canalCurrent:{startNm:0,endNm:2,defaultThroughWaterKnots:6}};
const profile=N.profile(route,26),opts={canalSpeedKnots:6,canalCurrent:(t,sign)=>2*sign},a={distance:0},b={distance:2};
assert.equal(N.passage(route,profile,a,b,0,{},opts).hours,.25);
assert.ok(Math.abs(N.passage(route,profile,b,a,0,{},opts).hours-.5)<1e-10);
assert.ok(Math.abs(N.passage(route,profile,a,b,0,{}, {canalCurrent:()=>0}).hours-1/3)<1e-10);
assert.equal(N.passage(route,profile,a,b,0).hours,1/3,'Off uses original recorded timing');
assert.throws(()=>N.passage(route,profile,a,b,0,{}, {canalCurrent:()=>-6}),/forward progress/);
const rows=N.decodeCurrent({fd:170,ed:350,events:[[0,0],[60,200],[120,0],[180,-200]]});
assert.equal(N.currentAt(rows,3600000).northward,-2);assert.equal(N.currentAt(rows,10800000).northward,2);
assert.ok(Math.abs(N.currentAt(rows,1800000).v-Math.SQRT2)<1e-10);
assert.throws(()=>N.currentAt(rows,-1),/cover/);
// A wait before entering the canal changes its subsequent current and moving time.
const delayed={...route,points:[[40,-74,0,0,null],[40.01,-74,600,1,6],[40.03,-74,1800,3,6]],canalCurrent:{...route.canalCurrent,startNm:1,endNm:3},bridges:[{key:'entry',distance:.5,movable:true,defaultDelayMinutes:0,closedClearanceFt:2,mhwAboveMllwFt:0,tideStationId:'x'}]};
const dp=N.profile(delayed,26),finish={distance:3},options={canalCurrent:(t)=>t<1000000?2:-2};
const early=N.passage(delayed,dp,a,finish,0,{},options),late=N.passage(delayed,dp,a,finish,0,{entry:30},options);
assert.ok(late.movingHours>early.movingHours);assert.ok(late.end-early.end>30*60000);
for(const br of late.bridges)assert.equal(late.eta(br.distance),br.arrival);
// Actual cached predictions cover full passages in both directions, with all seven new spans.
const real=JSON.parse(fs.readFileSync('dist/nj/route.json'));real.bridges=JSON.parse(fs.readFileSync('dist/nj/bridges.json'));
const manifest=JSON.parse(fs.readFileSync('dist/predictions/manifest.json'));
const data=[...new Map(manifest.weeks.flatMap(w=>N.decodeCurrent(JSON.parse(fs.readFileSync('dist/predictions/ACT3996/'+w+'.json')))).map(p=>[p.t,p])).values()].sort((a,b)=>a.t-b.t);
for(const reverse of [false,true]){
 const start=real.endpoints.find(e=>e.key===(reverse?'manasquan':'toms-river')),finish=real.endpoints.find(e=>e.key===(reverse?'toms-river':'manasquan'));
 const p=N.passage(real,N.profile(real,26),start,finish,N.eastern('2026-10-21','09:00'),{}, {canalCurrent:(t,sign)=>N.currentAt(data,t).northward*sign});
 assert.equal(p.bridges.length,7);assert.ok(Number.isFinite(p.end)&&Number.isFinite(p.currentEffectMinutes));assert.equal(N.priorityStations(p.stations).length,0);
 console.log(reverse?'Southbound canal':'Northbound canal',p.hours.toFixed(3)+' h',p.currentEffectMinutes.toFixed(2)+' min current effect');
}
const lift={closedClearanceFt:30,openClearanceFt:65,mhwAboveMllwFt:1,tideStationId:'x',movable:true};
assert.equal(N.bridgeClearance(lift,0,{boatHeightFt:66,marginFt:2,waterLevel:()=>1}).status,'blocked');
assert.equal(N.bridgeClearance(lift,0,{boatHeightFt:60,marginFt:2,waterLevel:()=>1}).status,'open');
console.log('Canal timing: +/-2 kn, reversal, slack, checkbox-off behavior, bridge waits, missing data, forward progress and lift limits passed.');
