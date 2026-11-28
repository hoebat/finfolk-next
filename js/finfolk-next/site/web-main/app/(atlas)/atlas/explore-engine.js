import {DATASET_PROVIDER_BASE} from './dataset-release.js';
import {createCoastMask} from './explore-coast-mask.js';
import {createContourLayers} from './explore-contours.js';
import {addDepthShading,styleExploreMap,addStateBoundaries,mapPalette} from './explore-style.js';
import {mapPointCollection,mapGeographyGroups,MAP_CATEGORIES,validPoint} from './explore-model.js';
import {registerDepthRaster} from './explore-depth-raster.js';
import {clusterRegionMarkers} from './geography-markers.js';
let tooltipSequence=0;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function markerImage(kind,color){const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const c=canvas.getContext('2d');c.strokeStyle=color;c.lineWidth=4;c.lineCap='round';c.lineJoin='round';c.beginPath();
 if(kind==='spot'){for(const y of [23,33,43]){c.moveTo(15,y);c.bezierCurveTo(23,y-10,31,y+10,39,y);c.bezierCurveTo(43,y-5,46,y-5,50,y);}}
 if(kind==='business'){c.rect(17,29,30,20);c.moveTo(14,29);c.lineTo(20,16);c.lineTo(44,16);c.lineTo(50,29);c.closePath();c.moveTo(28,49);c.lineTo(28,36);c.lineTo(37,36);c.lineTo(37,49);}
 if(kind==='event'){c.rect(17,20,30,29);c.moveTo(17,29);c.lineTo(47,29);c.moveTo(25,15);c.lineTo(25,24);c.moveTo(39,15);c.lineTo(39,24);c.moveTo(25,37);c.lineTo(39,37);}
 c.stroke();return c.getImageData(0,0,64,64);}
export async function createExploreMap(container,{rows=[],onSelect,onViewport,onCamera,onStatus,onReady,onContourStatus,onContourInspect}={}){
 const imported=await import('maplibre-gl'),lib=imported.default||imported;
 registerDepthRaster(lib,mapPalette);
 let camera;try{const stored=JSON.parse(sessionStorage.getItem('finfolk:explore-camera'));if(validPoint(stored?.center)&&Number.isFinite(stored.zoom)&&stored.zoom>=3&&stored.zoom<=18)camera=stored;}catch{}
 const map=new lib.Map({container,style:DATASET_PROVIDER_BASE+'openfreemap/styles/liberty',center:camera?.center||[134,-27],zoom:camera?.zoom||3.6,minZoom:3,maxZoom:18,dragRotate:false,pitchWithRotate:false,renderWorldCopies:false,attributionControl:false});
 map.addControl(new lib.AttributionControl(),'bottom-left');
 let ready=false,alive=true,latestRows=rows,highlight=null,appearance='coast',contours=null,coastMask=null,contourVisibility={survey:true,regional:true};
 const siteTooltip=new lib.Popup({closeButton:false,closeOnClick:false,focusAfterOpen:false,offset:24,maxWidth:'260px',className:'fm-site-tooltip'});
 const tooltipDOMID='ff-map-tooltip-'+ ++tooltipSequence;let tooltipID=null,tooltipTrigger=null;
 function hideSiteTooltip(){tooltipID=null;tooltipTrigger?.removeAttribute('aria-describedby');tooltipTrigger=null;siteTooltip.remove();}
 function showTooltip(id,point,{title,summary,names=[],hint},trigger=null){
  if(tooltipID===id&&siteTooltip.isOpen())return;
  if(tooltipID!==id){hideSiteTooltip();tooltipID=id;}
  const content=document.createElement('div');content.id=tooltipDOMID;content.setAttribute('role','tooltip');
  const heading=document.createElement('strong');heading.textContent=title;content.append(heading);
  if(summary){const text=document.createElement('p');text.textContent=summary;content.append(text);}
  if(names.length){const list=document.createElement('ul');for(const name of names){const item=document.createElement('li');item.textContent=name;list.append(item);}content.append(list);}
  if(hint){const text=document.createElement('small');text.textContent=hint;content.append(text);}
  tooltipTrigger=trigger;trigger?.setAttribute('aria-describedby',tooltipDOMID);siteTooltip.setDOMContent(content).setLngLat(point).addTo(map);
 }
 function placeSummary(rows,total,title='Nearby places'){
  const names=rows.slice(0,5).map(row=>row.name),remaining=Math.max(0,total-names.length);
  return {title,summary:total.toLocaleString('en-AU')+' '+(total===1?'place':'places'),names,hint:(remaining?remaining.toLocaleString('en-AU')+' more · ':'')+'Select to explore'};
 }
 function showSiteTooltip(event){
  if(!matchMedia('(hover:hover)').matches||map.isMoving())return hideSiteTooltip();
  const feature=event.features?.[0],row=latestRows.find(item=>item.id===feature?.properties?.id);
  if(!row||!validPoint(row.point))return hideSiteTooltip();
  const atLocation=latestRows.filter(item=>validPoint(item.point)&&item.point.join(',')===row.point.join(','));
  if(atLocation.length>1)showTooltip(row.id,row.point,placeSummary(atLocation,atLocation.length,'At this location'));
  else if(row.kind==='spot')showTooltip(row.id,row.point,{title:row.name,summary:row.area});else hideSiteTooltip();
 }
 async function showClusterTooltip(event){
  if(!matchMedia('(hover:hover)').matches||map.isMoving())return hideSiteTooltip();
  const feature=event.features?.[0];if(!feature)return;const id='cluster:'+feature.properties.cluster_id;if(tooltipID===id)return;
  hideSiteTooltip();tooltipID=id;
  try{const leaves=await map.getSource('finfolk').getClusterLeaves(feature.properties.cluster_id,5,0);if(!alive||tooltipID!==id)return;
   const points=new Set(leaves.map(leaf=>leaf.geometry.coordinates.join(','))),places=latestRows.filter(row=>validPoint(row.point)&&points.has(row.point.join(',')));
   showTooltip(id,feature.geometry.coordinates,placeSummary(places,Number(feature.properties.entities||feature.properties.point_count)));
  }catch{if(tooltipID===id)hideSiteTooltip();}
 }
 function showGeographyTooltip(group,level,button){
  if(map.isMoving())return;
  if(group.locations?.length>1){const model=placeSummary(group.sites||[],group.count,'Dive spots nearby');model.summary=group.count.toLocaleString('en-AU')+' dive spots across '+group.locations.length+' areas';if(!model.names.length)model.names=group.locations.map(location=>location.name).slice(0,5);showTooltip('area:'+group.id,group.point,model,button);}
  else showTooltip('area:'+group.id,group.point,{title:group.name,summary:group.count.toLocaleString('en-AU')+' '+(group.count===1?'dive spot':'dive spots'),hint:'Select to explore '+(level==='state'?'this state':'this area')},button);
 }
 map.on('movestart',hideSiteTooltip);map.on('click',hideSiteTooltip);
 const dismissTooltip=event=>{if(event.key==='Escape')hideSiteTooltip();};window.addEventListener('keydown',dismissTooltip);

 const timer=setTimeout(()=>{if(alive&&!ready)onStatus?.('The map is taking longer to load. You can still browse results.');},15000);
 let geographyMarkers=[],geographyKey='';
 function updateGeography(){
  if(!ready)return;
  const zoom=map.getZoom(),level=zoom<5.2?'state':zoom<8?'region':null,allGroups=level?mapGeographyGroups(latestRows,level):[],groups=level==='region'?clusterRegionMarkers(allGroups,point=>map.project(point),{width:container.clientWidth,height:container.clientHeight}):allGroups,summarized=allGroups.length>0;
  for(const id of ['ff-clusters','ff-cluster-count','ff-points','ff-icons','ff-shared','ff-labels'])map.setLayoutProperty(id,'visibility',summarized?'none':'visible');
  const key=JSON.stringify([level,groups.map(g=>[g.id,g.name,g.count,g.point,g.points,g.sites])]);if(key===geographyKey)return;geographyKey=key;
  hideSiteTooltip();geographyMarkers.forEach(marker=>marker.remove());geographyMarkers=[];
  for(const group of groups){const button=document.createElement('button');button.type='button';button.className='fm-geography';button.dataset.level=level;button.dataset.group=group.id;button.setAttribute('aria-label',`${group.name}: ${group.count} dive spots. Zoom in`);
   const count=document.createElement('strong'),label=document.createElement('span');count.textContent=group.count.toLocaleString('en-AU');label.textContent=group.name;button.append(count,label);button.addEventListener('mouseenter',()=>{if(matchMedia('(hover:hover)').matches)showGeographyTooltip(group,level,button);});button.addEventListener('focus',()=>showGeographyTooltip(group,level,button));button.addEventListener('mouseleave',hideSiteTooltip);button.addEventListener('blur',hideSiteTooltip);
   button.addEventListener('click',event=>{event.stopPropagation();hideSiteTooltip();const bounds=new lib.LngLatBounds();group.points.forEach(point=>bounds.extend(point));const targetZoom=level==='state'?7:11,single=group.points.every(point=>point[0]===group.points[0][0]&&point[1]===group.points[0][1]),camera=single?{center:group.points[0],zoom:targetZoom}:map.cameraForBounds(bounds,{padding:65,maxZoom:targetZoom});if(camera)map.easeTo({...camera,zoom:Math.max(level==='state'?5.3:8.2,camera.zoom),padding:0,duration:reduced()?0:650});});
   const host=document.createElement('div');host.append(button);geographyMarkers.push(new lib.Marker({element:host}).setLngLat(group.point).addTo(map));
  }
 }
 function setRows(value){hideSiteTooltip();latestRows=value;if(ready){map.getSource('finfolk').setData(mapPointCollection(value));focus(highlight,{zoom:false});updateGeography();}}
 let iconTheme=null;
 function style(){if(!ready)return;const palette=styleExploreMap(map,appearance);if(container.dataset.mapTheme!==palette.id)delete container.dataset.mapDepthTheme;container.dataset.mapTheme=palette.id;if(iconTheme!==palette.id){for(const kind of Object.keys(MAP_CATEGORIES))if(map.hasImage('ff-icon-'+kind))map.updateImage('ff-icon-'+kind,markerImage(kind,palette.pinInk));iconTheme=palette.id;}}
 function focus(row,{zoom=true}={}){highlight=row;if(ready){map.setFilter('ff-selection',['==',['get','id'],row?latestRows.find(r=>validPoint(r.point)&&r.point.join(',')===row.point?.join(','))?.id||row.id:'']);if(row&&validPoint(row.point)&&zoom){const mobile=matchMedia('(max-width:900px)').matches,height=container.clientHeight;map.easeTo({center:row.point,zoom:Math.max(map.getZoom(),row.kind==='business'?10:13),padding:{top:130,bottom:mobile?Math.min(height*.58,Math.max(0,height-180)):45,left:40,right:40},duration:reduced()?0:650});}}}
 let overviewFrame=0;
 function publishCamera(){if(!onCamera||overviewFrame||!alive)return;overviewFrame=requestAnimationFrame(()=>{overviewFrame=0;if(!alive)return;const b=map.getBounds();onCamera([b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]);});}
 map.on('move',publishCamera);map.on('resize',publishCamera);publishCamera();
 map.on('zoomend',updateGeography);
 map.on('moveend',()=>{updateGeography();if(ready)onViewport?.(map.getBounds());try{sessionStorage.setItem('finfolk:explore-camera',JSON.stringify({center:map.getCenter().toArray(),zoom:map.getZoom()}));}catch{}});
 map.on('error',event=>{if(event.sourceId?.startsWith('ff-contour-'))return;if(alive)onStatus?.('Some map imagery could not load. Results remain available; try again when online.');});
 map.once('style.load',()=>{if(!alive)return;ready=true;clearTimeout(timer);addDepthShading(map);coastMask=createCoastMask(map);map.addSource('finfolk',{type:'geojson',data:mapPointCollection(latestRows),cluster:true,clusterRadius:45,clusterMaxZoom:13,clusterProperties:{entities:['+',['get','count']]}});
  const color=['match',['get','kind'],...Object.entries(MAP_CATEGORIES).flatMap(([key,v])=>[key,v.color]),'#172440'];
  map.addLayer({id:'ff-clusters',type:'circle',source:'finfolk',filter:['has','point_count'],paint:{'circle-color':'#172440','circle-radius':['step',['get','point_count'],23,20,29,100,35],'circle-stroke-color':'#fffaf0','circle-stroke-width':3}});
  map.addLayer({id:'ff-cluster-count',type:'symbol',source:'finfolk',filter:['has','point_count'],layout:{'text-field':['to-string',['get','entities']],'text-font':['Noto Sans Bold'],'text-size':13},paint:{'text-color':'#fffaf0'}});
  map.addLayer({id:'ff-selection',type:'circle',source:'finfolk',filter:['==',['get','id'],''],paint:{'circle-radius':26,'circle-color':'#172440','circle-opacity':.2}});
  map.addLayer({id:'ff-points',type:'circle',source:'finfolk',filter:['!', ['has','point_count']],paint:{'circle-color':color,'circle-radius':18,'circle-stroke-color':'#fffaf0','circle-stroke-width':3}});
  for(const kind of Object.keys(MAP_CATEGORIES))map.addImage('ff-icon-'+kind,markerImage(kind,mapPalette().pinInk),{pixelRatio:2});
  map.addLayer({id:'ff-icons',type:'symbol',source:'finfolk',filter:['all',['!', ['has','point_count']],['==',['get','count'],1]],layout:{'icon-image':['concat','ff-icon-',['get','kind']],'icon-size':.85,'icon-allow-overlap':true}});
  map.addLayer({id:'ff-shared',type:'symbol',source:'finfolk',filter:['all',['!', ['has','point_count']],['>', ['get','count'],1]],layout:{'text-field':['to-string',['get','count']],'text-font':['Noto Sans Bold'],'text-size':13,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
  map.addLayer({id:'ff-labels',type:'symbol',source:'finfolk',minzoom:11,filter:['!', ['has','point_count']],layout:{'text-field':['get','label'],'text-font':['Noto Sans Regular'],'text-size':12,'text-anchor':'top','text-offset':[0,2],'text-max-width':13},paint:{'text-color':'#172440','text-halo-color':'#fffaf0','text-halo-width':2}});
  addStateBoundaries(map);
  map.on('idle',()=>{if(map.isSourceLoaded('ff-ocean-dem')&&map.isSourceLoaded('ff-ocean-depth-coastal-source'))container.dataset.mapDepthTheme=mapPalette().id;container.dataset.stateBoundaryFeatures=String(map.getLayer('ff-state-boundaries')?map.queryRenderedFeatures({layers:['ff-state-boundaries']}).length:0);});
  contours=createContourLayers(map,lib,{onStatus:onContourStatus,onInspect:onContourInspect,isWater:point=>coastMask.isWater(point)});contours.setEnabled(contourVisibility);
  style();updateGeography();focus(highlight,{zoom:!!highlight});onViewport?.(map.getBounds());onStatus?.('');onReady?.();
  map.on('mouseenter','ff-clusters',showClusterTooltip);map.on('mouseleave','ff-clusters',hideSiteTooltip);
  map.on('mousemove','ff-points',showSiteTooltip);map.on('mouseleave','ff-points',hideSiteTooltip);
  map.on('click','ff-points',event=>onSelect?.(event.features[0].properties.id));
  map.on('click','ff-clusters',async event=>{const f=event.features[0];try{const zoom=await map.getSource('finfolk').getClusterExpansionZoom(f.properties.cluster_id);if(alive)map.easeTo({center:f.geometry.coordinates,zoom,duration:reduced()?0:550});}catch{if(alive)onStatus?.('Could not expand that cluster. Try zooming in.');}});
  for(const layer of ['ff-points','ff-clusters']){map.on('mouseenter',layer,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',layer,()=>map.getCanvas().style.cursor='');}
 });
 const resize=new ResizeObserver(()=>{if(alive&&container.clientWidth&&container.clientHeight){map.resize();updateGeography();if(highlight)focus(highlight);}});resize.observe(container);
 return {setRows,focus,style,zoomIn(){map.zoomIn({duration:reduced()?0:300});},zoomOut(){map.zoomOut({duration:reduced()?0:300});},setContours(value){contourVisibility=value;contours?.setEnabled(value);},retryContours(){contours?.retry();},setAppearance(value){appearance=value;style();},resize:()=>map.resize(),bounds:()=>map.getBounds(),showAll(points){if(!points.length)return;const bounds=new lib.LngLatBounds();points.forEach(p=>bounds.extend(p));const mobile=matchMedia('(max-width:900px)').matches;map.fitBounds(bounds,{padding:{top:140,bottom:mobile?container.clientHeight*.35:55,left:55,right:55},maxZoom:13,duration:reduced()?0:650});},reset(){map.easeTo({center:[134,-27],zoom:3.6,padding:0,duration:reduced()?0:650});},destroy(){alive=false;hideSiteTooltip();window.removeEventListener('keydown',dismissTooltip);cancelAnimationFrame(overviewFrame);geographyMarkers.forEach(marker=>marker.remove());contours?.destroy();coastMask?.destroy();resize.disconnect();clearTimeout(timer);map.remove();}};
}
