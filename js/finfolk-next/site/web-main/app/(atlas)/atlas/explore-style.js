import {depthTileURL} from './explore-depth-raster.js';
import {DATASET_PROVIDER_BASE} from './dataset-release.js';
// Numeric Mapzen/Terrain Tiles data: ETOPO1 supplies global ocean bathymetry.
// Its ocean grid is ~1 arc-minute, so overscaling adds no local survey detail.
export const DEPTH_SOURCE='ff-ocean-dem';
export const DEPTH_LAYER='ff-ocean-depth';
export const COAST_DEPTH_LAYER='ff-ocean-depth-coastal';
export {mapPalette,depthGradient} from './explore-palettes.js';
import {mapPalette,depthGradient} from './explore-palettes.js';
export const LAND_COLOR=mapPalette('yellow').landColor;
export const DEPTH_STOPS=mapPalette('yellow').stops;
export const DEPTH_GRADIENT=depthGradient('yellow');
const depthThemes=new WeakMap(),shieldOpacity=new WeakMap();
export function addDepthShading(map,theme){
 const palette=mapPalette(theme);depthThemes.set(map,palette.id);
 for(const [id,coastal]of [[DEPTH_SOURCE,false],[COAST_DEPTH_LAYER+'-source',true]])map.addSource(id,{type:'raster',tiles:[depthTileURL(DATASET_PROVIDER_BASE,coastal,palette.id)],tileSize:256,maxzoom:8,attribution:'<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles / Mapzen</a> · <a href="https://www.ncei.noaa.gov/products/etopo-global-relief-model/etopo1" target="_blank" rel="noopener">NOAA ETOPO1</a>'});
 // Keep vector labels, roads and FinFolk markers above the depth surface.
 const layers=map.getStyle().layers,water=layers.findIndex(layer=>layer.type==='fill'&&(layer['source-layer']==='water'||layer.id==='water')),before=layers[water>=0?water+1:layers.findIndex(layer=>layer.type!=='background')];
 map.addLayer({id:DEPTH_LAYER,type:'raster',source:DEPTH_SOURCE,maxzoom:9,paint:{'raster-resampling':'linear','raster-fade-duration':0}},before?.id);
 // At local zooms the vector coastline masks land. Keep nonnegative DEM cells
 // at the shallow-water colour instead of magnifying their land/sea transition.
 map.addLayer({id:COAST_DEPTH_LAYER,type:'raster',source:COAST_DEPTH_LAYER+'-source',minzoom:9,paint:{'raster-resampling':'linear','raster-fade-duration':0}},before?.id);
}
export function styleExploreMap(map,appearance,theme){
 const coastal=appearance==='coast',p=mapPalette(theme);
 if(!shieldOpacity.has(map))shieldOpacity.set(map,new Map(map.getStyle().layers.filter(l=>l.type==='symbol'&&/shield/.test(l.id)).map(l=>[l.id,l.paint?.['icon-opacity']??1])));
 if(depthThemes.get(map)!==p.id){
  for(const [id,local]of [[DEPTH_SOURCE,false],[COAST_DEPTH_LAYER+'-source',true]])map.getSource?.(id)?.setTiles?.([depthTileURL(DATASET_PROVIDER_BASE,local,p.id)]);
  depthThemes.set(map,p.id);
 }
 const categoryColor=['match',['get','kind'],'spot',p.pin,'business',p.business,'event',p.event,p.pin];
 const custom={
  'ff-coast-land-mask':{'fill-color':p.landColor},
  'ff-state-boundary-halo':{'line-color':p.halo},'ff-state-boundaries':{'line-color':p.boundary},
  'ff-clusters':{'circle-color':p.pin,'circle-stroke-color':p.pinBorder||p.halo},'ff-cluster-count':{'text-color':p.pinInk},
  'ff-selection':{'circle-color':p.selection},'ff-points':{'circle-color':categoryColor,'circle-stroke-color':p.pinBorder||p.halo},
  'ff-shared':{'text-color':p.pinInk},'ff-labels':{'text-color':p.label,'text-halo-color':p.halo}
 };
 for(const layer of map.getStyle().layers){
  if([DEPTH_LAYER,COAST_DEPTH_LAYER].includes(layer.id)){map.setLayoutProperty(layer.id,'visibility',coastal?'visible':'none');continue;}
  if(custom[layer.id]){for(const [key,value]of Object.entries(custom[layer.id]))map.setPaintProperty(layer.id,key,value);continue;}
  if(layer.metadata?.finfolkContourKind){const color=layer.metadata.finfolkContourKind==='regional'?p.regionalContour:p.contour;if(layer.type==='line')map.setPaintProperty(layer.id,'line-color',color);if(layer.type==='symbol'){map.setPaintProperty(layer.id,'text-color',color);map.setPaintProperty(layer.id,'text-halo-color',p.halo);}continue;}
  if(layer.id.startsWith('ff-'))continue;
  if(shieldOpacity.get(map).has(layer.id))map.setPaintProperty(layer.id,'icon-opacity',p.id==='yellow'?0:shieldOpacity.get(map).get(layer.id));
  if(layer.type==='background')map.setPaintProperty(layer.id,'background-color',p.landColor);
  if(layer.type==='raster')map.setLayoutProperty(layer.id,'visibility','none');
  if(layer.type==='fill')map.setPaintProperty(layer.id,'fill-color',layer['source-layer']==='water'||layer.id.toLowerCase().includes('water')?p.stops.at(-1)[1]:/building/.test(layer.id)?p.building:/park|landcover|landuse/.test(layer.id)?p.park:p.landColor);
  if(layer.type==='line'&&/road|highway|motorway|transportation/.test(layer.id))map.setPaintProperty(layer.id,'line-color',/casing|outline/.test(layer.id)?p.roadCasing:!coastal&&/primary|trunk|motorway/.test(layer.id)?p.roadMajor:p.road);
  if(layer.type==='line'&&/park|waterway|boundary/.test(layer.id))map.setPaintProperty(layer.id,'line-color',/waterway/.test(layer.id)?p.waterway:p.boundary);
  if(layer.type==='symbol'&&layer.layout?.['text-field']){
   if(/poi|housenumber/.test(layer.id))map.setLayoutProperty(layer.id,'visibility',coastal?'none':'visible');
   map.setPaintProperty(layer.id,'text-color',/water/.test(layer.id)?p.mutedLabel:p.label);map.setPaintProperty(layer.id,'text-halo-color',p.halo);
  }
 }
 return p;
}

// Draw state borders explicitly at national zoom; the provider's default hides
// administrative level 4 until zoom 5. Reuse the dataset-hosted vector source.
export function addStateBoundaries(map){
 const style=map.getStyle(),boundary=style.layers.find(layer=>layer['source-layer']==='boundary'&&style.sources?.[layer.source]?.type==='vector');
 if(!boundary)return false;
 for(const [id,color,width] of [['ff-state-boundary-halo','#f4f5ef',4],['ff-state-boundaries','#53677f',1.6]])map.addLayer({id,type:'line',source:boundary.source,'source-layer':'boundary',minzoom:0,maxzoom:10,filter:['==',['to-number',['get','admin_level']],4],paint:{'line-color':color,'line-width':width,'line-opacity':['interpolate',['linear'],['zoom'],3,.9,8,.8,10,0]}});
 return true;
}
