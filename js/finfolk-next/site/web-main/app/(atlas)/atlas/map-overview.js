import {STATE_OUTLINES} from '../../../src/state-outlines.js';
// Same north-up Web Mercator projection as the main map. National context
// remains fixed so zooming never loses its place within Australia.
const width=220,height=160,padding=10,west=110,east=155,north=-9,south=-45;
const mercator=latitude=>Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,latitude))*Math.PI/360));
const scale=Math.min((width-padding*2)/(east-west),(height-padding*2)/(mercator(north)-mercator(south))*Math.PI/180);
export function overviewPoint(longitude,latitude){return [width/2+(longitude-(west+east)/2)*scale,height/2+((mercator(north)+mercator(south))/2-mercator(latitude))*180/Math.PI*scale];}
export const overviewPaths=Object.entries(STATE_OUTLINES).filter(([id])=>['ACT','NSW','NT','QLD','SA','TAS','VIC','WA','JBT'].includes(id)).map(([id,state])=>({id,path:state.rings.map(ring=>ring.map(([lon,lat],i)=>(i?'L':'M')+overviewPoint(lon,lat).map(x=>x.toFixed(2)).join(',')).join('')+'Z').join('')}));
export function overviewViewport(bounds){
 if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite))return null;
 let [w,s,e,n]=bounds;if(s>n)return null;
 while(e<w)e+=360;
 const center=(w+e)/2,shift=360*Math.round((center-134)/360);w-=shift;e-=shift;
 const [x,y]=overviewPoint(w,n),[right,bottom]=overviewPoint(e,s),[cx,cy]=overviewPoint((w+e)/2,(s+n)/2);
 return {x,y,width:right-x,height:bottom-y,cx,cy,outside:right<0||x>width||bottom<0||y>height};
}
