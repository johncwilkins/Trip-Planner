const assert=require('node:assert/strict'),N=require('../dist/nj-engine.js'),r=require('../dist/nj/route.json'),b=require('../dist/nj/bridges.json');
const o=r.timingOverrides[0],yardNm=.9144/1852,canal=r.endpoints.find(e=>e.key==='pp-canal-north'),bridge=b.find(e=>e.key==='brielle');
assert.ok(Math.abs(o.startNm-canal.distance-200*yardNm)<1e-9);assert.ok(Math.abs(bridge.distance-o.endNm-200*yardNm)<1e-9);
for(const speed of [6,26,35]){const p=N.profile(r,speed),seconds=N.secondsAt(r,p,o.endNm)-N.secondsAt(r,p,o.startNm);assert.ok(Math.abs(seconds-(o.endNm-o.startNm)/speed*3600)<1e-8);for(const reverse of [false,true]){const a={distance:o.startNm},z={distance:o.endNm},trip=N.passage({...r,bridges:[]},p,reverse?z:a,reverse?a:z,0);assert.ok(Math.abs(trip.hours-seconds/3600)<1e-9);}}
assert.equal(N.position(r,(o.startNm+o.endNm)/2).cap,null);assert.notEqual(N.position(r,o.startNm-.01).cap,null);assert.notEqual(N.position(r,o.endNm+.01).cap,null);
const before=N.profile({...r,timingOverrides:[]},26),after=N.profile(r,26);for(let i=1;i<r.points.length;i++){const mid=(r.points[i][3]+r.points[i-1][3])/2;if(mid<o.startNm||mid>o.endNm)assert.ok(Math.abs((before[i]-before[i-1])-(after[i]-after[i-1]))<1e-8);}
console.log('Cruise correction: exact 200-yard buffers, cruise speeds in both directions, map classification and unchanged outside timing passed.');
