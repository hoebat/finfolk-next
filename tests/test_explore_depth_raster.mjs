import assert from 'node:assert/strict';
import {colourDepthPixels,depthTileURL,registerDepthRaster} from '../js/finfolk-next/site/web-main/app/(atlas)/atlas/explore-depth-raster.js';
import {DEPTH_STOPS,LAND_COLOR} from '../js/finfolk-next/site/web-main/app/(atlas)/atlas/explore-style.js';
const palette={stops:DEPTH_STOPS,landColor:LAND_COLOR},rgb=hex=>hex.match(/\w\w/g).map(v=>parseInt(v,16));
const pack=height=>{const n=Math.round((height+32768)*256);return [(n>>16)&255,(n>>8)&255,n&255,255]};
for(const [height,color]of DEPTH_STOPS){const result=colourDepthPixels(pack(height),{...palette,coastal:true});assert.deepEqual([...result],[...rgb(color),255]);}
assert.deepEqual([...colourDepthPixels(pack(100),{...palette,coastal:true})],[...rgb(DEPTH_STOPS.at(-1)[1]),255]);assert.deepEqual([...colourDepthPixels(pack(100),{...palette,coastal:false})],[...rgb(LAND_COLOR),255]);
// This byte carry occurs at sea level in Terrarium tiles. Limited-precision
// filtering of the encoded red/green channels creates repeated false slopes.
const a=pack(-1),b=pack(1),heights=Array.from({length:1025},(_,n)=>{const t=n/1024,c=a.map((v,i)=>Math.round((v+(b[i]-v)*t)*256)/256);return c[0]*256+c[1]+c[2]/256-32768});assert(heights.some((v,i)=>i&&v<heights[i-1]),'Fixture must expose packed-channel filtering ripples');
const tile=colourDepthPixels(new Uint8ClampedArray([...a,...b]),{...palette,coastal:true});for(let c=0;c<3;c++)assert(Math.abs(tile[c]-tile[4+c])<=3,'Decoded colours remain close across the sea-level byte carry');
const original=new Uint8ClampedArray(a);colourDepthPixels(original,{...palette,coastal:true});assert.deepEqual([...original],a);let registrations=0;const lib={addProtocol(name,handler){assert.equal(name,'finfolk-depth');assert.equal(typeof handler,'function');registrations++}};registerDepthRaster(lib,palette);registerDepthRaster(lib,palette);assert.equal(registrations,1);assert.equal(new URL(depthTileURL('https://datasets.finfolk.com.au/v1/map/providers/',true)).searchParams.get('palette'),'coastal');
console.log('DEPTH_RASTER_PASS: Terrarium decoding, all depth stops, coastal land clamping, byte-carry ripple regression and protocol registration.');
