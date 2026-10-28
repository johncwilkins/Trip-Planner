/* Requires Playwright, Chromium and a local server for dist. */
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.PLANNER_TEST_URL||'http://127.0.0.1:8000';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  await page.goto(base+'/nj.html');await page.waitForFunction(()=>typeof trip!=='undefined'&&trip&&!calculating);
  const seven=page.locator('#stationRows [data-station="8534296"]');
  await seven.evaluate(row=>row.closest('details').open=true);await seven.click();
  assert.equal(await seven.getAttribute('aria-current'),'location');assert.ok(await seven.evaluate(row=>row.classList.contains('stationRowSelected')));
  const inset=page.locator('.plannerMapPreview');assert.equal(await inset.isVisible(),true);
  const box=await inset.boundingBox();await page.mouse.move(box.x+40,box.y+50);await page.locator('.plannerMapReturn').focus();
  assert.equal(await seven.getAttribute('aria-current'),'location','selection survives hover and focus leaving row');
  await page.mouse.move(box.x+40,box.y+75);await page.mouse.down({button:'left'});await page.mouse.move(box.x+95,box.y+115,{steps:8});await page.mouse.up({button:'left'});
  await page.waitForTimeout(400);await page.mouse.wheel(0,-120);await page.waitForTimeout(500);
  assert.equal(await seven.getAttribute('aria-current'),'location','selection survives map pan/zoom');
  await page.evaluate(()=>{window.selectedStationTrip=trip;});await page.locator('#cruise').fill('18');
  await page.waitForFunction(()=>!calculating&&trip!==window.selectedStationTrip);
  assert.equal(await seven.getAttribute('aria-current'),'location','selection restored after table rerender');
  assert.match(await page.locator('#detail').textContent(),/Seven Island, Newmans Thorofare/);
  const priority=page.locator('#priorityRows [data-station]').first(),id=await priority.getAttribute('data-station');await priority.click();
  assert.equal(await seven.getAttribute('aria-current'),null);assert.equal(await priority.getAttribute('aria-current'),'location');
  assert.equal(await page.locator('#stationRows [data-station="'+id+'"]').getAttribute('aria-current'),'location','same station selected in both tables');
  await page.locator('#lowLevel').fill('15');await page.waitForTimeout(100);
  assert.equal(await priority.getAttribute('aria-current'),'location','priority rerender keeps selection');
  assert.ok(await priority.evaluate(row=>row.classList.contains('lowWaterRow')),'low-water warning retained');assert.match(await priority.textContent(),/Below alert level/);
  await seven.focus();await seven.press('Enter');assert.equal(await seven.getAttribute('aria-current'),'location','keyboard selection');
  assert.equal(await priority.getAttribute('aria-current'),null);
  await page.evaluate(()=>{window.selectedStationTrip=trip;});await page.locator('#routeMode').selectOption('barnegat-absecon');
  await page.waitForFunction(()=>!calculating&&trip!==window.selectedStationTrip&&route.routeKey==='barnegat-absecon');
  assert.equal(await seven.count(),0,'bypassed station removed');assert.equal(await page.locator('.stationRowSelected').count(),0,'no stale selection on a different passage');
  assert.deepEqual(errors,[]);console.log(`${width}px: Seven Island selection persists through pointer/focus changes, map interaction and recalculation; priority sync, warnings, keyboard and passage reset passed.`);await page.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
