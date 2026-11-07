import {createHash} from 'node:crypto';
import {mockPlace,placeBeaches} from './nextjs-place.mjs';
import {mapDataset} from './nextjs-map.mjs';
const make=(id,name,extra={})=>({...structuredClone(placeBeaches.beaches[0]),id,name,area_id:'coverage-area',area_name:'Coverage Coast',detail_file:'data/coverage-'+id+'.json',region:'example-bay',...extra});
export const coverageSites=[
 make('boat','Offshore Reef',{access_mode:'boat_only',access_points:[{name:'Harbour departure',mode:'boat_departure',point:[145.01,-38.01],source_url:'https://example.invalid/departure'}]}),
 make('quarry','Freshwater Quarry',{waterbody:'quarry',point:[145.5,-38.5],access_points:[]}),
 make('unsurveyed','Unsurveyed Cove',{region:'site-unsurveyed',point:[146,-39],access_points:[]}),
 make('context','Regional Coast',{region:'regional-empty',point:[146.5,-39.5],access_points:[]}),
 make('far','Distant Beach',{point:[145.2,-38.2],access_points:[]}),
];
const directory={...structuredClone(placeBeaches),areas:[{id:'coverage-area',name:'Coverage Coast',state_id:'VIC',center:[145,-38],map_region:'example-bay'}],beaches:coverageSites};
const catalog=structuredClone(mapDataset.catalog);catalog.regions.push({...structuredClone(catalog.regions[1]),id:'regional-empty',name:'Regional context only',rasters:[],status:'empty',contours:null,contour_file:null});
const contextFeature={type:'Feature',properties:{depth_m:25,datum_label:'Model reference',source_name:'Regional model',coverage_class:'regional-context',source_url:'https://example.invalid/model'},geometry:{type:'LineString',coordinates:[[144.9,-38.001],[145.1,-38.001]]}};
const detail={beaches:coverageSites,stays:[],surveys:[],context_contours:[contextFeature],context_source:{metadata_url:'https://example.invalid/model'},coastline:[[[144.9,-37.999],[145.1,-37.999]]]};
export async function mockMapCoverage(page,base){
 await mockPlace(page,base);
 const bodies={'beaches.json':directory,'sites-snapshot.json':directory,'data/catalog.json':catalog,'social.json':{posts:[]},'data/beach-summaries.json':{beaches:[]}};
 for(const site of coverageSites){const [x,y]=site.point;bodies[site.detail_file]={...detail,context_contours:[{...contextFeature,geometry:{type:'LineString',coordinates:[[x-.1,y-.001],[x+.1,y-.001]]}}],coastline:[[[x-.1,y+.001],[x+.1,y+.001]]]};}
 const files={...mapDataset.files,...Object.fromEntries(Object.entries(bodies).map(([path,value])=>{const body=JSON.stringify(value);return[path,{hash:createHash('sha256').update(body).digest('hex'),bytes:Buffer.byteLength(body),label:path}]}))};
 for(const [path,json]of Object.entries(bodies))await page.route('**/'+path+'*',route=>route.fulfill({json}));
 await page.route('**/v1/sites/catalog*',route=>route.fulfill({json:directory}));
 await page.route('**/data/downloads.json*',route=>route.fulfill({json:{version:1,revision:'coverage',files,regions:{}}}));
 await page.route('**/instagram/posts?*',route=>route.fulfill({json:{posts:[],cursor:null}}));
 await page.route('**/trips?*',route=>route.fulfill({json:{trips:[]}}));
 await page.route('**/community/posts?*',route=>route.fulfill({json:{enabled:true,posts:[],cursor:null}}));
}
