import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {PNG} from 'pngjs';
import {mockMapTools} from './fixtures/nextjs-map.mjs';
import {MAP_PALETTES,depthGradient} from '../js/finfolk-next/site/web-main/app/(atlas)/atlas/explore-palettes.js';
import {DEPTH_STOPS,DEPTH_GRADIENT,LAND_COLOR} from '../js/finfolk-next/site/web-main/app/(atlas)/atlas/explore-style.js';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3220';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const elevations=[100,0,-10,-50,-200,-1000,-3000,-6000],dem=new PNG({width:256,height:256});
for(let y=0;y<256;y++)for(let x=0;x<256;x++){const encoded=elevations[Math.floor(x/256*elevations.length)]+32768;dem.data.set([Math.floor(encoded/256),encoded%256,0,255],(y*256+x)*4);}
const tile=PNG.sync.write(dem),browser=await chromium.launch();await mkdir('.cache/explore-map',{recursive:true});await mkdir('.cache/map-themes',{recursive:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await mockMapTools(page,base);
 await page.route('https://datasets.finfolk.com.au/v1/map/providers/openfreemap/styles/liberty',r=>r.fulfill({json:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#ffffff'}}]}}));
 const shore=new PNG({width:256,height:256});for(let y=0;y<256;y++)for(let x=0;x<256;x++){const encoded=Math.round((32768-2+4*x/255)*256);shore.data.set([(encoded>>16)&255,(encoded>>8)&255,encoded&255,255],(y*256+x)*4);}const shoreTile=PNG.sync.write(shore);let shoreline=false;
 const flat=new PNG({width:256,height:256});for(let i=0;i<flat.data.length;i+=4)flat.data.set([127,56,0,255],i);const flatTile=PNG.sync.write(flat);let highZoom=false;let requests=0;await page.route('https://datasets.finfolk.com.au/v1/map/providers/terrain/**',r=>{requests++;return r.fulfill({body:shoreline?shoreTile:highZoom?flatTile:tile,contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'}});});
 await page.goto(base+'/map');const canvas=page.locator('.maplibregl-canvas');await canvas.waitFor();
 let targetColors=[LAND_COLOR,...DEPTH_STOPS.filter(([d])=>elevations.includes(d)).map(([,color])=>color)].map(color=>color.match(/\w\w/g).map(v=>parseInt(v,16)));
 async function colors(){const image=PNG.sync.read(await canvas.screenshot()),pixels=image.data,counts=targetColors.map(()=>0);for(let y=120;y<image.height-240;y++)for(let x=20;x<image.width-40;x++){const i=(y*image.width+x)*4;targetColors.forEach((rgb,j)=>{if(rgb.every((v,k)=>Math.abs(v-pixels[i+k])<=6))counts[j]++;});}return counts;}
 // Wait for decoded DEMs to reach the real WebGL render, rather than testing
 // only the style declaration. Each synthetic depth must have its own colour.
 await assertEventually(async()=>{const counts=await colors();return counts.every(n=>n>30);});assert.ok(requests>0);
 await page.screenshot({path:'.cache/explore-map/depth-render-'+width+'.png'});
 const originalCanvas=await canvas.elementHandle(),cameraBefore=await page.evaluate(()=>sessionStorage.getItem('finfolk:explore-camera'));
 for(const palette of Object.values(MAP_PALETTES)){
  await page.evaluate(id=>FinFolkAppearance.apply(id),palette.id);
  targetColors=[palette.landColor,...palette.stops.filter(([d])=>elevations.includes(d)).map(([,color])=>color)].map(color=>color.match(/\w\w/g).map(v=>parseInt(v,16)));
  await assertEventually(async()=>{const counts=await colors();return counts.every(n=>n>30);});
  assert.equal(await originalCanvas.evaluate(el=>el===document.querySelector('.fm-map-canvas canvas')),true,'Theme switching preserves the map instance');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('finfolk:explore-camera')),cameraBefore,'Theme switching preserves camera');
  await page.getByRole('button',{name:'Layers',exact:true}).click();
  assert.equal(await page.locator('.fm-depth-ramp').evaluate(el=>el.style.background),await page.evaluate(value=>{const el=document.createElement('span');el.style.background=value;return el.style.background;},depthGradient(palette.id)));
  await page.keyboard.press('Escape');await page.screenshot({path:'.cache/map-themes/'+palette.id+'-'+width+'.png'});
 }
 await page.evaluate(()=>FinFolkAppearance.apply('yellow'));targetColors=[LAND_COLOR,...DEPTH_STOPS.filter(([d])=>elevations.includes(d)).map(([,color])=>color)].map(color=>color.match(/\w\w/g).map(v=>parseInt(v,16)));
 await assertEventually(async()=>(await colors()).every(n=>n>30));
 await page.getByRole('button',{name:'Layers',exact:true}).click();await page.getByRole('radio',{name:'Street detail',exact:true}).check();await page.keyboard.press('Escape');await assertEventually(async()=>{const counts=await colors();return counts[0]>100&&counts.slice(1).every(n=>n<10);});
 await page.getByRole('button',{name:'Layers',exact:true}).click();await page.getByRole('radio',{name:'Coastal depth',exact:true}).check();await page.keyboard.press('Escape');await assertEventually(async()=>(await colors()).every(n=>n>30));
 await page.getByRole('button',{name:'Layers',exact:true}).click();assert.equal(await page.locator('.fm-depth-ramp').evaluate(el=>el.style.background),await page.evaluate(value=>{const el=document.createElement('span');el.style.background=value;return el.style.background;},DEPTH_GRADIENT));await page.keyboard.press('Escape');
 highZoom=true;await page.addInitScript(()=>sessionStorage.setItem('finfolk:explore-camera',JSON.stringify({center:[145,-38],zoom:12.5})));await page.reload();await canvas.waitFor();await assertEventually(async()=>(await colors())[targetColors.findIndex(rgb=>rgb.join(',')===DEPTH_STOPS.find(([d])=>d===-200)[1].match(/\w\w/g).map(v=>parseInt(v,16)).join(','))]>100);await page.screenshot({path:'.cache/explore-map/depth-close-'+width+'.png'});
 shoreline=true;await page.reload();await canvas.waitFor();await assertEventually(async()=>{const counts=await colors();return counts[0]<2500&&counts[targetColors.length-1]>1000;}).catch(async error=>{await page.screenshot({path:'.cache/map-themes/shoreline-failure.png'});console.log('SHORELINE_FAILURE',await colors(),await page.locator('.fm-map-canvas').getAttribute('data-map-theme'),errors);throw error;});await page.screenshot({path:'.cache/explore-map/depth-shoreline-'+width+'.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.close();
 }console.log('EXPLORE_DEPTH_PASS: four live theme palettes, camera/canvas preservation, real DEM decoding, themed land, six depth colours, shared legend palette, close-zoom shading and smooth zero-elevation shoreline, street/depth switching and phone/desktop controls.');
}finally{await browser.close();}
async function assertEventually(check){for(let i=0;i<30;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,200));}assert.fail('Depth colours did not reach the rendered map.');}
