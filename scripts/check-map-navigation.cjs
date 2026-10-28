/* Run against a locally served dist: node scripts/check-map-navigation.cjs.
   Requires Playwright and Chromium; set CHROMIUM_PATH if not /usr/bin/chromium. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.PLANNER_TEST_URL||'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{for(const width of [1440,390])for(const planner of ['currents','nj']){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // External charts/weather are optional. Test saved local data deterministically.
  await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  await page.goto(base+'/'+planner+'.html');
  await page.waitForFunction(()=>typeof trip!=='undefined'&&trip&&!document.getElementById('useBest').disabled);
  await page.evaluate(()=>{map.setView(map.getCenter(),10,{animate:false});map.setBearing(45);document.getElementById('map').scrollIntoView({block:'center',behavior:'instant'});});
  const state=()=>page.evaluate(()=>({zoom:map.getZoom(),bearing:map.getBearing(),lat:map.getCenter().lat,lng:map.getCenter().lng,scroll:scrollY,preview:!document.querySelector('.plannerMapPreview').hidden,count:document.querySelectorAll('.plannerMapPreview').length,ring:document.querySelectorAll('.plannerLocationPulse').length,layers:Object.values(map._layers).filter(l=>!l.options?.icon?.options?.className?.includes('plannerLocationPulse')).length}));
  await page.waitForTimeout(500);const initial=await state();
  const first=planner==='nj'?'#priorityRows [data-distance]':'#rows [data-waypoint]';
  await page.locator(first).first().evaluate(el=>el.click());
  let current=await state();assert.equal(current.preview,false);assert.equal(current.scroll,initial.scroll);assert.equal(current.zoom,10);assert.equal(current.bearing,45);assert.equal(current.ring,1);
  // Every generated geographic row must pan to its own coordinates.
  const selectors=planner==='nj'?['#briefing [data-map-lat]','#priorityRows [data-distance]','#stationRows [data-distance]','#stopRows [data-distance]','#bridgeRows [data-bridge]']:['#briefing [data-map-lat]','#rows [data-waypoint]','#currentCritical [data-current-index]','#stationList [data-current-station]'];
  let rows=0;
  for(const selector of selectors){const count=await page.locator(selector).count();assert.ok(count,selector);
   for(let i=0;i<count;i++){
    const expected=await page.locator(selector).nth(i).evaluate((el,planner)=>{
     let p;if(el.dataset.mapLat!==undefined)p={lat:+el.dataset.mapLat,lon:+el.dataset.mapLon};else if(planner==='nj'){if(el.dataset.bridge){const b=trip.bridges.find(b=>b.key===el.dataset.bridge);p={lat:b.routeLat,lon:b.routeLon};}else p=route.stations.find(st=>st.id===el.dataset.station)||N.position(route,+el.dataset.distance);}
     else if(el.dataset.waypoint!==undefined)p=r.p[+el.dataset.waypoint];else if(el.dataset.currentIndex!==undefined)p=currentPoints()[+el.dataset.currentIndex].station;else p=r.stations.find(s=>s.id===el.dataset.currentStation);
     el.click();return {lat:p.lat,lng:p.lon};
    },planner);
    current=await state();const offset=await page.evaluate(expected=>map.latLngToContainerPoint([expected.lat,expected.lng]).distanceTo(map.getSize().divideBy(2)),expected);assert.ok(offset<3,selector+' centered within pixel rounding: '+offset);assert.equal(current.zoom,10);assert.equal(current.bearing,45);rows++;
   }
  }
  const notices=await page.locator('#noticeList [data-notice]').count();
  assert.ok(notices,'saved notices loaded');
  for(let i=0;i<notices;i++){
   const expected=await page.locator('#noticeList [data-notice]').nth(i).evaluate(async(el,planner)=>{
    const snapshot=await(await fetch('nj/uscg-notices.json')).json(),items=planner==='currents'?(snapshot.coastalNotices||snapshot.notices):snapshot.notices,n=items.find(n=>n.id===el.dataset.notice);
    const point=plannerGeometryPoint(n.geometry);el.click();return point;
   },planner);
   current=await state();assert.equal(current.zoom,10);assert.equal(current.bearing,45);
   if(expected){const offset=await page.evaluate(p=>map.latLngToContainerPoint(p).distanceTo(map.getSize().divideBy(2)),expected);assert.ok(offset<3,'notice centered');}
  }
  // Pan to an offscreen selection, keeping the same live map and overlays.
  await page.evaluate(()=>{const visual=document.querySelector('.visuals');visual.querySelectorAll('details').forEach(el=>el.open=true);visual.scrollTop=visual.scrollHeight;scrollTo({top:document.body.scrollHeight,behavior:'instant'});});await page.waitForTimeout(100);
  const before=await state();await page.locator(first).first().evaluate(el=>el.click());current=await state();
  assert.equal(current.preview,true);assert.equal(current.count,1);assert.equal(current.zoom,10);assert.equal(current.bearing,45);assert.equal(current.layers,before.layers);assert.ok(await page.locator('.plannerMapPreview').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),'preview stays inside viewport');assert.ok(await page.locator('.plannerMapPreview').evaluate(el=>el.getBoundingClientRect().width>=Math.min(360,innerWidth-24)),'preview is substantially larger');
  await page.waitForTimeout(100);const scrollBeforeFocus=(await state()).scroll;await page.evaluate(()=>map.plannerFocus(map.getCenter()));assert.equal((await state()).scroll,scrollBeforeFocus,'navigation does not scroll the page');
  // Real wheel input passes through the return overlay to the live Leaflet map.
  const previewBox=await page.locator('.plannerMapPreview').boundingBox(),scrollPositions=()=>page.evaluate(()=>({page:scrollY,panel:document.querySelector('.visuals').scrollTop}));
  const wheelScroll=await scrollPositions();await page.mouse.move(previewBox.x+previewBox.width/2,previewBox.y+previewBox.height/2);
  await page.evaluate(()=>{window.insetWheelZoomDone=false;map.once('zoomend',()=>window.insetWheelZoomDone=true);});
  await page.mouse.wheel(0,-240);await page.waitForFunction(()=>window.insetWheelZoomDone&&map.getZoom()>10);
  assert.equal((await state()).bearing,45);assert.equal((await state()).preview,true);assert.deepEqual(await scrollPositions(),wheelScroll,'wheel zoom does not scroll the page or panel');
  await page.evaluate(()=>{window.insetWheelZoomDone=false;map.once('zoomend',()=>window.insetWheelZoomDone=true);});
  await page.mouse.wheel(0,240);await page.waitForFunction(()=>window.insetWheelZoomDone&&map.getZoom()===10);
  assert.equal((await state()).bearing,45);assert.equal((await state()).count,1);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator(first).last().evaluate(el=>el.click());await page.waitForTimeout(100);
  await page.locator(first).first().evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
  await page.waitForTimeout(700);assert.equal((await state()).zoom,10);assert.equal((await state()).bearing,45);assert.equal((await state()).count,1);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForTimeout(2200);await page.locator(first).last().evaluate(el=>el.click());
  assert.equal((await state()).count,1);await page.waitForTimeout(2100);assert.equal((await state()).preview,true,'timer restarts');
  await page.waitForTimeout(2100);assert.equal((await state()).preview,false,'inactivity hides preview');
  await page.locator(first).first().evaluate(el=>el.click());
  const returnBox=await page.locator('.plannerMapPreview').boundingBox();await page.mouse.move(returnBox.x+returnBox.width/2,returnBox.y+returnBox.height/2);
  await page.waitForTimeout(2200);await page.mouse.wheel(0,-240);await page.waitForFunction(()=>map.getZoom()>10);
  const zoomed=(await state()).zoom;await page.waitForTimeout(2100);assert.equal((await state()).preview,true,'wheel restarts preview timer');
  await page.locator('.plannerMapReturn').click();await page.waitForTimeout(100);assert.equal((await state()).zoom,zoomed,'return retains wheel zoom');

  assert.equal((await state()).preview,false);assert.ok(await page.evaluate(()=>{const r=document.querySelector('.plannerMapSlot').getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}));
  await page.evaluate(()=>map.setView(map.getCenter(),10,{animate:false}));
  // Existing map click inspection and endpoint dropdown recalculation still work.
  await page.evaluate(()=>{map.fire('click',{latlng:map.getCenter()});const group=typeof routeLayer==='undefined'?layers:routeLayer;const marker=Object.values(group._layers).find(l=>l instanceof L.CircleMarker&&l._events?.click);if(marker)marker.fire('click');});
  for(const id of ['start','finish']){
   await page.locator('#'+id).evaluate(el=>el.dispatchEvent(new Event('change',{bubbles:true})));
   await page.waitForTimeout(900);await page.waitForFunction(()=>typeof calculating==='undefined'?!calculationBusy:!calculating);
   assert.equal((await state()).zoom,10);assert.equal((await state()).bearing,45);
  }
  if(planner==='currents'){
   for(const [iso,zone]of [['2026-10-27T12:00:00Z','EDT'],['2026-12-01T13:00:00Z','EST'],['2026-11-01T05:30:00Z','EDT'],['2026-11-01T06:30:00Z','EST']]){
    const output=await page.evaluate(async iso=>{await load(iso.slice(0,10),Date.parse(iso));useDeparture({start:Date.parse(iso)});return {text:document.getElementById('selectedTime').textContent,expected:fmt(trip.start),start:trip.start};},iso);
    assert.equal(output.text,output.expected);assert.equal(output.start,Date.parse(iso));assert.ok(output.text.includes(zone));assert.match(output.text,/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),/);assert.ok(output.text.includes('2026'));
   }
  }
  assert.deepEqual(errors,[]);console.log(`${planner} ${width}px: ${rows} location rows and ${notices} notices, viewport/preview/timer/return, map state, dropdowns and calculation checks passed.`);await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
