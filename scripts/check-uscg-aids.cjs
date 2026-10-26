const assert=require('node:assert/strict'),A=require('../dist/uscg-aids.js'),U=require('../dist/uscg-notices.js');
const aid=(code,correction='Correction Status Unreported',extra={})=>({id:'1',title:'New Jersey Intracoastal Waterway Buoy 38A',category:'Federal aid discrepancy',description:'',aidSource:{DISCREP_STATUS:code,DISCREP_CORR_STATUS:correction,MSI_STATUS:'Approved',LLNR:123,...extra}});
assert.equal(A.headline(aid('MISSING')),'Buoy 38A — MISSING');assert.equal(A.info(aid('MISSING')).status,'uncertain');
assert.equal(A.info(aid('LT EXT')).group,'visibility');assert.equal(A.info(aid('DBD DMGD')).group,'visibility');assert.equal(A.info(aid('STRUCT DMGD')).group,'physical');
assert.equal(A.info(aid('STRUCT DEST/HAZ NAV/TRLB')).group,'physical');assert.equal(A.info(aid('STRUCT DEST/HAZ NAV/TRLB')).replacement,true);
assert.equal(A.headline(aid('STRUCT DEST/HAZ NAV/TRLB')),'Buoy 38A — STRUCTURE DESTROYED');
assert.equal(A.info(aid('SOUND SIG INOP')).group,'other');assert.equal(A.info(aid('UNFAMILIAR CODE')).group,'other');assert.equal(A.info(aid('UNFAMILIAR CODE')).discrepancy,'UNFAMILIAR CODE');
assert.equal(A.info(aid('')).discrepancy,'Discrepancy type not specified');
for(const s of ['Uncorrected','NOT CORRECTED','Outstanding','Unresolved'])assert.equal(A.info(aid('MISSING',s)).status,'outstanding');
for(const s of ['Restored','Corrected','REBUILT/RECOVERED','REPLACED'])assert.equal(A.info(aid('MISSING',s)).status,'restored');
assert.equal(A.info(aid('MISSING','N/A',{correctedFile:true})).status,'restored');
assert.equal(A.info(aid('MISSING','',{MSI_STATUS:'Cancelled'})).status,'restored');
assert.equal(A.info(aid('MISSING','Unreported',{CREATE_DATE:1792416611000})).reported,null,'Create date is not the occurrence date');
assert.equal(A.info(aid('MISSING','Unreported',{CREATE_DATE:1792416611000})).updated,null,'Create date is not the update date');
const old=aid('MISSING'),next={...aid('MISSING'),id:'2',aidSource:{...old.aidSource,CREATE_DATE:1792416611000}};
const grouped=A.group([old,next]);assert.equal(grouped.length,1);assert.equal(grouped[0].aidReports.length,2);assert.equal(A.info(grouped[0]).status,'uncertain');assert.equal(A.counts(grouped).physical,1);
const mixed=A.group([old,{...next,aidSource:{...next.aidSource,correctedFile:true}}]);assert.equal(A.info(mixed[0]).status,'uncertain','A corrected report must not silently resolve a different report');
const positional=A.info(aid('OFF STATION','Unreported',{ASSIGNED_LATITUDE:'39-21-34.991N',ASSIGNED_LONGITUDE:'074-26-59.052W'}));assert.ok(positional.chartedPosition);assert.equal(positional.observedPosition,null,'Do not invent observed positions');
const f={key:'discFedAidCor_',url:U.BASE+'discFedAidCor_1.geojson'};
const normalized=U.normalize({properties:{LNM_UID:5,NAME:'Buoy',DISCREP_STATUS:'MISSING',DISCREP_CORR_STATUS:'N/A',CREATE_DATE:1792416611000},geometry:null},f);
assert.equal(A.info(normalized).status,'restored');assert.equal(normalized.aidSource.DISCREP_STATUS,'MISSING');
console.log('Aid discrepancies: source codes, physical vs dayboard damage, uncertain/negative/restored statuses, dates, grouped report provenance and position roles passed.');
// A temporary substitute changes default visibility, never correction status.
for(const code of ['MISSING/TRLB','STRUCT DEST/HAZ NAV/TRLB','STRUCT DMGD/TRUB']){
 const n=aid(code);assert.equal(A.visible(n),false);assert.equal(A.visible(n,{includeReplacements:true}),true);assert.equal(A.info(n).status,'uncertain');
}
for(const code of ['MISSING','STRUCT DEST','STRUCT DEST/TRLB/OFF STATION','MISSING/TRLB/LT EXT','TRLB/UNKNOWN','SINKING/TRUB'])assert.equal(A.visible(aid(code)),true);
const conflicting=A.group([aid('STRUCT DEST/TRLB'),{...aid('OFF STATION'),id:'another-report'}])[0];assert.equal(A.visible(conflicting),true,'Do not hide another report for the same aid');
assert.equal(A.visible(aid('MISSING/TRLB','Restored'),{includeReplacements:true}),false);
console.log('Temporary replacements: explicit codes, additional hazards, grouped reports, opt-in visibility and unchanged statuses passed.');
