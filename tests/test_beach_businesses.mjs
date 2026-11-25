import assert from 'node:assert/strict';
import {businessesAtBeach,directoryLocation} from '../js/finfolk-next/site/web-main/app/(atlas)/atlas/place-directory-model.js';
const beach={name:'Addiscot Beach',state_id:'VIC',state:'Victoria'},rows=[{id:'unrelated',locality:'Bondi',state:'NSW'},{id:'local',locality:'Addiscot Beach',state:'VIC'},{id:'other-state',locality:'Addiscot',state:'WA'},{id:'regional',locality:'Torquay',state:'VIC'},{id:'multi',locality:'Torquay; Addiscot',state:'Victoria'},{id:'overseas',locality:'Addiscot',state:'VIC',country:'New Zealand'}];
assert.deepEqual(businessesAtBeach(rows,beach).map(row=>row.id),['local','multi']);
assert.deepEqual(businessesAtBeach(rows.slice(0,1),beach),[]);
assert.deepEqual(directoryLocation({...beach,locality:'Torquay'}),{state:'VIC',locality:'Addiscot'});
console.log('BEACH_BUSINESSES_PASS: exact beach and state matches only, unrelated and regional listings omitted.');
