/* Wind against modeled tidal current: screening advisory, not a wave forecast. */
(function(root){
 const HOUR=3600000,cache=new Map();let sequence=0;
 function assess(current,direction,wind,from,gust){
  if(![current,direction,wind,from].every(Number.isFinite))return 'unavailable';
  const angle=Math.abs(((from-direction+540)%360)-180); // wind FROM current's destination means opposing flow
  if(current<1.5||angle>60)return 'none';
  if(wind>=15)return 'warning';
  return Number.isFinite(gust)&&gust>=20?'gust':'none';
 }
 async function forecast(q){
  const key=q.lat.toFixed(3)+','+q.lon.toFixed(3);let entry=cache.get(key);
  if(!entry||Date.now()-entry.at>1800000){
   const p=new URLSearchParams({latitude:q.lat.toFixed(3),longitude:q.lon.toFixed(3),timezone:'GMT',forecast_days:'7',hourly:'wind_speed_10m,wind_gusts_10m,wind_direction_10m',wind_speed_unit:'kn'});
   const promise=fetch('https://api.open-meteo.com/v1/forecast?'+p).then(x=>{if(!x.ok)throw Error();return x.json();}).catch(()=>null);entry={at:Date.now(),promise};cache.set(key,entry);
  }
  const f=await entry.promise,h=f?.hourly;if(!Array.isArray(h?.time))return null;
  let j=-1,d=Infinity;h.time.forEach((t,i)=>{let x=Math.abs(Date.parse(t.endsWith('Z')?t:t+'Z')-q.t);if(x<d){d=x;j=i;}});
  if(j<0||d>HOUR/2)return null;return {wind:h.wind_speed_10m?.[j],gust:h.wind_gusts_10m?.[j],from:h.wind_direction_10m?.[j]};
 }
 async function check(q,name){
  if(q.mode==='unmodeled'||!Number.isFinite(q.current)||!Number.isFinite(q.dir))return {name,q,status:'unavailable'};
  const w=await forecast(q);return {name,q,w,status:w?assess(q.current,q.dir,w.wind,w.from,w.gust):'unavailable'};
 }
 function description(x){let {q,w,status}=x;if(status==='unavailable')return 'Wind–current assessment unavailable';if(status==='none')return '';
  return `${status==='warning'?'⚠ Wind against current: potentially steep, choppy seas':'⚠ Gusts against current: choppy seas possible'} · current ${q.current.toFixed(1)} kt toward ${Math.round(q.dir)}° true · wind from ${Math.round(w.from)}° at ${Math.round(w.wind)} kt${Number.isFinite(w.gust)?', gusts '+Math.round(w.gust)+' kt':''}.`;
 }
 async function run(selected,route,points,bestChoice,worstChoice){
  document.querySelectorAll('.windCurrentNotice').forEach(el=>el.remove());
  const seq=++sequence,critical=points.map(a=>{let t=P.atDistance(selected,a.at);return {q:P.sample(route,data,a.at,t,selected.speed),name:a.station.name,id:a.station.id};});
  const waypoint=selected.arrivals.map((q,i)=>({q,i,name:route.p[i].name})).filter(x=>route.p[x.i].selectable!==false);
  const jobs=[...critical,...waypoint];
  const checkMany=async items=>{let out=[];for(let i=0;i<items.length;i+=6)out.push(...await Promise.all(items.slice(i,i+6).map(x=>check(x.q,x.name))));return out;};
  const compare=async choice=>{if(!choice)return null;try{const model=P.simulate(route,data,choice.start,selected.speed);let items=points.map(a=>{let t=P.atDistance(model,a.at);return {q:P.sample(route,data,a.at,t,selected.speed),name:a.station.name};});return await checkMany(items);}catch(e){return null;}};
  const [found,fast,slow]=await Promise.all([checkMany(jobs),compare(bestChoice),compare(worstChoice)]);
  if(seq!==sequence||trip!==selected)return;
  critical.forEach((x,i)=>{let row=document.querySelector(`#currentCritical [data-current-index="${i}"]`),cell=row?.cells[2],message=description(found[i]);if(cell&&message){let d=document.createElement('div');d.style.color=found[i].status==='unavailable'?'#576a74':'#a43b20';d.textContent=message;cell.append(d);}});
  waypoint.forEach((x,j)=>{let item=found[critical.length+j],message=description(item);if(!message)return;document.querySelectorAll(`[data-waypoint-weather="${x.i}"], [data-brief-weather="${x.i}"]`).forEach(el=>{let note=document.createElement('div');note.className='windCurrentNotice';note.style.color=item.status==='unavailable'?'#576a74':'#a43b20';note.textContent=message;el.after(note);});});
  const brief=document.getElementById('windCurrentBrief');if(brief){let flagged=found.slice(0,critical.length).filter(x=>x.status==='warning'||x.status==='gust'),missing=found.slice(0,critical.length).filter(x=>x.status==='unavailable').length;brief.textContent=(flagged.length?flagged.map(x=>x.name+' · '+fmt(x.q.t)+': '+description(x)).join(' '):'No wind-against-current advisory at assessed critical locations.')+(missing?` Assessment unavailable at ${missing} critical location(s).`:'')+(!critical.length?' No modeled critical locations are available.':'')+' This screening does not predict wave height; conditions can be hazardous without an advisory.';}
  function annotate(id,arr){let el=document.getElementById(id);if(!el)return;let msg=!arr||!arr.length?'Wind–current assessment unavailable':arr.some(x=>x.status==='warning'||x.status==='gust')?'⚠ Wind against current possible at '+arr.filter(x=>x.status==='warning'||x.status==='gust').map(x=>x.name).join(', '):arr.some(x=>x.status==='unavailable')?'Wind–current assessment incomplete':'No wind–current advisory at assessed locations';let note=document.createElement('span');note.style.display='block';note.textContent=msg;el.append(note);}
  annotate('bestDuration',fast);annotate('worstDuration',slow);
 }
 root.WindCurrent={assess,description,run};if(typeof module!=='undefined')module.exports={assess,description};
})(globalThis);
