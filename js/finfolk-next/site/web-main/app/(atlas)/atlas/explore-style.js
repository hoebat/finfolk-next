import {DATASET_PROVIDER_BASE} from './dataset-release.js';
// Numeric Mapzen/Terrain Tiles data: ETOPO1 supplies global ocean bathymetry.
// Its ocean grid is ~1 arc-minute, so overscaling adds no local survey detail.
export const DEPTH_SOURCE='ff-ocean-dem';
export const DEPTH_LAYER='ff-ocean-depth';
export const COAST_DEPTH_LAYER='ff-ocean-depth-coastal';
export const LAND_COLOR='#e3e6e4';
const roadColors=new WeakMap();
export const DEPTH_STOPS=[[-11000,'#203b5e'],[-6000,'#2b4e73'],[-3000,'#426b8f'],[-1000,'#608ead'],[-200,'#83adc7'],[-50,'#a8c8db'],[-10,'#c3dce8'],[0,'#d9e8ef']];
export const DEPTH_GRADIENT='linear-gradient(90deg, '+[...DEPTH_STOPS].reverse().map(([,color])=>color).join(', ')+')';
export function addDepthShading(map){
 map.addSource(DEPTH_SOURCE,{type:'raster-dem',tiles:[DATASET_PROVIDER_BASE+'terrain/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:8,attribution:'<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles / Mapzen</a> · <a href="https://www.ncei.noaa.gov/products/etopo-global-relief-model/etopo1" target="_blank" rel="noopener">NOAA ETOPO1</a>'});
 // Keep vector labels, roads and FinFolk markers above the depth surface.
 const layers=map.getStyle().layers,water=layers.findIndex(layer=>layer.type==='fill'&&(layer['source-layer']==='water'||layer.id==='water')),before=layers[water>=0?water+1:layers.findIndex(layer=>layer.type!=='background')];
 map.addLayer({id:DEPTH_LAYER,type:'color-relief',source:DEPTH_SOURCE,maxzoom:9,paint:{'color-relief-color':['interpolate',['linear'],['elevation'],...DEPTH_STOPS.flat(),1,LAND_COLOR],'color-relief-opacity':1}},before?.id);
 // At local zooms the vector coastline masks land. Keep nonnegative DEM cells
 // at the shallow-water colour instead of magnifying their land/sea transition.
 map.addLayer({id:COAST_DEPTH_LAYER,type:'color-relief',source:DEPTH_SOURCE,minzoom:9,paint:{'color-relief-color':['interpolate',['linear'],['elevation'],...DEPTH_STOPS.flat()],'color-relief-opacity':1}},before?.id);
}
export function styleExploreMap(map,appearance){
 const coastal=appearance==='coast';
 if(!roadColors.has(map))roadColors.set(map,new Map(map.getStyle().layers.filter(layer=>layer.type==='line'&&/road|highway|motorway|transportation/.test(layer.id)).map(layer=>[layer.id,map.getPaintProperty(layer.id,'line-color')])));
 for(const layer of map.getStyle().layers){
  if([DEPTH_LAYER,COAST_DEPTH_LAYER].includes(layer.id)){map.setLayoutProperty(layer.id,'visibility',coastal?'visible':'none');continue;}
  if(layer.id.startsWith('ff-'))continue;
  if(layer.type==='background')map.setPaintProperty(layer.id,'background-color',LAND_COLOR);
  // Remove the low-zoom satellite tint; land stays neutral at every scale.
  if(layer.type==='raster')map.setLayoutProperty(layer.id,'visibility','none');
  if(layer.type==='fill')map.setPaintProperty(layer.id,'fill-color',layer['source-layer']==='water'||layer.id.toLowerCase().includes('water')?DEPTH_STOPS.at(-1)[1]:/building/.test(layer.id)?'#bfc6cb':LAND_COLOR);
  if(roadColors.get(map).has(layer.id)){const original=roadColors.get(map).get(layer.id);if(original!==undefined)map.setPaintProperty(layer.id,'line-color',coastal?(/casing|outline/.test(layer.id)?'#cbd1d0':'#f6f6ef'):original);}
  if(layer.type==='line'&&/park|waterway/.test(layer.id))map.setPaintProperty(layer.id,'line-color',/waterway/.test(layer.id)?'#93c8d1':'#c2c8cd');
  if(layer.type==='symbol'&&layer.layout?.['text-field']){
   if(/poi|housenumber/.test(layer.id))map.setLayoutProperty(layer.id,'visibility',coastal?'none':'visible');
   map.setPaintProperty(layer.id,'text-color','#48576a');map.setPaintProperty(layer.id,'text-halo-color','#edf0f1');
  }
 }
}

// Draw state borders explicitly at national zoom; the provider's default hides
// administrative level 4 until zoom 5. Reuse the dataset-hosted vector source.
export function addStateBoundaries(map){
 const style=map.getStyle(),boundary=style.layers.find(layer=>layer['source-layer']==='boundary'&&style.sources?.[layer.source]?.type==='vector');
 if(!boundary)return false;
 for(const [id,color,width] of [['ff-state-boundary-halo','#f4f5ef',4],['ff-state-boundaries','#53677f',1.6]])map.addLayer({id,type:'line',source:boundary.source,'source-layer':'boundary',minzoom:0,maxzoom:10,filter:['==',['to-number',['get','admin_level']],4],paint:{'line-color':color,'line-width':width,'line-opacity':['interpolate',['linear'],['zoom'],3,.9,8,.8,10,0]}});
 return true;
}
