/* One live Leaflet map, temporarily docked when its original slot is offscreen. */
(function(root){
 root.setupPlannerMapNavigation=function(map){
  const container=map.getContainer(),slot=document.createElement('div');
  slot.className='plannerMapSlot';container.before(slot);slot.append(container);
  const preview=document.createElement('div');preview.className='plannerMapPreview';preview.hidden=true;
  const back=document.createElement('button');back.type='button';back.className='plannerMapReturn';back.textContent='Return to full map';
  const close=document.createElement('button');close.type='button';close.className='plannerMapClose';close.textContent='×';close.setAttribute('aria-label','Dismiss map preview');
  document.body.append(preview);let timer,ring,docked=false,hovering=false,moving=false;
  const reduced=()=>root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visible=()=>{
   const r=slot.getBoundingClientRect();let top=Math.max(0,r.top),bottom=Math.min(root.innerHeight,r.bottom),left=Math.max(0,r.left),right=Math.min(root.innerWidth,r.right);
   for(let parent=slot.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent),bounds=parent.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,bounds.top);bottom=Math.min(bottom,bounds.bottom);}if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,bounds.left);right=Math.min(right,bounds.right);}}
   return bottom>top&&right>left;
  };
  function resize(){const center=map.getCenter();map.stop();map.invalidateSize({pan:false,animate:false});map.setView(center,map.getZoom(),{animate:false});}
  function position(){const panel=document.querySelector('.controlPanel'),r=panel?.getBoundingClientRect();preview.style.right=r&&r.left>root.innerWidth/2&&r.width<root.innerWidth/2&&r.bottom>0&&r.top<root.innerHeight?Math.max(12,root.innerWidth-r.left+12)+'px':'12px';}
  function restore(){clearTimeout(timer);if(!docked)return;docked=false;hovering=false;moving=false;slot.append(container);preview.hidden=true;slot.style.height='';resize();}
  function dock(){if(docked)return;slot.style.height=slot.getBoundingClientRect().height+'px';docked=true;preview.hidden=false;preview.append(container,back,close);position();hovering=root.matchMedia('(any-hover: hover)').matches&&preview.matches(':hover');resize();}
  back.onclick=()=>{restore();slot.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'center'});};close.onclick=restore;
  function keepVisible(){clearTimeout(timer);if(docked&&!hovering&&!moving)timer=setTimeout(()=>{if(!hovering&&!moving)restore();},4000);}
  preview.addEventListener('pointerenter',event=>{if(event.pointerType==='touch')return;hovering=true;clearTimeout(timer);});
  preview.addEventListener('pointerleave',event=>{if(event.pointerType==='touch')return;hovering=false;if(docked)keepVisible();});
  // Keep the preview open during native Leaflet panning and zooming.
  map.on('movestart zoomstart',()=>{if(docked){moving=true;clearTimeout(timer);}});
  map.on('moveend zoomend',()=>{if(docked){moving=false;keepVisible();}});
  container.addEventListener('wheel',()=>{if(docked)keepVisible();},{passive:true,capture:true});
  // Footer buttons pass wheel gestures to the same live map.
  preview.addEventListener('wheel',event=>{
   if(!docked||container.contains(event.target))return;
   event.preventDefault();event.stopPropagation();keepVisible();
   container.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:event.deltaX,deltaY:event.deltaY,deltaZ:event.deltaZ,deltaMode:event.deltaMode,clientX:event.clientX,clientY:event.clientY,ctrlKey:event.ctrlKey,shiftKey:event.shiftKey,altKey:event.altKey,metaKey:event.metaKey}));
  },{passive:false});
  back.title='Drag the map to pan; scroll to zoom; click here to return to the full map';
  // Leaflet suppresses clicks after dragging; marker/route clicks keep their normal behavior.
  map.on('click',event=>{if(docked&&event.sourceTarget===map&&event.originalEvent&&!event.originalEvent.target.closest?.('.leaflet-interactive:not(canvas),.leaflet-marker-icon,.leaflet-popup,.leaflet-control'))back.onclick();});
  root.addEventListener('scroll',()=>{if(docked&&visible())restore();},{passive:true,capture:true});
  root.addEventListener('resize',()=>{if(docked){position();if(visible())restore();}});
  function highlight(latlng){
   const point=L.latLng(latlng);if(!Number.isFinite(point.lat)||!Number.isFinite(point.lng))return;
   if(ring)map.removeLayer(ring);
   ring=L.marker(point,{interactive:false,keyboard:false,zIndexOffset:1000,icon:L.divIcon({className:'plannerLocationPulse',html:'<span></span>',iconSize:[36,36],iconAnchor:[18,18]})}).addTo(map);
  }
  const highlightedLayers=new WeakSet();
  map.on('layeradd',({layer})=>{if((layer instanceof L.Marker||layer instanceof L.CircleMarker)&&layer.options.interactive!==false&&!highlightedLayers.has(layer)){highlightedLayers.add(layer);layer.on('click',()=>highlight(layer.getLatLng()));}});
  map.on('click',event=>{if(event.latlng&&!(event.sourceTarget instanceof L.Marker)&&!(event.sourceTarget instanceof L.CircleMarker))highlight(event.latlng);});
  function focus(latlng){
   const point=L.latLng(latlng);if(!Number.isFinite(point.lat)||!Number.isFinite(point.lng))return;
   if(visible())restore();else dock();
   map.stop();map.panTo(point,{animate:!reduced(),duration:.45});
   keepVisible();
   highlight(point);
  }
  document.addEventListener('click',event=>{const item=event.target.closest('[data-map-lat][data-map-lon]');if(item)focus([+item.dataset.mapLat,+item.dataset.mapLon]);});
  document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-map-lat][data-map-lon]')){event.preventDefault();event.target.click();}});
  map.plannerFocus=focus;return focus;
 };
 root.plannerGeometryPoint=function(geometry){
  if(!geometry)return null;
  const points=[];function collect(g){if(g.type==='GeometryCollection'){g.geometries.forEach(collect);return;}function walk(c){if(typeof c[0]==='number'){if(Number.isFinite(c[0])&&Number.isFinite(c[1]))points.push(c);return;}c.forEach(walk);}walk(g.coordinates||[]);}collect(geometry);
  // Use a supplied geographic point, including for line and area notices.
  return points.length?[points[0][1],points[0][0]]:null;
 };
 root.plannerLocationRow=function(row,action){row.tabIndex=0;row.classList.add('stationRowsLink');row.onclick=action;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action();}};};
})(globalThis);
