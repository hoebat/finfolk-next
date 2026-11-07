import clipping from 'polygon-clipping';
import {DEPTH_LAYER,LAND_COLOR} from './explore-style.js';
export const LAND_MASK='ff-coast-land-mask';
const SOURCE='ff-coast-mask',world=[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]];
export function landOutsideWater(features){
 const water=features.map(feature=>feature.geometry).filter(g=>g&&['Polygon','MultiPolygon'].includes(g.type)&&g.coordinates.length).map(g=>g.coordinates);
 const coordinates=water.length?clipping.difference(world,...water):[world];
 return {type:'FeatureCollection',features:coordinates.length?[{type:'Feature',properties:{},geometry:{type:'MultiPolygon',coordinates}}]:[]};
}
// Use the very same water polygons as the basemap, including islands and gaps.
// Unknown/unloaded areas stay masked until their coastline tiles arrive.
export function createCoastMask(map){
 const water=map.getStyle().layers.find(layer=>layer.type==='fill'&&(layer['source-layer']==='water'||layer.id==='water'));
 if(!water)return {isWater:()=>true,destroy(){}};
 const layers=map.getStyle().layers,depth=layers.findIndex(layer=>layer.id===DEPTH_LAYER),before=layers[depth+1]?.id;
 map.addSource(SOURCE,{type:'geojson',data:landOutsideWater([]),tolerance:0,buffer:64});
 map.addLayer({id:LAND_MASK,type:'fill',source:SOURCE,minzoom:9,paint:{'fill-color':LAND_COLOR,'fill-antialias':false}},before);
 let dirty=true,alive=true,timer;
 function schedule(){if(!timer)timer=setTimeout(()=>{timer=null;update();},80);}
 function update(){if(!alive||!dirty||map.getZoom()<9)return;dirty=false;try{const features=map.querySourceFeatures(water.source,water['source-layer']?{sourceLayer:water['source-layer']}:{ });map.getSource(SOURCE).setData(landOutsideWater(features));}catch{map.getSource(SOURCE).setData(landOutsideWater([]));}}
 function sourceData(event){if(event.sourceId===water.source){dirty=true;schedule();}}
 function moved(){dirty=true;schedule();}
 map.on('sourcedata',sourceData);map.on('moveend',moved);map.on('idle',update);schedule();
 return {isWater(point){return map.queryRenderedFeatures(point,{layers:[water.id]}).length>0;},destroy(){alive=false;clearTimeout(timer);map.off('sourcedata',sourceData);map.off('moveend',moved);map.off('idle',update);}};
}
