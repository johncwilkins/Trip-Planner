/* Requires Playwright, Chromium and the static site served locally. */
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.PLANNER_TEST_URL||'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{for(const width of [1440,390])for(const planner of ['currents','nj']){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let failAir=false,failSea=false;const requests=[];
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.protocol==='http:')return route.continue();
   if(!['api.open-meteo.com','marine-api.open-meteo.com'].includes(url.hostname))return route.abort();
   const marine=url.hostname.startsWith('marine');requests.push(url);
   if((marine&&failSea)||(!marine&&failAir))return route.fulfill({status:503,body:'Unavailable'});
   const start=Date.parse('2026-09-21T00:00Z'),time=[],wave=[],temperature=[],wind=[],gust=[],rain=[],codes=[];
   const lat=+url.searchParams.get('latitude'),lon=+url.searchParams.get('longitude');
   for(let i=0;i<24*130;i++){
    time.push(new Date(start+i*3600000).toISOString().slice(0,16));
    wave.push(Math.round((Math.abs(lon)%3+Math.abs(lat)%2+(i%6)/10)*10)/10);
    temperature.push(50+Math.round(lat%10)+(i%6));wind.push(10+Math.round(Math.abs(lon)%15));gust.push(20+Math.round(Math.abs(lon)%15));rain.push((i%4)*20);codes.push(i%7===0?61:0);
   }
   return route.fulfill({json:{hourly:{time,...(marine?{wave_height:wave}:{temperature_2m:temperature,weather_code:codes,wind_speed_10m:wind,wind_gusts_10m:gust,precipitation_probability:rain,wind_direction_10m:time.map(()=>90)})}}});
  });
  if(planner==='nj')await page.addInitScript(width=>{localStorage.setItem('nj-passage-settings-v1',JSON.stringify({routeMode:'barnegat',start:width===390?'cape-may':'barnegat-approach',finish:width===390?'barnegat-approach':'cape-may',cruise:'16'}));},width);
  await page.goto(base+'/'+planner+'.html');
  const selector=planner==='currents'?'#currentWeather':'#briefing';
  await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('Forecast coverage:'),selector);
  let text=await page.locator(selector).textContent();
  assert.match(text,/Expected along the trip: temperature/);assert.match(text,/wind .*gusts .*precipitation chance/);assert.doesNotMatch(text,/midpoint|NaN|Infinity/);
  assert.ok(new Set(requests.filter(u=>u.hostname==='api.open-meteo.com').map(u=>u.searchParams.get('latitude')+','+u.searchParams.get('longitude'))).size>2,'weather sampled across route');
  if(planner==='nj'){
   assert.equal(await page.locator('#routeMode').inputValue(),'inside','ignore saved ocean route on startup');
   assert.equal(await page.evaluate(()=>route.routeKey),'inside');assert.equal(await page.locator('#cruise').inputValue(),'16','restore boat speed');
   assert.notEqual(await page.locator('#start').inputValue(),await page.locator('#finish').inputValue(),'saved ocean endpoints cannot invalidate inside passage');
   const compact=await page.locator('#marineForecast').textContent();assert.doesNotMatch(compact,/Forecast coverage:|route samples|marine wave data|Open-Meteo hourly/);assert.match(compact,/Expected along the trip/);
   const forecastLink=page.locator('a[href="https://marine.weather.gov/MapClick.php?zoneid=ANZ453"]');assert.equal(await forecastLink.textContent(),'Full NWS marine forecast');assert.equal(await forecastLink.locator('..').textContent(),'Full NWS marine forecast');
   assert.match(text,/inside waters/);assert.ok(!requests.some(u=>u.hostname==='marine-api.open-meteo.com'),'no ocean waves substituted for bay/canal conditions');
   // Select an ocean route and endpoints that actually include its offshore leg.
   await page.evaluate(async()=>{document.getElementById('routeMode').value='barnegat';prepareRoute();document.getElementById('start').value='barnegat-approach';document.getElementById('finish').value='cape-may';await calculate({preserveView:true});});
   await page.waitForFunction(()=>document.getElementById('briefing').textContent.includes('Largest forecast seas among route samples:'));
   text=await page.locator(selector).textContent();assert.match(text,/ft near .*around .*E[DS]T/);assert.match(text,/significant wave height/);
   assert.ok(await page.locator('#briefing').textContent().then(t=>t.includes('Forecast coverage:')),'keep full forecast details in briefing');assert.match(await page.locator('#marineForecast').textContent(),/Largest forecast seas:/);
   // Reverse the trip; changing ETAs must refresh weather automatically.
   const firstText=text;await page.locator('#swap').click();
   await page.waitForFunction(()=>!calculating&&document.getElementById('briefing').textContent.includes('Forecast coverage:'));
   assert.notEqual(await page.locator(selector).textContent(),firstText);
   // Remove marine service while retaining real air coverage.
   failSea=true;await page.evaluate(()=>location.reload());
   await page.waitForFunction(()=>!calculating&&document.getElementById('briefing').textContent.includes('Forecast coverage:'));
   assert.equal(await page.locator('#routeMode').inputValue(),'inside','reload resets route to inside');
   await page.evaluate(async()=>{document.getElementById('routeMode').value='barnegat';prepareRoute();document.getElementById('start').value='barnegat-approach';document.getElementById('finish').value='cape-may';await calculate({preserveView:true});});
   await page.waitForFunction(()=>document.getElementById('briefing').textContent.includes('Largest forecast seas: unavailable for the passage'));
   assert.match(await page.locator('#marineForecast').textContent(),/Some forecast coverage is missing/);
   assert.match(await page.locator(selector).textContent(),/Expected along the trip/);
  }else{
   assert.match(text,/Largest forecast seas among route samples: .*ft near .*around .*E[DS]T/);
   assert.ok(await page.locator('#briefing').textContent().then(t=>t.includes(text)));
   // A marine maximum must remain visible even if all air requests fail.
   failAir=true;await page.reload();
   await page.waitForFunction(()=>document.getElementById('currentWeather')?.textContent.includes('Forecast coverage:'));
   text=await page.locator(selector).textContent();assert.match(text,/Weather forecast unavailable/);assert.match(text,/Largest forecast seas among route samples:/);assert.match(text,/Coverage is incomplete/);
   // No old forecast or extrapolated maximum for a date outside the fixture's horizon.
   failAir=false;await page.evaluate(async()=>{document.getElementById('date').value='2027-05-01';await calculate();});
   await page.waitForFunction(()=>document.getElementById('currentWeather')?.textContent.includes('Forecast coverage:'));
   text=await page.locator(selector).textContent();assert.match(text,/Largest forecast seas: unavailable/);assert.doesNotMatch(text,/Largest forecast seas among/);
  }
  assert.deepEqual(errors,[]);console.log(`${planner} ${width}px: route-wide weather, seas/location/time, briefing updates and missing-forecast handling passed.`);await page.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
