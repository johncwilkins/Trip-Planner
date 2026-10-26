(function(){
const U=USCGNotices,A=USCGAids,$=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let refreshStatus=null,snapshot=null,context=null,layer=null,fetchError='',selectedId=null,filtered=[];
const civil=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);
const stamp=t=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(t));
function dates(n){const event=U.eventWindow(n);if(event)return 'Restriction date: '+event.begin+' · see notice for hours';return n.begin||n.end?[(n.begin?'From '+n.begin:''),(n.end?'Through '+n.end:'')].filter(Boolean).join(' · '):(n.modified?'Source updated '+n.modified:'Date not supplied');}
function sourceDate(n,q){return q.updated?'Source record updated: '+q.updated:n.sourceUpdatedAt?'Source file updated: '+stamp(n.sourceUpdatedAt):'Source update date not supplied';}
function aidCompact(n){const q=A.info(n);return `<b>${escape(A.headline(n))}</b><small>${escape(A.labels[q.group])} · <span class="aidStatus">${escape(q.statusLabel)}</span>${q.reportCount>1?' · '+q.reportCount+' source reports':''}</small><small>${q.lightList?'Light List '+escape(q.lightList)+' · ':''}${escape(sourceDate(n,q))}</small><small>Correction status: ${escape(/Unreported/i.test(q.correction)?'Not reported':q.correction)}${q.replacement?' · Temporary replacement buoy reported':''}</small>`;}
function aidDetails(n){const q=A.info(n),reports=n.aidReports||[n];return `<h3>${escape(A.headline(n))}</h3><p>${escape(A.labels[q.group])} · <b>${escape(q.statusLabel)}</b></p>${q.status==='uncertain'?'<p>A discrepancy was reported. The source does not reliably establish its present correction status.</p>':''}<p>${escape(n.category)} · ${escape(n.waterway)}</p><p><b>Full official aid name:</b> ${escape(n.title)}</p>${reports.map(r=>{const x=A.info(r);return `<section class="aidSourceFields"><p><b>Reported discrepancy:</b> ${escape(x.discrepancy)}<br><b>Correction status:</b> ${escape(x.correction)}<br><b>Official aid number:</b> ${escape(x.aidNumber||'Not supplied')} · <b>Light List:</b> ${escape(x.lightList||'Not supplied')}<br><b>Source record:</b> ${escape(x.recordId)}<br>${x.reported?'<b>Report date:</b> '+escape(x.reported):'<b>Report date:</b> Not supplied'}<br>${x.created?'<b>Source record created:</b> '+escape(x.created)+' (not assumed to be the occurrence date)<br>':''}${escape(sourceDate(r,x))}${x.corrected?'<br><b>Official correction date:</b> '+escape(x.corrected):''}</p><details><summary>Original source wording &amp; fields</summary><div class="noticeText">${escape(r.description)}</div>${r.aidSource?'<pre class="noticeText">'+escape(JSON.stringify(r.aidSource,null,2))+'</pre>':''}</details><p><a href="${escape(r.sourceUrl)}" target="_blank" rel="noopener">Original Coast Guard source file</a> · record ${escape(x.recordId)}</p></section>`;}).join('')}<p><b>Source map position:</b> ${escape(JSON.stringify(n.geometry?.coordinates||'Not supplied'))}${q.chartedPosition?'<br><b>Assigned/charted position:</b> '+escape(q.chartedPosition.join(', ')):''}${q.observedPosition?'<br><b>Explicit observed position:</b> '+escape(q.observedPosition.join(', ')):''}</p><p><a href="${U.SOURCE}" target="_blank" rel="noopener">Official NAVCEN notice map</a> · <a href="nj/aid-audit.json" target="_blank" rel="noopener">Snapshot audit</a></p><small>Snapshot retrieved ${escape(stamp(snapshot.retrievedAt))}. Positions are labeled only as the source identifies them.</small>`;}
function body(n){if(A.isAid(n))return aidDetails(n);return `<h3>${escape(U.headline(n))}</h3><p>${escape(n.category)} · ${escape(n.waterway)}</p><p>${escape(dates(n))}</p><div class="noticeText">${escape(U.readable(n))}</div><details><summary>Original source wording</summary><div class="noticeText">${escape(n.description)}</div></details><p><a href="${escape(n.sourceUrl)}" target="_blank" rel="noopener">Coast Guard source file</a> · <a href="${U.SOURCE}" target="_blank" rel="noopener">NAVCEN notice map</a></p><small>Snapshot retrieved ${escape(stamp(snapshot.retrievedAt))}. Read the full notice for daily work hours and conditions.</small>`;}
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
 const all=$('noticeScope').value==='all',corridor=Number($('noticeCorridor').value);
 const matching=snapshot.notices.filter(n=>(A.isAid(n)||U.active(n,start,end))&&U.nearRoute(n.geometry,context.coordinates,corridor));
 const grouped=A.group(matching),aids=grouped.filter(A.isAid),counts=A.counts(aids),selected={physical:$('aidPhysical').checked,visibility:$('aidVisibility').checked,other:$('aidOther').checked};
 $('aidCounts').textContent=`${counts.total} aids · ${counts.replacementCovered} with temporary replacements and no additional unresolved problem reported · ${matching.filter(A.isAid).length} source reports · ${counts.uncertain} status uncertain · ${counts.outstanding} explicitly outstanding · ${counts.restored} restored/canceled. Counts include all ages and all statuses before category selection.`;
 for(const key of ['physical','visibility','other']){const shown=aids.filter(n=>A.info(n).group===key&&selected[key]&&A.visible(n,{includeReplacements:$('aidReplacements').checked,includeRestored:$('aidRestored').checked})).length;$('aid'+key[0].toUpperCase()+key.slice(1)+'Count').textContent='('+shown+' shown / '+counts[key]+' total)';}
 filtered=grouped.filter(n=>{if(!A.isAid(n))return $('otherNotices').checked&&(all||U.recentReason(n));const q=A.info(n);return selected[q.group]&&A.visible(n,{includeReplacements:$('aidReplacements').checked,includeRestored:$('aidRestored').checked});}).sort((a,b)=>{const x=A.info(a),y=A.info(b);return (x?0:1)-(y?0:1)||(x&&y?({physical:0,visibility:1,other:2}[x.group]-{physical:0,visibility:1,other:2}[y.group]):0)||(b.modified||b.begin||'').localeCompare(a.modified||a.begin||'');});
 const broad=filtered.filter(n=>!n.geometry);
 $('noticeSummary').textContent=`${filtered.length} notices in this snapshot match ${start}${end!==start?'–'+end:''} and the selected passage (within ${corridor} nm, or overlapping an area). Category, status, temporary-replacement and notice-view filters applied; all aid categories remain selectable. ${broad.length} have no precise location. Aid correction status is as supplied in the snapshot; it is not reconstructed for the trip date. This is not confirmation that the route is clear.`;
 $('noticeList').innerHTML=filtered.map(n=>`<button type="button" class="noticeListItem" data-notice="${escape(n.id)}">${A.isAid(n)?aidCompact(n):`<b>${escape(U.headline(n))}</b><small>${escape(n.category)} · ${escape(dates(n))} · ${escape(U.recentReason(n)||'Older or routine notice')}${!n.geometry?' · Broader District 5 notice, location unspecified':''}</small>`}</button>`).join('')||'<p>No matching notices found in this snapshot. Check NAVCEN for updates and notices outside these geographic files.</p>';
 $('noticeList').querySelectorAll('[data-notice]').forEach(b=>b.onclick=()=>inspect(b.dataset.notice));
 if(selectedId&&filtered.some(n=>n.id===selectedId))inspect(selectedId);else{$('noticeDetail').hidden=true;selectedId=null;}
 if(!$('showNotices').checked||!context.map)return;
 if(!context.map.getPane('uscgNoticePane'))context.map.createPane('uscgNoticePane',context.map.getPane('markerPane').parentElement).style.zIndex=660;
 layer=L.layerGroup().addTo(context.map);
 for(const n of filtered){
  if(!n.geometry)continue;
  const aid=A.info(n),symbol=aid?({physical:'▲',visibility:'◐',other:'◆'}[aid.group]):'!',title=aid?A.headline(n)+' · '+aid.statusLabel:n.title;
  const display=L.geoJSON({type:'Feature',properties:{},geometry:n.geometry},{bubblingMouseEvents:false,style:()=>({color:'#b84c12',weight:3,fillColor:'#ef9e2e',fillOpacity:.14}),pointToLayer:(f,latlng)=>L.marker(latlng,{pane:'uscgNoticePane',bubblingMouseEvents:false,title:'Coast Guard notice: '+title,alt:'Coast Guard notice: '+title,icon:L.divIcon({className:'uscgNoticeIcon'+(aid?' uscgAidIcon '+aid.group+' '+aid.status:''),html:symbol,iconSize:[24,24],iconAnchor:[12,12]})})});
  display.bindPopup(body(n),{maxWidth:440,maxHeight:420});display.on('click',e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);inspect(n.id);});display.addTo(layer);
  if(aid?.chartedPosition&&aid?.observedPosition){L.circleMarker([aid.chartedPosition[1],aid.chartedPosition[0]],{radius:7,color:'#3e6578',fillOpacity:0,dashArray:'3 3'}).bindPopup('Assigned/charted position · '+escape(title)).addTo(layer);L.marker([aid.observedPosition[1],aid.observedPosition[0]],{pane:'uscgNoticePane',title:'Observed position · '+title}).bindPopup('Observed position · '+body(n),{maxWidth:440,maxHeight:420}).addTo(layer);}
 }
}
async function load(){
 $('noticeStatus').textContent='Loading the latest published notice snapshot…';
 try{
  const [response,statusResponse]=await Promise.all([fetch('nj/uscg-notices.json?v='+Date.now(),{cache:'no-store'}),fetch('nj/uscg-refresh-status.json?v='+Date.now(),{cache:'no-store'})]);
  if(statusResponse.ok)refreshStatus=await statusResponse.json();if(!response.ok)throw Error('Published notice snapshot unavailable.');
  const next=await response.json();if(next.schemaVersion!==1||!Array.isArray(next.notices)||!Number.isFinite(Date.parse(next.retrievedAt)))throw Error('Invalid notice snapshot.');
  if(!snapshot||Date.parse(next.retrievedAt)>=Date.parse(snapshot.retrievedAt))snapshot=next;
  fetchError='';try{localStorage.setItem('nj-uscg-snapshot-v1',JSON.stringify(snapshot));}catch(e){}
 }catch(e){fetchError='Refresh failed; '+(snapshot?'retaining the last successful snapshot.':'no notice data available.');}
 finally{render();}
}
window.addEventListener('nj-trip-updated',e=>{context=e.detail;render();});
window.addEventListener('nj-trip-cleared',()=>{if(layer&&context?.map)context.map.removeLayer(layer);layer=null;context=null;filtered=[];$('noticeList').textContent='Choose a valid passage to match notices.';$('noticeDetail').hidden=true;});
for(const id of ['aidPhysical','aidVisibility','aidOther','aidRestored','aidReplacements','otherNotices'])$(id).onchange=render;
$('noticeScope').onchange=render;$('noticeCorridor').onchange=render;$('showNotices').onchange=render;
try{const saved=JSON.parse(localStorage.getItem('nj-uscg-snapshot-v1')||'null');if(saved?.schemaVersion===1&&Array.isArray(saved.notices)&&Number.isFinite(Date.parse(saved.retrievedAt)))snapshot=saved;}catch(e){}
load();
setInterval(()=>{if(!document.hidden)load();},30*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
})();
