(function(){
const $=id=>document.getElementById(id),zones={inside:['ANZ452'],absecon:['ANZ452','ANZ453'],barnegat:['ANZ451','ANZ452','ANZ453']},base={inside:'Stay inside',absecon:'Ocean via Absecon ↔ Cape May',barnegat:'Ocean via Barnegat ↔ Cape May'},cache=new Map();let request=0;
const civil=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
function shift(date,days){const x=new Date(date+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+days);return x.toISOString().slice(0,10);}
function periodFor(d,date,time){const updated=civil(d.properties.updated),hour=Number((time||'12:00').slice(0,2)),night=hour>=18||hour<6,target=hour<6?shift(date,-1):date,weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];return d.properties.periods.find(p=>{const name=p.name.toLowerCase(),isNight=/night|tonight|overnight/.test(name);let day;if(/today|tonight|this afternoon|this evening|overnight/.test(name))day=updated;else if(/tomorrow/.test(name))day=shift(updated,1);else{let ix=weekday.findIndex(w=>name.startsWith(w.toLowerCase()));if(ix<0)return false;let days=(ix-new Date(updated+'T12:00Z').getUTCDay()+7)%7;day=shift(updated,days);}return day===target&&isNight===night;});}
function sea(text){return text.match(/\bseas?\s+[^.]*?\b(?:ft|feet)\b/i)?.[0]||null;}
async function zone(id){const c=cache.get(id);if(c&&Date.now()-c.time<30*60000)return c.data;const res=await fetch('https://api.weather.gov/zones/marine/'+id+'/forecast');if(!res.ok)throw Error('NWS unavailable');const data=await res.json();if(!data.properties?.updated||!Array.isArray(data.properties.periods))throw Error('NWS data unavailable');cache.set(id,{time:Date.now(),data});return data;}
async function update(){
 const n=++request,date=$('date').value,time=$('time').value;
 if(!date||!time)return;
 const box=$('marineForecast'),selected=typeof trip!=='undefined'?trip:null,selectedRoute=typeof route!=='undefined'?route:null;
 window.njTripWeatherSummary='';box.textContent='Checking forecasts along the selected passage…';window.dispatchEvent(new Event('nj-weather-updated'));
 // Keep the existing NWS sea-condition labels on the ocean-route options.
 const updateZones=async()=>{
  const fetched=await Promise.allSettled(['ANZ451','ANZ452','ANZ453'].map(zone));if(n!==request)return;
  const all=Object.fromEntries(['ANZ451','ANZ452','ANZ453'].map((z,i)=>[z,fetched[i].status==='fulfilled'?fetched[i].value:null]));
  for(const opt of $('routeMode').options){const key=opt.value,parts=zones[key].map(z=>all[z]&&periodFor(all[z],date,time)).filter(Boolean),seas=[...new Set(parts.map(p=>sea(p.detailedForecast)).filter(Boolean))];opt.textContent=base[key]+(key!=='inside'&&seas.length?' ('+seas.join('; ')+')':'');}
  window.dispatchEvent(new Event('nj-weather-updated'));
 };
 const zonesReady=updateZones();
 if(!selected||!selectedRoute){box.textContent='Choose a valid passage to see weather along the trip.';await zonesReady;return;}
 try{
  const points=PassageWeather.samples({start:selected.departure,end:selected.end,from:selected.start.distance,to:selected.finish.distance,eta:selected.eta,position:s=>NJTide.position(selectedRoute,s),nameAt:p=>selectedRoute.endpoints.reduce((a,b)=>((a.lat-p.lat)**2+(a.lon-p.lon)**2)<((b.lat-p.lat)**2+(b.lon-p.lon)**2)?a:b).name,marineAt:s=>selectedRoute.routeKey!=='inside'&&s<selectedRoute.oceanJoinNm});
  const forecasts=await PassageWeather.collect(points);
  if(n!==request||trip!==selected||route!==selectedRoute)return;
  const format=t=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(t);
  window.njTripWeatherSummary=PassageWeather.summary(forecasts,format);box.textContent=window.njTripWeatherSummary;
 }catch(error){if(n!==request||trip!==selected)return;box.textContent='Weather and sea forecasts unavailable for this passage. Check full forecasts.';}
 if(n===request)window.dispatchEvent(new Event('nj-weather-updated'));
 await zonesReady;
}
window.addEventListener('load',update);window.addEventListener('nj-trip-updated',update);
window.addEventListener('nj-trip-cleared',()=>{request++;window.njTripWeatherSummary='';$('marineForecast').textContent='Choose a valid passage to see weather along the trip.';});
setInterval(update,30*60000);
})();
