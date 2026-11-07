import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {PNG} from 'pngjs';
import {mockMapTools} from './fixtures/nextjs-map.mjs';
import {DEPTH_STOPS,LAND_COLOR} from '../js/finfolk-next/site/web-main/app/(atlas)/atlas/explore-style.js';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3220';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const elevations=[100,-10,-50,-200,-1000,-3000,-6000],dem=new PNG({width:256,height:256});
for(let y=0;y<256;y++)for(let x=0;x<256;x++){const encoded=elevations[Math.floor(x/256*elevations.length)]+32768;dem.data.set([Math.floor(encoded/256),encoded%256,0,255],(y*256+x)*4);}
const tile=PNG.sync.write(dem),browser=await chromium.launch();await mkdir('.cache/explore-map',{recursive:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await mockMapTools(page,base);
 await page.route('https://tiles.openfreemap.org/styles/liberty',r=>r.fulfill({json:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#ffffff'}}]}}));
 let requests=0;await page.route('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**',r=>{requests++;return r.fulfill({body:tile,contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'}});});
 await page.goto(base+'/map');const canvas=page.locator('.maplibregl-canvas');await canvas.waitFor();
 const targetColors=[LAND_COLOR,...DEPTH_STOPS.filter(([d])=>elevations.includes(d)).map(([,color])=>color)].map(color=>color.match(/\w\w/g).map(v=>parseInt(v,16)));
 async function colors(){const pixels=PNG.sync.read(await canvas.screenshot()).data,counts=targetColors.map(()=>0);for(let i=0;i<pixels.length;i+=4)targetColors.forEach((rgb,j)=>{if(rgb.every((v,k)=>Math.abs(v-pixels[i+k])<=3))counts[j]++;});return counts;}
 // Wait for decoded DEMs to reach the real WebGL render, rather than testing
 // only the style declaration. Each synthetic depth must have its own colour.
 await assertEventually(async()=>{const counts=await colors();return counts.every(n=>n>30);});assert.ok(requests>0);
 await page.screenshot({path:'.cache/explore-map/depth-render-'+width+'.png'});
 await page.getByRole('button',{name:'Layers',exact:true}).click();await page.getByRole('radio',{name:'Street detail',exact:true}).check();await page.keyboard.press('Escape');await assertEventually(async()=>{const counts=await colors();return counts[0]>100&&counts.slice(1).every(n=>n<10);});
 await page.getByRole('button',{name:'Layers',exact:true}).click();await page.getByRole('radio',{name:'Coastal depth',exact:true}).check();await page.keyboard.press('Escape');await assertEventually(async()=>(await colors()).every(n=>n>30));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.close();
 }console.log('EXPLORE_DEPTH_PASS: real DEM decoding, gray land, six depth colours, street/depth switching and phone/desktop controls.');
}finally{await browser.close();}
async function assertEventually(check){for(let i=0;i<30;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,200));}assert.fail('Depth colours did not reach the rendered map.');}
