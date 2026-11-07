import {createCoastMask} from './explore-coast-mask.js';
import {createContourLayers} from './explore-contours.js';
import {addDepthShading,styleExploreMap} from './explore-style.js';
import {mapPointCollection,MAP_CATEGORIES,validPoint} from './explore-model.js';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function markerImage(kind){const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const c=canvas.getContext('2d');c.strokeStyle='#fff';c.lineWidth=4;c.lineCap='round';c.lineJoin='round';c.beginPath();
 if(kind==='spot'){for(const y of [23,33,43]){c.moveTo(15,y);c.bezierCurveTo(23,y-10,31,y+10,39,y);c.bezierCurveTo(43,y-5,46,y-5,50,y);}}
 if(kind==='business'){c.rect(17,29,30,20);c.moveTo(14,29);c.lineTo(20,16);c.lineTo(44,16);c.lineTo(50,29);c.closePath();c.moveTo(28,49);c.lineTo(28,36);c.lineTo(37,36);c.lineTo(37,49);}
 if(kind==='people'){c.arc(32,23,8,0,Math.PI*2);c.moveTo(17,49);c.bezierCurveTo(17,29,47,29,47,49);}
 if(kind==='event'){c.rect(17,20,30,29);c.moveTo(17,29);c.lineTo(47,29);c.moveTo(25,15);c.lineTo(25,24);c.moveTo(39,15);c.lineTo(39,24);c.moveTo(25,37);c.lineTo(39,37);}
 c.stroke();return c.getImageData(0,0,64,64);}
export async function createExploreMap(container,{rows=[],onSelect,onMove,onStatus,onReady,onContourStatus,onContourInspect}={}){
 const imported=await import('maplibre-gl'),lib=imported.default||imported;
 let camera;try{const stored=JSON.parse(sessionStorage.getItem('finfolk:explore-camera'));if(validPoint(stored?.center)&&Number.isFinite(stored.zoom)&&stored.zoom>=3&&stored.zoom<=18)camera=stored;}catch{}
 const map=new lib.Map({container,style:'https://tiles.openfreemap.org/styles/liberty',center:camera?.center||[134,-27],zoom:camera?.zoom||3.6,minZoom:3,maxZoom:18,dragRotate:false,pitchWithRotate:false,renderWorldCopies:false,attributionControl:true});
 let ready=false,alive=true,latestRows=rows,highlight=null,appearance='coast',contours=null,coastMask=null,contourVisibility={survey:true,regional:true};
 map.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
 const timer=setTimeout(()=>{if(alive&&!ready)onStatus?.('The map is taking longer to load. You can still browse results.');},15000);
 function setRows(value){latestRows=value;if(ready){map.getSource('finfolk').setData(mapPointCollection(value));focus(highlight,{zoom:false});}}
 function style(){if(ready)styleExploreMap(map,appearance);}
 function focus(row,{zoom=true}={}){highlight=row;if(ready){map.setFilter('ff-selection',['==',['get','id'],row?latestRows.find(r=>validPoint(r.point)&&r.point.join(',')===row.point?.join(','))?.id||row.id:'']);if(row&&validPoint(row.point)&&zoom){const mobile=matchMedia('(max-width:900px)').matches,height=container.clientHeight;map.easeTo({center:row.point,zoom:Math.max(map.getZoom(),row.kind==='business'?10:13),padding:{top:130,bottom:mobile?Math.min(height*.58,Math.max(0,height-180)):45,left:40,right:40},duration:reduced()?0:650});}}}
 map.on('movestart',event=>{if(event.originalEvent)onMove?.();});
 map.on('moveend',()=>{try{sessionStorage.setItem('finfolk:explore-camera',JSON.stringify({center:map.getCenter().toArray(),zoom:map.getZoom()}));}catch{}});
 map.on('error',event=>{if(event.sourceId?.startsWith('ff-contour-'))return;if(alive)onStatus?.('Some map imagery could not load. Results remain available; try again when online.');});
 map.once('style.load',()=>{if(!alive)return;ready=true;clearTimeout(timer);addDepthShading(map);coastMask=createCoastMask(map);map.addSource('finfolk',{type:'geojson',data:mapPointCollection(latestRows),cluster:true,clusterRadius:45,clusterMaxZoom:13,clusterProperties:{entities:['+',['get','count']]}});
  const color=['match',['get','kind'],...Object.entries(MAP_CATEGORIES).flatMap(([key,v])=>[key,v.color]),'#172440'];
  map.addLayer({id:'ff-clusters',type:'circle',source:'finfolk',filter:['has','point_count'],paint:{'circle-color':'#172440','circle-radius':['step',['get','point_count'],23,20,29,100,35],'circle-stroke-color':'#fffaf0','circle-stroke-width':3}});
  map.addLayer({id:'ff-cluster-count',type:'symbol',source:'finfolk',filter:['has','point_count'],layout:{'text-field':['to-string',['get','entities']],'text-font':['Noto Sans Bold'],'text-size':13},paint:{'text-color':'#fffaf0'}});
  map.addLayer({id:'ff-selection',type:'circle',source:'finfolk',filter:['==',['get','id'],''],paint:{'circle-radius':26,'circle-color':'#172440','circle-opacity':.2}});
  map.addLayer({id:'ff-points',type:'circle',source:'finfolk',filter:['!', ['has','point_count']],paint:{'circle-color':color,'circle-radius':18,'circle-stroke-color':'#fffaf0','circle-stroke-width':3}});
  for(const kind of Object.keys(MAP_CATEGORIES))map.addImage('ff-icon-'+kind,markerImage(kind),{pixelRatio:2});
  map.addLayer({id:'ff-icons',type:'symbol',source:'finfolk',filter:['all',['!', ['has','point_count']],['==',['get','count'],1]],layout:{'icon-image':['concat','ff-icon-',['get','kind']],'icon-size':.85,'icon-allow-overlap':true}});
  map.addLayer({id:'ff-shared',type:'symbol',source:'finfolk',filter:['all',['!', ['has','point_count']],['>', ['get','count'],1]],layout:{'text-field':['to-string',['get','count']],'text-font':['Noto Sans Bold'],'text-size':13,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
  map.addLayer({id:'ff-labels',type:'symbol',source:'finfolk',minzoom:11,filter:['!', ['has','point_count']],layout:{'text-field':['get','label'],'text-font':['Noto Sans Regular'],'text-size':12,'text-anchor':'top','text-offset':[0,2],'text-max-width':13},paint:{'text-color':'#172440','text-halo-color':'#fffaf0','text-halo-width':2}});
  contours=createContourLayers(map,lib,{onStatus:onContourStatus,onInspect:onContourInspect,isWater:point=>coastMask.isWater(point)});contours.setEnabled(contourVisibility);
  style();focus(highlight,{zoom:!!highlight});onStatus?.('');onReady?.();
  map.on('click','ff-points',event=>onSelect?.(event.features[0].properties.id));
  map.on('click','ff-clusters',async event=>{const f=event.features[0];try{const zoom=await map.getSource('finfolk').getClusterExpansionZoom(f.properties.cluster_id);if(alive)map.easeTo({center:f.geometry.coordinates,zoom,duration:reduced()?0:550});}catch{if(alive)onStatus?.('Could not expand that cluster. Try zooming in.');}});
  for(const layer of ['ff-points','ff-clusters']){map.on('mouseenter',layer,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',layer,()=>map.getCanvas().style.cursor='');}
 });
 const resize=new ResizeObserver(()=>{if(alive&&container.clientWidth&&container.clientHeight){map.resize();if(highlight)focus(highlight);}});resize.observe(container);
 return {setRows,focus,style,setContours(value){contourVisibility=value;contours?.setEnabled(value);},retryContours(){contours?.retry();},setAppearance(value){appearance=value;style();},resize:()=>map.resize(),bounds:()=>map.getBounds(),showAll(points){if(!points.length)return;const bounds=new lib.LngLatBounds();points.forEach(p=>bounds.extend(p));const mobile=matchMedia('(max-width:900px)').matches;map.fitBounds(bounds,{padding:{top:140,bottom:mobile?container.clientHeight*.35:55,left:55,right:55},maxZoom:13,duration:reduced()?0:650});},reset(){map.easeTo({center:[134,-27],zoom:3.6,padding:0,duration:reduced()?0:650});},destroy(){alive=false;contours?.destroy();coastMask?.destroy();resize.disconnect();clearTimeout(timer);map.remove();}};
}
