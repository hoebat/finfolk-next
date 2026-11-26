// Decode Terrarium heights before the GPU resamples the tile. Interpolating
// packed height channels magnifies texture-filter rounding at byte boundaries.
const registered=new WeakSet();
export const DEPTH_PROTOCOL='finfolk-depth';
export function depthTileURL(base,coastal=false,theme='yellow'){return base.replace(/^https:/,DEPTH_PROTOCOL+':')+'terrain/{z}/{x}/{y}.png?palette='+(coastal?'coastal':'regional')+'&theme='+encodeURIComponent(theme);}
export function colourDepthPixels(pixels,{stops,landColor,coastal}){
 const ramp=stops.map(([height,hex])=>[height,hex.match(/\w\w/g).map(v=>parseInt(v,16))]);
 if(!coastal)ramp.push([1,landColor.match(/\w\w/g).map(v=>parseInt(v,16))]);
 const output=new Uint8ClampedArray(pixels.length);
 for(let i=0;i<pixels.length;i+=4){
  const height=pixels[i]*256+pixels[i+1]+pixels[i+2]/256-32768;
  let upper=1;while(upper<ramp.length-1&&height>ramp[upper][0])upper++;
  const [lo,a]=ramp[upper-1],[hi,b]=ramp[upper],t=Math.max(0,Math.min(1,(height-lo)/(hi-lo)));
  for(let c=0;c<3;c++)output[i+c]=a[c]+(b[c]-a[c])*t;
  output[i+3]=pixels[i+3];
 }
 return output;
}
export function registerDepthRaster(lib,palette){
 if(registered.has(lib))return;registered.add(lib);
 // Reuse a bounded set of raw public DEM tiles when only the palette changes.
 const rawTiles=new Map();
 lib.addProtocol(DEPTH_PROTOCOL,async({url},controller)=>{
  const address=new URL(url.replace(DEPTH_PROTOCOL+':','https:')),coastal=address.searchParams.get('palette')==='coastal',colors=typeof palette==='function'?palette(address.searchParams.get('theme')):palette;address.search='';
  let raw=rawTiles.get(address.href);
  if(!raw){const response=await fetch(address,{signal:controller.signal});if(!response.ok)throw Error('Depth tile unavailable ('+response.status+')');raw=await response.blob();controller.signal.throwIfAborted();}
  rawTiles.delete(address.href);rawTiles.set(address.href,raw);while(rawTiles.size>48)rawTiles.delete(rawTiles.keys().next().value);
  const image=await createImageBitmap(raw,{premultiplyAlpha:'none',colorSpaceConversion:'none'});
  try{
   controller.signal.throwIfAborted();
   const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(image.width,image.height):Object.assign(document.createElement('canvas'),{width:image.width,height:image.height});
   const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
   const data=context.getImageData(0,0,image.width,image.height);data.data.set(colourDepthPixels(data.data,{...colors,coastal}));context.putImageData(data,0,0);
   const blob=canvas.convertToBlob?await canvas.convertToBlob({type:'image/png'}):await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Depth tile could not be rendered')),'image/png'));
   controller.signal.throwIfAborted();return {data:await blob.arrayBuffer()};
  }finally{image.close();}
 });
}
