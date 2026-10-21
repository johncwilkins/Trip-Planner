(function(){
const U=USCGNotices,$=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let refreshStatus=null,snapshot=null,context=null,layer=null,fetchError='',selectedId=null,filtered=[];
const civil=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);
const stamp=t=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(t));
function body(n){return `<h3>${escape(n.title)}</h3><p>${escape(n.category)} · ${escape(n.waterway)}</p><p><b>Effective:</b> ${escape(n.begin||'Start not supplied')} — ${escape(n.end||'No end date supplied')}</p><div class="noticeText">${escape(n.description)}</div><p><a href="${escape(n.sourceUrl)}" target="_blank" rel="noopener">Coast Guard source file</a> · <a href="${U.SOURCE}" target="_blank" rel="noopener">NAVCEN notice map</a></p><small>Snapshot retrieved ${escape(stamp(snapshot.retrievedAt))}. Read the full notice for daily work hours and conditions.</small>`;}
function inspect(id){const n=filtered.find(n=>n.id===id);if(!n)return;selectedId=id;$('noticeDetail').innerHTML=body(n);$('noticeDetail').hidden=false;}
function render(){
 if(layer&&context?.map){context.map.removeLayer(layer);layer=null;}
 if(!snapshot){$('noticeSummary').textContent=fetchError||'Loading the saved Coast Guard notice snapshot…';return;}
 const refreshFailed=refreshStatus?.status==='failed';
 const stale=Date.now()-Date.parse(snapshot.retrievedAt)>8*86400000;
 $('noticeStatus').textContent=`${snapshot.complete===false?'Available files retrieved':'Last successful refresh'}: ${stamp(snapshot.retrievedAt)} · weekly updates.${snapshot.complete===false?' PARTIAL: '+snapshot.unavailableFiles.length+' source file(s) unavailable; older records retained where available. Last complete refresh: '+(snapshot.lastCompleteAt?stamp(snapshot.lastCompleteAt):'none yet')+'.':''}${stale?' STALE: more than eight days old.':''}${refreshFailed?' Latest source refresh failed ('+stamp(refreshStatus.attemptedAt)+'): '+refreshStatus.error+'. Prior snapshot retained.':''}${fetchError?' '+fetchError:''}`;
 $('noticeStatus').className=stale||fetchError||snapshot.complete===false||refreshFailed?'lowWaterNotice lowWaterWarning':'formHint';
 if(!context)return;
 const start=civil(context.departure),end=civil(context.end);
 filtered=snapshot.notices.filter(n=>U.active(n,start,end)&&U.nearRoute(n.geometry,context.coordinates,2));
 const broad=filtered.filter(n=>!n.geometry);
 $('noticeSummary').textContent=`${filtered.length} notices in this snapshot match ${start}${end!==start?'–'+end:''} and the selected passage (within 2 nm, or overlapping an area). ${broad.length} have no precise location. This is a filtered snapshot, not confirmation that the route is clear.`;
 $('noticeList').innerHTML=filtered.map(n=>`<button type="button" class="noticeListItem" data-notice="${escape(n.id)}"><b>${escape(n.title)}</b><small>${escape(n.category)} · ${escape(n.begin||'Start unknown')} — ${escape(n.end||'End unknown')}${!n.geometry?' · Broader District 5 notice, location unspecified':''}</small></button>`).join('')||'<p>No matching notices found in this snapshot. Check NAVCEN for updates and notices outside these geographic files.</p>';
 $('noticeList').querySelectorAll('[data-notice]').forEach(b=>b.onclick=()=>inspect(b.dataset.notice));
 if(selectedId&&filtered.some(n=>n.id===selectedId))inspect(selectedId);else{$('noticeDetail').hidden=true;selectedId=null;}
 if(!$('showNotices').checked||!context.map)return;
 if(!context.map.getPane('uscgNoticePane'))context.map.createPane('uscgNoticePane',context.map.getPane('markerPane').parentElement).style.zIndex=660;
 layer=L.layerGroup().addTo(context.map);
 for(const n of filtered){
  if(!n.geometry)continue;
  const display=L.geoJSON({type:'Feature',properties:{},geometry:n.geometry},{bubblingMouseEvents:false,style:()=>({color:'#b84c12',weight:3,fillColor:'#ef9e2e',fillOpacity:.14}),pointToLayer:(f,latlng)=>L.marker(latlng,{pane:'uscgNoticePane',bubblingMouseEvents:false,title:'Coast Guard notice: '+n.title,alt:'Coast Guard notice: '+n.title,icon:L.divIcon({className:'uscgNoticeIcon',html:'!',iconSize:[24,24],iconAnchor:[12,12]})})});
  display.bindPopup(body(n),{maxWidth:440,maxHeight:420});display.on('click',e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);inspect(n.id);});display.addTo(layer);
 }
}
async function load(){
 $('loadNotices').disabled=true;$('noticeStatus').textContent='Loading the latest published notice snapshot…';
 try{
  const [response,statusResponse]=await Promise.all([fetch('nj/uscg-notices.json?v='+Date.now(),{cache:'no-store'}),fetch('nj/uscg-refresh-status.json?v='+Date.now(),{cache:'no-store'})]);
  if(statusResponse.ok)refreshStatus=await statusResponse.json();if(!response.ok)throw Error('Published notice snapshot unavailable.');
  const next=await response.json();if(next.schemaVersion!==1||!Array.isArray(next.notices)||!Number.isFinite(Date.parse(next.retrievedAt)))throw Error('Invalid notice snapshot.');
  if(!snapshot||Date.parse(next.retrievedAt)>=Date.parse(snapshot.retrievedAt))snapshot=next;
  fetchError='';try{localStorage.setItem('nj-uscg-snapshot-v1',JSON.stringify(snapshot));}catch(e){}
 }catch(e){fetchError='Refresh failed; '+(snapshot?'retaining the last successful snapshot.':'no notice data available.');}
 finally{$('loadNotices').disabled=false;render();}
}
window.addEventListener('nj-trip-updated',e=>{context=e.detail;render();});
window.addEventListener('nj-trip-cleared',()=>{if(layer&&context?.map)context.map.removeLayer(layer);layer=null;context=null;filtered=[];$('noticeList').textContent='Choose a valid passage to match notices.';$('noticeDetail').hidden=true;});
$('showNotices').onchange=render;$('loadNotices').onclick=load;
$('refreshNotices').onclick=()=>{$('noticeRefreshHint').textContent='On GitHub, click Run workflow with Notices only enabled. When the job finishes, click Load latest snapshot here. Repository-owner sign-in is required to start the job.';};
try{const saved=JSON.parse(localStorage.getItem('nj-uscg-snapshot-v1')||'null');if(saved?.schemaVersion===1&&Array.isArray(saved.notices)&&Number.isFinite(Date.parse(saved.retrievedAt)))snapshot=saved;}catch(e){}
load();
})();
