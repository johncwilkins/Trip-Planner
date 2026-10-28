/* Requires Playwright, Chromium and a local dist server. */
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.PLANNER_TEST_URL||'http://127.0.0.1:8000';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  await page.goto(base+'/currents.html');await page.waitForFunction(()=>typeof trip!=='undefined'&&trip&&!calculationBusy);
  const critical=page.locator('#currentCritical [data-current-location]').first();
  await critical.evaluate(row=>{for(let p=row.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});await critical.click();
  const key=await critical.getAttribute('data-current-location');
  const selected=async()=>{const states=await page.locator('[data-current-location]').evaluateAll((rows,key)=>rows.map(row=>({key:row.dataset.currentLocation,on:row.classList.contains('stationRowSelected'),aria:row.getAttribute('aria-current')})),key);assert.ok(states.some(s=>s.key===key));for(const s of states){assert.equal(s.on,s.key===key);assert.equal(s.aria,s.key===key?'location':null);}};
  await selected();assert.equal(await page.locator('.plannerMapPreview').isVisible(),true);
  const box=await page.locator('.plannerMapPreview').boundingBox();await page.mouse.move(box.x+45,box.y+65);await page.locator('.plannerMapReturn').focus();
  await page.mouse.down();await page.mouse.move(box.x+105,box.y+110,{steps:8});await page.mouse.up();await page.waitForTimeout(400);await page.mouse.wheel(0,-120);await page.waitForTimeout(500);await selected();
  await page.evaluate(()=>window.oldSelectionTrip=trip);await page.locator('#speed').fill('7');await page.waitForFunction(()=>!calculationBusy&&trip!==window.oldSelectionTrip);await selected();
  await page.locator('#uncertainty').selectOption('30');await selected();
  const waypoint=page.locator('#rows [data-waypoint]').first();await waypoint.evaluate(el=>el.click());
  const waypointKey=await waypoint.getAttribute('data-current-location');assert.equal(await waypoint.getAttribute('aria-current'),'location');assert.equal(await critical.getAttribute('aria-current'),null);
  assert.equal(await page.locator('#briefing [data-current-location="'+waypointKey+'"]').getAttribute('aria-current'),'location');
  const station=page.locator('#stationList [data-current-station]').first();await station.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el.focus();});await station.press('Enter');assert.equal(await station.getAttribute('aria-current'),'location');assert.equal(await waypoint.getAttribute('aria-current'),null);
  const brief=page.locator('#briefing [data-current-location]').first();await brief.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el.focus();});await brief.press('Space');assert.equal(await brief.getAttribute('aria-current'),'location');
  const notice=page.locator('#noticeList [data-notice]').first();await notice.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});await notice.click();assert.equal(await notice.getAttribute('aria-current'),'location');assert.equal(await brief.getAttribute('aria-current'),null);
  await page.locator('#showNotices').uncheck();assert.equal(await notice.getAttribute('aria-current'),'location','notice rerender preserves selection');
  await page.evaluate(()=>window.oldSelectionTrip=trip);await page.locator('#swap').click();await page.waitForFunction(()=>!calculationBusy&&trip!==window.oldSelectionTrip);assert.equal(await page.locator('.stationRowSelected').count(),0);
  assert.deepEqual(errors,[]);console.log(`${width}px: current rows and briefing sync, map pan/zoom, recalculation, keyboard, notices and changed-passage reset passed.`);await page.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
