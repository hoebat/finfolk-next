// Numeric Mapzen/Terrain Tiles data: ETOPO1 supplies global ocean bathymetry.
// Its ocean grid is ~1 arc-minute, so overscaling adds no local survey detail.
export const DEPTH_SOURCE='ff-ocean-dem';
export const DEPTH_LAYER='ff-ocean-depth';
export const LAND_COLOR='#d7dadd';
export const DEPTH_STOPS=[[-11000,'#182c55'],[-6000,'#223f70'],[-3000,'#2b5b91'],[-1000,'#337faf'],[-200,'#389fc0'],[-50,'#60c3cf'],[-10,'#93d9da'],[0,'#c4ece5']];
export function addDepthShading(map){
 map.addSource(DEPTH_SOURCE,{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:8,attribution:'<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles / Mapzen</a> · <a href="https://www.ncei.noaa.gov/products/etopo-global-relief-model/etopo1" target="_blank" rel="noopener">NOAA ETOPO1</a>'});
 // Keep vector labels, roads and FinFolk markers above the depth surface.
 const layers=map.getStyle().layers,water=layers.findIndex(layer=>layer.type==='fill'&&(layer['source-layer']==='water'||layer.id==='water')),before=layers[water>=0?water+1:layers.findIndex(layer=>layer.type!=='background')];
 map.addLayer({id:DEPTH_LAYER,type:'color-relief',maxzoom:10,source:DEPTH_SOURCE,paint:{'color-relief-color':['interpolate',['linear'],['elevation'],...DEPTH_STOPS.flat(),.1,LAND_COLOR],'color-relief-opacity':['interpolate',['linear'],['zoom'],8,1,10,0]}},before?.id);
}
export function styleExploreMap(map,appearance){
 const coastal=appearance==='coast';
 for(const layer of map.getStyle().layers){
  if(layer.id===DEPTH_LAYER){map.setLayoutProperty(layer.id,'visibility',coastal?'visible':'none');continue;}
  if(layer.id.startsWith('ff-'))continue;
  if(layer.type==='background')map.setPaintProperty(layer.id,'background-color',LAND_COLOR);
  // Remove the low-zoom satellite tint; land stays neutral at every scale.
  if(layer.type==='raster')map.setLayoutProperty(layer.id,'visibility','none');
  if(layer.type==='fill')map.setPaintProperty(layer.id,'fill-color',layer['source-layer']==='water'||layer.id.toLowerCase().includes('water')?'#c4ece5':/building/.test(layer.id)?'#bfc6cb':LAND_COLOR);
  if(layer.type==='line'&&/park|waterway/.test(layer.id))map.setPaintProperty(layer.id,'line-color',/waterway/.test(layer.id)?'#93c8d1':'#c2c8cd');
  if(layer.type==='symbol'&&layer.layout?.['text-field']){
   if(/poi|housenumber/.test(layer.id))map.setLayoutProperty(layer.id,'visibility',coastal?'none':'visible');
   map.setPaintProperty(layer.id,'text-color','#48576a');map.setPaintProperty(layer.id,'text-halo-color','#edf0f1');
  }
 }
}
