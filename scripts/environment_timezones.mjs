// Review timezone corrections as site documents; publish through existing site drafts.
import {readFile} from 'node:fs/promises';
import {find} from 'geo-tz';
const catalog=JSON.parse(await readFile(process.argv[2],'utf8'));
console.log(JSON.stringify((catalog.beaches||catalog).map(site=>{const zones=find(site.point[1],site.point[0]);return {id:site.id,oldTimezone:site.timezone,candidates:zones,site:{...site,...(zones.length===1&&!site.timezone_provenance?{timezone:zones[0],timezone_provenance:'geo-tz-8.1.11'}:{})},requiresReview:zones.length!==1||!!site.timezone_provenance};}),null,2));
