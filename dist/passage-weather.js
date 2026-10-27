/* Shared route-time weather sampling and briefing text. Does not change passage calculations. */
(function(root){
 const cache=new Map(),HOUR=3600000;
 const fields='temperature_2m,weather_code,precipitation_probability,wind_speed_10m,wind_gusts_10m';
 function samples({start,end,from,to,eta,position,nameAt,marineAt=()=>true}){
  const count=Math.min(24,Math.max(3,Math.ceil(Math.abs(to-from)/20)+1,Math.ceil((end-start)/HOUR)+1));
  return Array.from({length:count},(_,i)=>{
   const t=start+(end-start)*i/(count-1);
   // Invert the existing ETA, including bridge waits and either passage direction.
   let low=0,high=1;
   for(let j=0;j<32;j++){const mid=(low+high)/2;if(eta(from+(to-from)*mid)<t)low=mid;else high=mid;}
   const s=i===0?from:i===count-1?to:from+(to-from)*(low+high)/2,p=position(s,t);
   return {s,t,lat:p.lat,lon:p.lon,name:nameAt(p,s),marine:marineAt(s)};
  });
 }
 function hourly(forecast,t){
  const h=forecast?.hourly;if(!Array.isArray(h?.time))return null;
  let nearest=-1,distance=Infinity;
  h.time.forEach((time,i)=>{const delta=Math.abs(Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(time)?time:time+'Z')-t);if(delta<distance){nearest=i;distance=delta;}});
  return nearest>=0&&distance<=HOUR/2?{h,ix:nearest}:null;
 }
 async function forecast(point,marine){
  const key=(marine?'sea:':'air:')+point.lat.toFixed(3)+','+point.lon.toFixed(3),saved=cache.get(key);
  if(saved&&Date.now()-saved.at<30*60000)return saved.promise;
  const params=new URLSearchParams({latitude:point.lat.toFixed(3),longitude:point.lon.toFixed(3),timezone:'GMT',forecast_days:'7',hourly:marine?'wave_height':fields,...(marine?{length_unit:'imperial',cell_selection:'sea'}:{temperature_unit:'fahrenheit',wind_speed_unit:'kn'})});
  const url=marine?'https://marine-api.open-meteo.com/v1/marine?':'https://api.open-meteo.com/v1/forecast?';
  const promise=(async()=>{const response=await fetch(url+params);if(!response.ok)throw Error('Forecast unavailable');return response.json();})().catch(error=>{cache.delete(key);throw error;});
  if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),promise});return promise;
 }
 async function collect(points){
  const all=[];
  // Limit requests on long routes; cached forecasts are reused across recalculations.
  for(let i=0;i<points.length;i+=4){
   all.push(...await Promise.all(points.slice(i,i+4).map(async x=>{
    const result=await Promise.allSettled([forecast(x,false),x.marine?forecast(x,true):Promise.resolve(null)]);
    return {x,air:result[0].status==='fulfilled'?hourly(result[0].value,x.t):null,sea:result[1].status==='fulfilled'?hourly(result[1].value,x.t):null};
   })));
  }
  return all;
 }
 const value=(row,kind,key)=>row[kind]?.h[key]?.[row[kind].ix];
 const location=x=>`near ${x.name} (${Math.abs(x.lat).toFixed(3)}° ${x.lat<0?'S':'N'}, ${Math.abs(x.lon).toFixed(3)}° ${x.lon<0?'W':'E'})`;
 function summary(all,fmt){
  const available=all.filter(row=>Number.isFinite(value(row,'air','weather_code'))&&Number.isFinite(value(row,'air','wind_speed_10m')));
  const range=(key,unit)=>{const values=all.map(row=>value(row,'air',key)).filter(Number.isFinite);if(!values.length)return 'unavailable';const lo=Math.round(Math.min(...values)),hi=Math.round(Math.max(...values));return (lo===hi?String(lo):lo+'–'+hi)+unit;};
  const general=available.length?'Expected along the trip: temperature '+range('temperature_2m','°F')+' · wind '+range('wind_speed_10m',' kt')+' · gusts '+range('wind_gusts_10m',' kt')+' · precipitation chance '+range('precipitation_probability','%')+'.':'Weather forecast unavailable for the passage dates or locations.';
  const notes=[];
  for(const row of all){const {x}=row,code=value(row,'air','weather_code'),wind=value(row,'air','wind_speed_10m'),gust=value(row,'air','wind_gusts_10m'),prob=value(row,'air','precipitation_probability'),wave=value(row,'sea','wave_height'),items=[];
   if(Number.isFinite(code)&&code>=95)items.push('thunderstorms forecast');else if(Number.isFinite(code)&&code>=51&&code<=82)items.push('rain or showers forecast');
   if(Number.isFinite(prob)&&prob>=50)items.push(prob+'% precipitation chance');
   if(Number.isFinite(wind)&&wind>=20)items.push(Math.round(wind)+' kt wind');
   if(Number.isFinite(gust)&&gust>=25)items.push('gusts '+Math.round(gust)+' kt');
   if(Number.isFinite(wave)&&wave>=4)items.push('seas '+wave.toFixed(1)+' ft');
   if(items.length)notes.push(`${location(x)} around ${fmt(x.t)}: ${items.join(', ')}`);
  }
  // Marine forecasts stand on their own even when the air forecast fails.
  const seas=all.filter(row=>Number.isFinite(value(row,'sea','wave_height'))&&value(row,'sea','wave_height')>=0),marineCount=all.filter(row=>row.x.marine).length;
  const max=seas.reduce((best,row)=>!best||value(row,'sea','wave_height')>value(best,'sea','wave_height')?row:best,null);
  const largest=max?`Largest forecast seas among route samples: ${value(max,'sea','wave_height').toFixed(1)} ft ${location(max.x)} around ${fmt(max.x.t)} (significant wave height; individual waves can be higher).`:marineCount?'Largest forecast seas: unavailable for the passage dates or locations.':'Largest forecast seas: unavailable for inside waters; bay and canal waves are not modeled by this offshore forecast.';
  const coverage=`Forecast coverage: ${available.length}/${all.length} weather route samples; marine wave data ${seas.length}/${marineCount} offshore route samples.`;
  const partial=available.length<all.length||seas.length<marineCount?' Coverage is incomplete; higher seas or other conditions may occur in uncovered sections.':'';
  return [general,largest,...notes,coverage+partial,'Open-Meteo hourly weather and marine forecasts at estimated passage times; conditions between samples may differ.'].join(' ');
 }
 root.PassageWeather={samples,hourly,collect,summary};if(typeof module!=='undefined')module.exports=root.PassageWeather;
})(globalThis);
