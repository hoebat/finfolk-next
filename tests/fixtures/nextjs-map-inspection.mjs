import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';
import {atlasCatalog} from './nextjs-atlas.mjs';
import {mockMapTools} from './nextjs-map.mjs';
export const inspectionCases=['above','no-data','error','loading','estimate','label','pin','group','group-next','group-record','group-spread','group-raster','regional','footprint'];
export async function mockMapInspection(page,base,screen){
 await mockMapTools(page,base);
 const directory={revision:'inspection',states:[],areas:[],beaches:[],sources:[]},catalog=structuredClone(atlasCatalog);catalog.regions=catalog.regions.slice(0,1);const region=catalog.regions[0];region.zoom=10;
 const feature=(depth,y=-38,id=depth)=>({type:'Feature',id:String(id).padStart(3,'0'),properties:{depth_m:depth,datum_label:'AHD',DATUM:12,survey_date:'2020',source_url:'https://example.invalid/contours'},geometry:{type:'LineString',coordinates:[[144.99,y],[145,y],[145.01,y]]}});
 const group=screen.startsWith('group'),features=group?Array.from({length:12},(_,i)=>feature(i+2)):screen==='estimate'?[feature(10,-38.003),feature(20,-37.997)]:screen==='footprint'?[]:[feature(10)];
 if(screen==='group-spread')features.forEach((feature,i)=>feature.geometry.coordinates.forEach(point=>point[0]+=i*.003));
 region.contours=features.length?{count:features.length,datum:'AHD'}:null;
 const raster=['above','no-data','error','loading','footprint','group-raster'].includes(screen),source={id:'fixture-raster',title:'Synthetic survey',datum:'AHD',survey_date:'2020',quality:'measured',resolution_m:1000,source_url:'https://example.invalid/survey',grid:{projection:'EPSG:4326',width:16,height:16,chunk_size:16,transform:[.0125,0,144.9,0,-.0125,-37.9],chunks:screen==='footprint'?{}:{'0/0':'data/inspection-cells.gz'}}};
 if(screen==='group-raster')source.data_location=[145,-38];
 if(screen==='footprint')source.bounds=[144.99,-38.01,145.01,-37.99];region.rasters=raster?[source]:[];region.status=raster?'raster':'contours';
 let selection;
 if(screen==='regional'){region.rasters=[];region.status='empty';region.contours=null;features.length=0;selection={id:'context-site',name:'Regional Coast',region:region.id,area_id:'context-area',area_name:'Context Area',state_id:'VIC',state:'VIC',waterbody:'ocean',access_mode:'shore',point:[145,-38],detail_file:'data/inspection-context.json'};directory.beaches=[selection];directory.states=[{id:'VIC',name:'VIC'}];directory.areas=[{id:'context-area',name:'Context Area',state_id:'VIC',center:[145,-38],map_region:region.id}];}
 const bytes=Buffer.alloc(16*16*4);for(let i=0;i<256;i++)bytes.writeFloatLE(screen==='above'?-3:screen==='no-data'?NaN:12,i*4);const compressed=gzipSync(bytes);
 const bodies={'beaches.json':directory,'sites-snapshot.json':directory,'data/catalog.json':catalog,'data/example-bay-contours.json':{type:'FeatureCollection',features}},values=Object.fromEntries(Object.entries(bodies).map(([path,value])=>[path,Buffer.from(JSON.stringify(value))]));if(selection){bodies[selection.detail_file]={beaches:[selection],stays:[],surveys:[],context_contours:[{...feature(25,-38.003),properties:{depth_m:25,coverage_class:'regional-context',datum_label:'Model reference',source_name:'Regional model',source_url:'https://example.invalid/model'}}],context_source:{metadata_url:'https://example.invalid/model'}};values[selection.detail_file]=Buffer.from(JSON.stringify(bodies[selection.detail_file]));}values['data/inspection-cells.gz']=compressed;
 const files=Object.fromEntries(Object.entries(values).map(([path,body])=>[path,{hash:createHash('sha256').update(body).digest('hex'),bytes:body.length,label:path}]));
 for(const [path,json]of Object.entries(bodies))await page.route('**/'+path+'*',route=>route.fulfill({json}));await page.route('**/v1/sites/catalog*',route=>route.fulfill({json:directory}));
 await page.route('**/data/downloads.json*',route=>route.fulfill({json:{version:1,revision:'inspection-'+screen,files,regions:{}}}));
 let release,requestedResolve;const held=new Promise(resolve=>release=resolve),requestStarted=new Promise(resolve=>requestedResolve=resolve);let requested=false;
 await page.route('**/data/inspection-cells.gz*',async route=>{requested=true;requestedResolve();if(screen==='loading')await held;if(screen==='error')return route.fulfill({status:503,body:'Synthetic survey unavailable'});return route.fulfill({body:compressed,contentType:'application/octet-stream'});});
 return {selection,status:region.status==='empty'?'No depth data published yet':raster?'1 raster source available':features.length+' published contours',release,requestStarted,requested:()=>requested,point:screen==='regional'?[145.002,-38.003]:raster&&screen!=='footprint'&&screen!=='group-raster'?[145.04,-38.04]:[145,-38],pins:['pin','footprint'].includes(screen)||group};
}
