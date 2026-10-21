(function(root){
const labels={physical:'Physical marker problem',visibility:'Lighting and visibility',other:'Other aid discrepancy'};
const codes={
 MISSING:['MISSING','physical'],'OFF STATION':['OFF STATION','physical'],SUNK:['SUNK','physical'],SINKING:['SINKING','physical'],ADRIFT:['ADRIFT','physical'],
 'STRUCT DEST':['STRUCTURE DESTROYED','physical'],'STRUCT DMGD':['STRUCTURE DAMAGED','physical'],'IMPROPER POSITION':['IMPROPER POSITION','physical'],
 'LT EXT':['LIGHT EXTINGUISHED','visibility'],'LT IMCH':['INCORRECT LIGHT CHARACTERISTIC','visibility'],
 'DBD DEST':['DAYBOARD DESTROYED','visibility'],'DBD DMGD':['DAYBOARD DAMAGED','visibility'],'DAYMK DMGD':['DAYMARK DAMAGED','visibility'],'DAYMK IMCH':['INCORRECT DAYMARK CHARACTERISTIC','visibility'],
 'REFL MISSING':['REFLECTOR MISSING','visibility'],'REFL DMGD':['REFLECTOR DAMAGED','visibility'],
 'SOUND SIG INOP':['SOUND SIGNAL INOPERATIVE','other'],
 'HAZ NAV':['NAVIGATION HAZARD','other'],TRLB:['TEMPORARY LIGHTED BUOY','other'],TRUB:['TEMPORARY UNLIGHTED BUOY','other']
};
const rank={physical:0,visibility:1,other:2},isAid=n=>/^(Federal|Private) aid discrepancy$/.test(n.category);
const clean=v=>v==null?'':String(v).trim(),date=v=>{if(!v)return null;const d=new Date(v);return Number.isFinite(+d)?d.toISOString().slice(0,10):null;};
function dms(v){const m=clean(v).match(/^(\d{2,3})-(\d{2})-([\d.]+)([NSEW])$/i);if(!m)return null;return (+m[1]+ +m[2]/60+ +m[3]/3600)*(/[SW]/i.test(m[4])?-1:1);}
function info(n){
 if(!isAid(n))return null;
 if(n.aidReports){const reports=n.aidReports.map(info),groups=[...new Set(reports.flatMap(x=>x.groups))].sort((a,b)=>rank[a]-rank[b]),status=reports.every(x=>x.status==='restored')?'restored':reports.some(x=>x.status==='outstanding')?'outstanding':'uncertain';return {...info({...n,aidReports:null}),groups,group:groups[0],status,statusLabel:{restored:'Restored or canceled',outstanding:'Outstanding',uncertain:'Status uncertain'}[status],discrepancy:[...new Set(reports.map(x=>x.discrepancy))].join(' / '),reportCount:reports.length};}
 const p=n.aidSource,legacy=!p,raw=clean(p?.DISCREP_STATUS||(legacy?n.description.split(' · ')[0]:''));
 const supplied=raw&&!/^(Correction Status|Light List|See the Coast Guard)/i.test(raw),parts=supplied?raw.split('/').map(x=>x.trim()).filter(Boolean):[];
 const decoded=parts.map(code=>codes[code.toUpperCase()]||[code.toUpperCase(),'other']);
 const groups=[...new Set(decoded.map(x=>x[1]))].sort((a,b)=>rank[a]-rank[b]);if(!groups.length)groups.push('other');
 const correction=clean(p?.DISCREP_CORR_STATUS||(legacy?n.description.match(/Correction Status[^·]*/i)?.[0]:'')),officialStatus=clean(p?.STATUS||p?.MSI_STATUS);
 let status='uncertain';
 if(p?.correctedFile||date(p?.CORRECTION_DATE)||/\b(cancelled|canceled|withdrawn)\b/i.test(officialStatus))status='restored';
 else if(/unreported|unknown|not reported|not supplied|^N\/A$/i.test(correction)||!correction)status='uncertain';
 else if(/\b(uncorrected|unresolved|outstanding|not corrected|not restored|not resolved)\b/i.test(correction))status='outstanding';
 else if(/\b(restored|corrected|resolved|withdrawn|canceled|cancelled|rebuilt|recovered|relighted|replaced)\b/i.test(correction))status='restored';
 const chartLat=dms(p?.ASSIGNED_LATITUDE),chartLon=dms(p?.ASSIGNED_LONGITUDE);
 const observedLat=p?.OBSERVED_LATITUDE_DECIMAL,observedLon=p?.OBSERVED_LONGITUDE_DECIMAL;
 return {raw:supplied?raw:null,discrepancy:decoded.length?decoded.map(x=>x[0]).join(' / '):'Discrepancy type not specified',groups,group:groups[0],status,statusLabel:{restored:'Restored or canceled',outstanding:'Outstanding',uncertain:'Status uncertain'}[status],correction:correction||'Not reported',lightList:clean(p?.LLNR||n.description.match(/Light List (\S+)/)?.[1]),aidNumber:clean(p?.AID_NUMBER),recordId:clean(p?.LNM_UID||n.id),officialStatus,created:date(p?.CREATE_DATE)||(legacy?n.reported:null),updated:date(p?.MODIFIED_DATE),reported:date(p?.REPORT_DATE||p?.DISCREPANCY_REPORT_DATE),corrected:date(p?.CORRECTION_DATE),chartedPosition:chartLat!=null&&chartLon!=null?[chartLon,chartLat]:null,observedPosition:observedLat!=null&&observedLon!=null&&Number.isFinite(+observedLat)&&Number.isFinite(+observedLon)&&Math.abs(+observedLat)<=90&&Math.abs(+observedLon)<=180?[+observedLon,+observedLat]:null,replacement:parts.some(x=>/^TR[LU]B$/i.test(x)),reportCount:1};
}
function headline(n){const q=info(n),primary=q?.raw?.split('/').filter(c=>!['HAZ NAV','TRLB','TRUB'].includes(c.trim().toUpperCase())).map(c=>codes[c.trim().toUpperCase()]?.[0]||c.trim().toUpperCase()).join(' / ');return q?clean(n.title).replace(/^New Jersey Intracoastal(?: Waterway)?\s+/i,'')+' — '+(primary||q.discrepancy):n.title;}
function group(notices){const result=[],aids=new Map();for(const n of notices){if(!isAid(n)){result.push(n);continue;}const q=info(n),key=n.category+':'+(q.aidNumber||q.lightList||n.id);if(!aids.has(key))aids.set(key,[]);aids.get(key).push(n);}for(const rows of aids.values()){rows.sort((a,b)=>(info(b).corrected||info(b).created||b.modified||'').localeCompare(info(a).corrected||info(a).created||a.modified||''));result.push(rows.length===1?rows[0]:{...rows[0],aidReports:rows});}return result;}
function counts(notices){const out={physical:0,visibility:0,other:0,total:0,unspecified:0,uncertain:0,outstanding:0,restored:0};for(const n of notices){const q=info(n);if(!q)continue;out[q.group]++;out.total++;out[q.status]++;if(!q.raw)out.unspecified++;}return out;}
root.USCGAids={labels,codes,isAid,info,headline,group,counts};if(typeof module!=='undefined')module.exports=root.USCGAids;
})(globalThis);
