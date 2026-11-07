import assert from 'node:assert/strict';
import {daylight,windowDays,normalizeOpenMeteo,refreshTarget} from '../backend/environment.mjs';
import {validateBundle,coverageCandidates} from '../backend/environment-imports.mjs';
const now=new Date('2026-11-03T00:00:00Z');
assert.deepEqual(windowDays(undefined,undefined,'Australia/Melbourne',now),['2026-11-03','2026-11-04','2026-11-05']);
assert.throws(()=>windowDays('2026-11-05',3,'Australia/Melbourne',now));
assert.throws(()=>windowDays('2026-02-30',1,'Australia/Melbourne',now));
for(const [point,zone]of [[[145,-38],'Australia/Melbourne'],[[159.08,-31.55],'Australia/Lord_Howe'],[[128.88,-31.67],'Australia/Eucla']]){
 const d=daylight(point,zone,['2026-10-04']).days[0];assert.ok(d.sunrise&&d.sunset);assert.ok(d.sunrise<d.sunset);assert.equal(new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(new Date(d.sunrise)),'2026-10-04');
}
assert.equal(daylight(null,'UTC',[]).status,'unavailable');
const raw={longitude:145,latitude:-38,hourly:{time:[1793664000,1793667600],wave_height:[1,null],sea_level_height_msl:[null,0.3]},hourly_units:{wave_height:'m',sea_level_height_msl:'m'}};
const normal=normalizeOpenMeteo(raw,'marine');assert.equal(normal.samples[0].seaLevel,null);assert.equal(normal.datum,'global_msl');
assert.throws(()=>normalizeOpenMeteo({...raw,hourly_units:{}},'marine'));
assert.throws(()=>normalizeOpenMeteo({...raw,hourly:{...raw.hourly,time:[1,1]}},'marine'));
assert.throws(()=>validateBundle({version:1,sources:[],predictions:[{stationId:'a',source_id:'b',payload:{datum:'LAT',issuedAt:now.toISOString(),attribution:'source',samples:[{time:now.toISOString(),height:NaN}]}}]}));
let fetches=0;const queries=[];const db={query:async(sql,args)=>{queries.push(sql);if(sql.startsWith('UPDATE finfolk.environment_jobs SET lease_token=$2'))return [{target_id:'a'}];if(sql.startsWith('SELECT enabled'))return [{enabled:false,metadata:{}}];return [];}};
await refreshTarget(db,{id:'a',source_id:'open-meteo',product:'weather',configuration:{point:[145,-38]}},{},async()=>{fetches++;});assert.equal(fetches,0);assert.ok(queries.some(s=>s.includes('attempts=attempts+1')));
await refreshTarget({query:async()=>[]},{id:'a'},{},async()=>{throw Error('must not fetch without lease');});
console.log('Environment tests passed: local dates, DST/offsets, missing samples, datum, malformed imports, source permissions and lease deduplication.');

assert.equal(coverageCandidates([{id:'a',point:[145,-38],waterbody:'ocean'}],[{id:'d',metadata:{bounds:[144,-39,146,-37]}}])[0].relationship,'candidate');
assert.equal(coverageCandidates([{id:'a',point:[145,-38],waterbody:'lake'}],[{id:'d',metadata:{bounds:[144,-39,146,-37]}}]).length,0);
