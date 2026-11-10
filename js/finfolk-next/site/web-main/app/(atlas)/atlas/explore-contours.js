import {LAND_MASK} from './explore-coast-mask.js';
import {DATASET_RELEASE_BASE} from './dataset-release.js';
const prefix='ff-contour-';
const multiple=n=>['==',['%',['get','depth_m'],n],0];
export const contourFilter=['step',['zoom'],multiple(10),13,multiple(5),16,multiple(2)];
const labelFilter=['step',['zoom'],multiple(10),16,multiple(5)];
export const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const text=(tag,value)=>{const element=document.createElement(tag);element.textContent=value;return element;};
function sourceCard(properties,meta={}){
 const native=properties.derivation==='native-grid iso-elevation contour';
 const card=document.createElement('div');card.className='fm-contour-card';card.append(text('strong',properties.depth_m+(native?' m below source reference':' m contour')),text('p',native?'Native survey elevation contour · vertical review pending':properties.kind==='regional'?'Regional model · '+(meta.resolution_m||250)+' m grid':'Published survey contour'),text('p',properties.source_title),text('p','Datum: '+properties.datum));if(properties.survey_date)card.append(text('p',properties.survey_date));
 card.append(text('small',native?'Source reference elevation; not a tide-adjusted water depth.':'The line carries a source depth, not a measured depth at your click.'));
 if(properties.source_url){try{const url=new URL(properties.source_url);if(url.protocol==='https:'||url.protocol==='http:'){const link=text('a','Source, licence & limits ↗');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}}catch{}}
 if(meta.limitation)card.append(text('small',meta.limitation));
 if(properties.licence)card.append(text('small',properties.licence));
 if(properties.attribution)card.append(text('small',properties.attribution));return card;
}
// Sources are attached only around the viewport. MapLibre owns tile requests,
// cancellation and overscaling; full survey GeoJSON never enters the browser.
export function createContourLayers(map,lib,{onStatus=()=>{},onInspect=()=>{},isWater=()=>true,fetcher=fetch}={}){
 let alive=true,manifest=null,loading=false,enabled={survey:true,regional:true},popup=null,failed=false;const active=new Map();
 function remove(id){for(const suffix of ['labels','line','hit'])if(map.getLayer(id+'-'+suffix))map.removeLayer(id+'-'+suffix);if(map.getSource(id))map.removeSource(id);active.delete(id);}
 function sync(){if(!alive||!manifest)return;const b=map.getBounds(),bounds=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()],zoom=map.getZoom(),wanted=manifest.sources.filter(s=>enabled[s.kind]&&zoom>=s.minzoom&&(s.kind!=='regional'||zoom<12)&&intersects(s.bounds,bounds)),ids=new Set(wanted.map(s=>prefix+s.id));
  for(const id of active.keys())if(!ids.has(id))remove(id);
  for(const s of wanted){const id=prefix+s.id;if(active.has(id))continue;const before=map.getLayer(LAND_MASK)?LAND_MASK:map.getLayer('ff-clusters')?'ff-clusters':undefined;
   map.addSource(id,{type:'vector',tiles:s.tiles.map(path=>new URL(path.replace(/^\//,''),DATASET_RELEASE_BASE).href.replaceAll('%7B','{').replaceAll('%7D','}')),minzoom:s.minzoom,maxzoom:s.maxzoom,bounds:s.bounds,attribution:s.attribution.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))});
   const base={source:id,'source-layer':'contours',minzoom:s.minzoom,filter:contourFilter,layout:{'line-join':'round','line-cap':'round'}},color=s.kind==='regional'?'#557d91':'#173f61';
   map.addLayer({...base,id:id+'-hit',type:'line',paint:{'line-width':14,'line-opacity':0}},before);
   map.addLayer({...base,id:id+'-line',type:'line',paint:{'line-color':color,'line-opacity':s.kind==='regional'?.45:['case',multiple(10),.7,.35],'line-width':['interpolate',['linear'],['zoom'],10,.55,16,1],...(s.kind==='regional'?{'line-dasharray':[3,3]}:{})}},before);
   map.addLayer({...base,id:id+'-labels',type:'symbol',filter:labelFilter,minzoom:Math.max(11,s.minzoom),layout:{'symbol-placement':'line','symbol-spacing':400,'text-field':['concat',['to-string',['get','depth_m']],s.archive_release?' m ref':' m'],'text-font':['Noto Sans Regular'],'text-size':11,'text-max-angle':35,'text-padding':24},paint:{'text-color':color,'text-halo-color':'#edf7f6','text-halo-width':1.5}},before);active.set(id,s);
  }
  // Regional context stays underneath published surveys, regardless of pan order.
  for(const kind of ['regional','survey'])for(const [id,s]of active)if(s.kind===kind)for(const suffix of ['hit','line','labels'])map.moveLayer(id+'-'+suffix,map.getLayer(LAND_MASK)?LAND_MASK:map.getLayer('ff-clusters')?'ff-clusters':undefined);
  if(!failed)onStatus(zoom<9?'Zoom in to see depth contours.':wanted.length?`${wanted.filter(s=>s.kind==='survey').length} published survey sources · ${wanted.filter(s=>s.kind==='regional').length} regional sources in view`:'No published contours in this view.');
 }
 async function load(){if(loading||!alive)return;loading=true;failed=false;onStatus('Loading contour catalogue…');try{const response=await fetcher(new URL('data/explore-contours/manifest.json',DATASET_RELEASE_BASE).href,{cache:'no-cache'});if(!response.ok)throw Error('Contour catalogue unavailable');const value=await response.json();if(value.version!==1||!Array.isArray(value.sources))throw Error('Unsupported contour catalogue');if(!alive)return;manifest=value;sync();}catch{if(alive){failed=true;onStatus('Contours couldn’t load. Retry contour data.');}}finally{loading=false;}}
 function click(event){if(!isWater(event.point))return;const layers=[...active.keys()].map(id=>id+'-hit');if(!layers.length)return;if(map.getLayer('ff-points')&&map.queryRenderedFeatures(event.point,{layers:['ff-points','ff-clusters']}).length)return;const feature=map.queryRenderedFeatures(event.point,{layers})[0];if(!feature)return;onInspect();popup?.remove();popup=new lib.Popup({maxWidth:'290px',closeButton:true}).setLngLat(event.lngLat).setDOMContent(sourceCard(feature.properties,active.get(feature.source))).addTo(map);}
 function error(event){if(alive&&event.sourceId?.startsWith(prefix)){failed=true;onStatus('Some contour tiles couldn’t load. Retry contour data.');}}
 map.on('moveend',sync);map.on('click',click);map.on('error',error);load();
 return {setEnabled(value){enabled={...enabled,...value};popup?.remove();sync();},retry(){for(const id of [...active.keys()])remove(id);return load();},destroy(){alive=false;map.off('moveend',sync);map.off('click',click);map.off('error',error);popup?.remove();}};
}
