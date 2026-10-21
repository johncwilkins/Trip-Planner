const assert=require('node:assert/strict'),U=require('../dist/uscg-notices.js');
const file={key:'bridge_',url:U.BASE+'bridge_1.geojson',sourceUpdatedAt:'2026-10-21T00:00:00Z'};
const n=U.normalize({id:7,geometry:{type:'Point',coordinates:[-74.45,39.35]},properties:{MSI_UID:7,TITLE:'Bridge work',BEGIN_DATE:Date.parse('2026-06-01T00:00Z'),END_DATE:Date.parse('2026-09-30T23:59:59Z'),DESCRIPTION:'Full notice',ATU:5}},file);
assert.equal(n.begin,'2026-06-01');assert.equal(n.end,'2026-09-30');assert.equal(U.active(n,'2026-09-30'),true);assert.equal(U.active(n,'2026-10-01'),false);assert.equal(U.active(n,'2026-05-31','2026-06-01'),true);
assert.equal(U.normalize({id:8,properties:{MSI_UID:8,STATUS:'Cancelled'}},file),null);
const route=[[-74.5,39.3],[-74.4,39.4]];
assert.equal(U.nearRoute(n.geometry,route),true);
assert.equal(U.nearRoute({type:'Point',coordinates:[-75,40]},route),false);
// Crossing geometry with both endpoints beyond the corridor still intersects.
assert.equal(U.nearRoute({type:'LineString',coordinates:[[-74.6,39.5],[-74.3,39.2]]},route,.01),true);
assert.equal(U.nearRoute({type:'Polygon',coordinates:[[[-74.6,39.2],[-74.3,39.2],[-74.3,39.5],[-74.6,39.5],[-74.6,39.2]]]},route,.01),true);
assert.equal(U.nearRoute(null,route),true);
assert.equal(U.inRegion({...n,geometry:null},{west:-75,east:-74,south:39,north:40}),true);
assert.equal(U.inRegion({...n,geometry:null,district:1},{west:-75,east:-74,south:39,north:40}),false);
assert.equal(U.merge([n,n]).length,1);
assert.equal(U.merge([n,{...n,geometry:{type:'Point',coordinates:[-74.46,39.35]}}])[0].geometry.type,'GeometryCollection');
assert.deepEqual(U.files({bridge_:{counter:2,timestamp:1},buoys_:{counter:12},discFedAidCor_:{counter:1}}).map(f=>f.url),[U.BASE+'bridge_1.geojson',U.BASE+'bridge_2.geojson',U.BASE+'discFedAidCor_1.geojson']);
const fs=require('node:fs'),p=require('node:path');const cache=p.join(__dirname,'../dist/nj/uscg-notices.json');
if(fs.existsSync(cache)){const snapshot=JSON.parse(fs.readFileSync(cache));assert.equal(snapshot.schemaVersion,1);assert.ok(Number.isFinite(Date.parse(snapshot.retrievedAt)));assert.ok(snapshot.files.length>10);assert.equal(new Set(snapshot.notices.map(n=>n.id)).size,snapshot.notices.length);for(const n of snapshot.notices){assert.ok(n.title&&n.sourceUrl.startsWith(U.BASE));}}
console.log('USCG notices: date overlap, cancelled records, geographic corridor, crossing lines, enclosing polygons, broad notices, deduplication and live-cache schema passed.');
const now=Date.parse('2026-10-21T12:00:00Z');
const shoal={...n,title:'Shoaling',description:'Shoaling reported',category:'Hazard to navigation',begin:'2021-01-01',end:null,modified:'2026-10-21'};
assert.equal(U.recentReason(shoal,now),null,'Metadata refresh must not resurface old shoaling');
assert.ok(U.recentReason({...shoal,contentChangedAt:'2026-10-20'},now));
assert.ok(U.recentReason({...shoal,begin:'2026-09-01'},now));
assert.equal(U.recentReason({...shoal,begin:null,reported:null},now),null);
assert.ok(U.recentReason({...n,category:'Federal aid discrepancy',description:'MISSING · Correction Status Unreported',modified:'2026-10-19',end:null},now));
assert.equal(U.recentReason({...n,description:'Correction Status Unreported · Light List 123',modified:'2026-10-20'},now),null);
assert.equal(U.recentReason({...n,category:'Proposed change',modified:'2026-10-20'},now),null);
assert.ok(U.recentReason({...n,description:'Bridge will not open during construction',modified:'2025-01-01'},now));
assert.equal(U.readable({...n,description:'STRUCT DMGD · Correction Status Unreported · Light List 123'}),'Damaged structure · Light List 123');
assert.equal(U.trackChanges([{...shoal,modified:'2026-10-22'}],[shoal],'2026-10-22')[0].contentChangedAt,null);
assert.equal(U.trackChanges([{...shoal,description:'New shoaling depth report'}],[shoal],'2026-10-22')[0].contentChangedAt,'2026-10-22');
assert.equal(U.trackChanges([shoal],[],'2026-10-22')[0].contentChangedAt,null,'First import is not a new hazard');
console.log('Notice relevance: old shoaling, timestamp-only edits, content changes, routine records and active bridge restrictions passed.');

// Real NAVCEN record: publication window is not the one-day triathlon closure.
const triathlon={"id": "msi-49127", "category": "Bridge notice", "begin": "2026-07-20", "end": "2027-01-16", "description": "General/Bridges/Temp Deviation\n\nFrom: 2026-07-20 To: 2027-01-16\n\nLocation:\n39-21-13.176N/074-27-24.084W\n\nBridge Name: United States 40-322 Bridge\n\nNJICW - Inside Thorofare\n\nMariners are advised that the highway drawbridge United States 40-322 (Albany Avenue) Bridge across New Jersey Intracoastal Waterway, Inside Thorofare, mile 70.0, at Atlantic City, NJ, will be maintained in the closed-to-navigation position to facilitate the 16th Annual Atlantic City Triathlon. The bridge will remain in the closed position from 6 a.m. through 12 p.m. on Sunday, August 9, 2026. The bridge will be able to open for emergencies, if at least 30 minutes notice is given. At all other times, the drawbridge will operate in accordance with the operating regulations set out in Title 33 Code of Federal Regulations Part 117.733(h). Mariners should adjust their transits accordingly and should use caution when transiting the area. "};
assert.ok(triathlon);
assert.deepEqual(U.eventWindow(triathlon),{begin:'2026-08-09',end:'2026-08-09'});
for(const day of ['2026-07-20','2026-08-08','2026-08-10','2026-10-21','2027-01-16'])assert.equal(U.active(triathlon,day),false,day);
assert.equal(U.active(triathlon,'2026-08-09'),true);
assert.equal(U.active(triathlon,'2026-08-08','2026-08-10'),true);
assert.equal(U.eventWindow({...triathlon,description:triathlon.description+' Work also occurs August 10, 2026.'}),null);
assert.equal(U.eventWindow({...triathlon,description:triathlon.description.replace('on Sunday,','every Sunday,')}),null);
assert.equal(U.eventWindow({...triathlon,description:'Construction from August 9, 2026 through September 9, 2026; bridge closed. At all other times normal operations.'}),null);
assert.equal(U.eventWindow({...triathlon,description:triathlon.description.replace('August 9','February 30')}),null);
assert.equal(triathlon.begin,'2026-07-20','Original source dates remain unchanged');
console.log('Event-date filtering: actual triathlon, adjacent days, overlapping trips, recurring/multiple/invalid dates and source preservation passed.');
