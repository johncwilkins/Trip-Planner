const assert=require('node:assert/strict'),fs=require('node:fs');
const N=require('../dist/nj-engine.js');
const at=(date,time)=>N.eastern(date,time),wait=(key,date,time,noticeArranged=false)=>N.bridgeSchedule(key,at(date,time),{noticeArranged});
for(const day of ['2027-06-01','2027-07-12','2027-09-30']){
 assert.equal(wait('dorset',day,'10:14').delayMinutes,1);
 assert.equal(wait('dorset',day,'10:15').delayMinutes,0);
 assert.equal(wait('dorset',day,'10:16').delayMinutes,29);
 assert.equal(wait('albany',day,'10:29').delayMinutes,1);
 assert.equal(wait('albany',day,'10:30').delayMinutes,0);
 assert.equal(wait('albany',day,'10:31').delayMinutes,29);
 assert.equal(wait('albany',day,'15:59').delayMinutes,121);
 assert.equal(wait('albany',day,'16:00').delayMinutes,120);
 assert.equal(wait('albany',day,'17:59').delayMinutes,1);
 assert.equal(wait('albany',day,'18:00').delayMinutes,0);
 assert.equal(wait('albany',day,'21:01').delayMinutes,0);
 assert.equal(wait('dorset',day,'09:14').delayMinutes,0);
 assert.equal(wait('dorset',day,'21:16').delayMinutes,0);
}
for(const day of ['2027-05-31','2027-10-01','2026-10-21'])for(const key of ['albany','dorset'])assert.equal(wait(key,day,'10:14').delayMinutes,0);
for(const key of ['albany','dorset']){
 assert.equal(wait(key,'2027-07-12','23:00').delayMinutes,480);
 assert.equal(wait(key,'2027-07-12','23:00',true).delayMinutes,0);
 assert.equal(wait(key,'2027-07-12','06:59').delayMinutes,1);
 assert.equal(wait(key,'2027-07-12','07:00').delayMinutes,0);
 // Overnight wait spans DST changes in real elapsed time.
 assert.equal(wait(key,'2027-03-13','23:00').delayMinutes,420);
 assert.equal(wait(key,'2026-10-31','23:00').delayMinutes,540);
}
assert.equal(wait('albany','2026-11-01','15:00').delayMinutes,960);
assert.equal(wait('albany','2027-03-31','15:00').delayMinutes,960);
assert.equal(wait('albany','2027-04-01','15:00').delayMinutes,0);
assert.equal(wait('albany','2026-11-01','14:59').delayMinutes,0);
assert.equal(wait('dorset','2026-11-01','15:00').delayMinutes,0);
assert.equal(wait('albany','2027-07-04','21:40',true).delayMinutes,95);
assert.equal(wait('albany','2027-07-04','21:40').delayMinutes,560);
assert.equal(wait('albany','2027-07-05','21:40').review,true);
assert.equal(wait('albany','2027-08-18','10:00').review,true);
assert.equal(wait('albany','2027-08-25','10:00').review,true);
assert.equal(wait('albany','2027-08-11','10:00').delayMinutes,0);
assert.equal(N.bridgeSchedule('dorset',at('2027-07-12','10:15')+1000).delayMinutes,29+59/60);
assert.equal(N.bridgeSchedule('dorset',at('2027-07-12','21:15')+1000).delayMinutes,0);
assert.equal(N.bridgeSchedule('albany',at('2027-07-12','21:00')+1000).delayMinutes,0);
// Two crossings separated by 13 minutes, in each direction. The first wait
// must shift the second ETA; the manual shared-wait shortcut must not apply.
const route={referenceCruiseKnots:26,points:[[39,-74,0,0,null],[39.01,-74,1560,2,null]],stations:[],endpoints:[],bridges:[{key:'albany',name:'Albany',distance:.5,movable:true,closedClearanceFt:5,mhwAboveMllwFt:0,defaultDelayMinutes:15},{key:'dorset',name:'Dorset',distance:1.5,movable:true,closedClearanceFt:5,mhwAboveMllwFt:0,defaultDelayMinutes:15}]};
const profile=N.profile(route,26),opts={boatHeightFt:10,marginFt:2,waterLevel:()=>0,coordinateAlbanyDorset:true,bridgeModes:{albany:'schedule',dorset:'schedule'}};
for(const reverse of [false,true]){
 const start={distance:reverse?2:0},finish={distance:reverse?0:2},departure=at('2027-07-12',reverse?'10:07':'10:22')+30000;
 const trip=N.passage(route,profile,start,finish,departure,{},opts);
 assert.equal(trip.bridges[0].delayMinutes,1);
 assert.equal(trip.bridges[1].delayMinutes,2);
 assert.equal(trip.bridgeDelayMinutes,3);
 assert.equal(trip.end-departure,29*60000);
 assert.ok(trip.bridges.every(b=>!b.coordinatedWith));
 const closed=N.passage(route,profile,start,finish,departure,{}, {...opts,boatHeightFt:1});assert.equal(closed.bridgeDelayMinutes,0);
 const blank=N.passage(route,profile,start,finish,departure,{}, {...opts,boatHeightFt:null});assert.equal(blank.bridgeDelayMinutes,3);
 const manual=N.passage(route,profile,start,finish,departure,{albany:8,dorset:9},{...opts,coordinateAlbanyDorset:false,bridgeModes:{albany:'manual',dorset:'manual'}});assert.equal(manual.bridgeDelayMinutes,17);
 const mixed=N.passage(route,profile,start,finish,departure,{albany:8,dorset:9},{...opts,bridgeModes:{albany:'schedule',dorset:'manual'}});assert.ok(mixed.bridges.every(b=>!b.coordinatedWith));
}
console.log('Bridge schedules: seasonal dates, exact/just-missed openings, closures, notice periods, DST, event review and sequential waits in both directions passed.');
