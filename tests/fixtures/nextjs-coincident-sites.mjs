import {createHash} from 'node:crypto';
import {mockPlace,placeBeaches,detail} from './nextjs-place.mjs';
import {mapDataset} from './nextjs-map.mjs';
export const coincidentDirectory=structuredClone(placeBeaches);
const point=coincidentDirectory.beaches[0].point;
for(const beach of coincidentDirectory.beaches){beach.point=[...point];beach.access_points=beach.access_points.map(access=>({...access,point:[...point]}));}
const bodies={'beaches.json':coincidentDirectory,'sites-snapshot.json':coincidentDirectory,'data/example-place.json':{...detail,beaches:coincidentDirectory.beaches,stays:[],surveys:[]},'data/beach-summaries.json':{beaches:[]},'social.json':{posts:[]}};
export async function mockCoincidentSites(page,base){
 await mockPlace(page,base);
 for(const [path,json] of Object.entries(bodies))await page.route('**/'+path+'*',route=>route.fulfill({json}));
 await page.route('**/v1/sites/catalog*',route=>route.fulfill({json:coincidentDirectory}));
 const files={...mapDataset.files,...Object.fromEntries(Object.entries(bodies).map(([path,value])=>{const body=JSON.stringify(value);return [path,{hash:createHash('sha256').update(body).digest('hex'),bytes:Buffer.byteLength(body),label:path}];}))};
 await page.route('**/data/downloads.json*',route=>route.fulfill({json:{version:1,revision:'coincident-sites',files,regions:{}}}));
 await page.route('**/instagram/posts?*',route=>route.fulfill({json:{posts:[],cursor:null}}));
 await page.route('**/trips?*',route=>route.fulfill({json:{trips:[]}}));
 await page.route('**/community/posts?*',route=>route.fulfill({json:{enabled:true,posts:[],cursor:null}}));
}
