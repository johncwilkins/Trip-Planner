const assert=require('node:assert/strict'),W=require('../dist/passage-weather.js');
const HOUR=3600000,start=Date.parse('2026-10-31T22:00Z');
for(const [from,to]of [[0,100],[100,0]]){
 const points=W.samples({start,end:start+10*HOUR,from,to,eta:s=>start+(s-from)/(to-from)*10*HOUR,position:s=>({lat:s,lon:-s}),nameAt:p=>'Point '+p.lat});
 assert.equal(points[0].s,from);assert.equal(points.at(-1).s,to);assert.equal(points[0].t,start);assert.equal(points.at(-1).t,start+10*HOUR);
 points.forEach(p=>assert.ok(Math.abs(p.s-(from+(to-from)*(p.t-start)/(10*HOUR)))<1e-6));
 assert.ok(points.length>=11&&points.length<=24);
}
const waiting=W.samples({start,end:start+10*HOUR,from:0,to:10,eta:s=>start+s*HOUR/2+(s>5?5*HOUR:0),position:s=>({lat:s,lon:-s}),nameAt:()=>''});
assert.ok(waiting.some(p=>p.t>start+3*HOUR&&p.t<start+7*HOUR&&Math.abs(p.s-5)<1e-6),'sample bridge wait at bridge position');
const forecast={hourly:{time:['2026-11-01T05:00','2026-11-01T06:00'],wave_height:[1,3]}};
assert.equal(W.hourly(forecast,Date.parse('2026-11-01T06:00Z')).ix,1,'UTC distinguishes repeated Eastern hour');
assert.equal(W.hourly(forecast,Date.parse('2026-12-01T06:00Z')),null,'no extrapolated future forecast');
assert.equal(W.hourly({hourly:{time:['2026-11-01T06:00:00Z']}},Date.parse('2026-11-01T06:00Z')).ix,0);
function row(name,wave,air=true){return {x:{name,lat:39,lon:-74,t:start,marine:true},air:air?{h:{temperature_2m:[60],weather_code:[0],wind_speed_10m:[10],wind_gusts_10m:[15],precipitation_probability:[0]},ix:0}:null,sea:{h:{wave_height:[wave]},ix:0}};}
const all=[row('departure',1),row('offshore',5,false),row('arrival',2)];
let text=W.summary(all,t=>new Date(t).toISOString());
assert.match(text,/Largest forecast seas among route samples: 5.0 ft near offshore/);assert.match(text,/marine wave data 3\/3/);assert.match(text,/Coverage is incomplete/);assert.match(text,/temperature 60°F/);
const compact=W.summary(all,t=>new Date(t).toISOString(),{compact:true});assert.match(compact,/Largest forecast seas: 5.0 ft near offshore/);assert.match(compact,/Some forecast coverage is missing/);assert.doesNotMatch(compact,/Forecast coverage:|route samples|marine wave data|Open-Meteo hourly/);
text=W.summary([row('calm',0)],String);assert.match(text,/0.0 ft/);assert.match(text,/precipitation chance 0%/);assert.doesNotMatch(text,/incomplete/);
text=W.summary([row('missing',null,false)],String);assert.match(text,/Largest forecast seas: unavailable/);assert.doesNotMatch(text,/null|NaN|Infinity|0.0 ft/);
const inside=row('inside',null);inside.x.marine=false;text=W.summary([inside],String);assert.match(text,/inside waters/);assert.match(text,/0\/0 offshore/);
(async()=>{
 let active=0,maxActive=0,requests=0;
 global.fetch=async url=>{requests++;active++;maxActive=Math.max(active,maxActive);const parsed=new URL(url);assert.equal(parsed.searchParams.get('timezone'),'GMT');if(parsed.hostname.startsWith('marine')){assert.equal(parsed.searchParams.get('length_unit'),'imperial');assert.equal(parsed.searchParams.get('cell_selection'),'sea');}await new Promise(resolve=>setTimeout(resolve,1));active--;return {ok:true,json:async()=>({hourly:{time:['2026-10-31T22:00'],wave_height:[2],temperature_2m:[65]}})};};
 const points=Array.from({length:12},(_,i)=>({lat:39+i/10,lon:-74,t:start,marine:i%2===0}));
 const loaded=await W.collect(points);assert.equal(loaded.length,12);assert.equal(requests,18);assert.ok(maxActive<=8);assert.equal(loaded[1].sea,null);
 await W.collect(points);assert.equal(requests,18,'repeat forecast calls reuse cached responses');
 const far=await W.collect([{...points[0],t:start+30*24*HOUR}]);assert.equal(far[0].air,null);assert.equal(far[0].sea,null);
 console.log('Passage weather: route-time sampling both directions, bridge waits, DST, maxima with independent marine coverage, null/zero handling, inside-water exclusions, request limits and cache reuse passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
