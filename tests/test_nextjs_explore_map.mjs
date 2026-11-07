import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {mockMapTools} from './fixtures/nextjs-map.mjs';
import {PNG} from 'pngjs';
const dem=new PNG({width:256,height:256});for(let y=0;y<256;y++)for(let x=0;x<256;x++){const elevation=x<64?100:-Math.round((x-64)/192*6500),encoded=elevation+32768,i=(y*256+x)*4;dem.data.set([Math.floor(encoded/256),encoded%256,0,255],i);}const depthTile=PNG.sync.write(dem);
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3220';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch(),out='.cache/explore-map';await mkdir(out,{recursive:true});
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1000},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await mockMapTools(page,base);
 await page.route('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**',r=>r.fulfill({body:depthTile,contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'}}));
 const school={id:'school',name:'Ocean School',locality:'Bondi Beach',state:'NSW',country:'Australia',category:'School',description:'Published school listing'},unmapped={id:'unmapped',name:'Unmapped School',locality:'Unknown',state:'VIC',category:'School'},event={id:'meetup',document:{title:'Shore meetup',location:'Bondi Beach',category:'Meetup'},starts_at:'2030-01-01T00:00:00Z'};
 await page.route('**/v1/directory*',r=>r.fulfill({json:new URL(r.request().url()).searchParams.has('offset')?{listings:[unmapped],next:null}:{listings:[school],next:50}}));
 await page.route('**/v1/directory/school',r=>r.fulfill({json:school}));
 await page.route('**/v1/events*',r=>r.fulfill({json:{events:[event]}}));
 await page.route('**/v1/events/meetup',r=>r.fulfill({json:event}));
 await page.route('**/v1/discover/popular*',r=>r.fulfill({json:{places:['bondi']}}));
 await page.route('https://tiles.openfreemap.org/styles/liberty',r=>r.fulfill({json:{version:8,glyphs:base+'/test-glyphs/{fontstack}/{range}.pbf',sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#bbdadd'}}]}}));
 await page.route('**/test-glyphs/**',r=>r.fulfill({body:Buffer.alloc(0),contentType:'application/x-protobuf'}));
 await page.goto(base+'/map?site=bondi');await page.locator('.fm-detail h2').filter({hasText:'Bondi Beach'}).waitFor();
 await page.locator('.fm-map-canvas .maplibregl-canvas').waitFor();await page.waitForFunction(()=>!document.querySelector('.fm-map-status'));
 await page.waitForFunction(()=>document.querySelectorAll('.fm-card').length===5);
 assert.equal(await page.locator('.fm-detail h2').textContent(),'Bondi Beach');
 await page.getByRole('button',{name:'Businesses',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.fm-card').length===1);assert.match(await page.locator('.fm-card').innerText(),/Ocean School/);
 await page.locator('.fm-card').filter({hasText:'Ocean School'}).click();await page.locator('.fm-detail h2').filter({hasText:'Ocean School'}).waitFor();
 assert.equal(new URL(page.url()).searchParams.get('listing'),'school');assert.match(await page.locator('.fm-detail').innerText(),/premises unconfirmed/);
 await page.getByRole('button',{name:'Load more businesses',exact:true}).click();await page.locator('.fm-card').filter({hasText:'Unmapped School'}).waitFor();
 await page.getByRole('button',{name:'Close place details',exact:true}).click();
 await page.getByRole('searchbox',{name:'Search spots, businesses and people',exact:true}).fill('missing');await page.getByRole('heading',{name:'No matches here',exact:true}).waitFor();
 await page.locator('.fm-empty').getByRole('button',{name:'Clear filters',exact:true}).click();
 await page.getByRole('button',{name:'People',exact:true}).click();await page.locator('.fm-card').filter({hasText:'The folk at Bondi Beach'}).waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('.fm-card').length===1);await page.locator('.fm-card').click();await page.locator('.fm-detail').filter({hasText:'not live positions'}).waitFor();
 await page.goBack();await page.waitForFunction(()=>!document.querySelector('.fm-detail'));
 await page.getByRole('button',{name:'Layers',exact:true}).click();await page.getByText('Regional depth shading · ETOPO1 (~2 km). Fades at close zoom; local contours show survey detail.',{exact:true}).waitFor();await page.getByRole('radio',{name:'Street detail',exact:true}).check();assert.equal(await page.getByRole('radio',{name:'Street detail',exact:true}).isChecked(),true);await page.getByRole('combobox',{name:'Map theme',exact:true}).selectOption('navy-light');await page.waitForFunction(()=>document.documentElement.dataset.theme==='navy-light');await page.keyboard.press('Escape');assert.equal(await page.locator('.fm-layers').count(),0);
 await page.goto(base+'/map?listing=school');await page.locator('.fm-detail h2').filter({hasText:'Ocean School'}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.locator('.ff-utility-menu').isVisible(),false);
 await page.screenshot({path:out+'/explore-'+width+'.png'});
 if(width===390){assert.equal(await page.getByRole('button',{name:/results.*Place selected/}).getAttribute('aria-expanded'),'true');await page.getByRole('button',{name:/results.*Place selected/}).click();assert.equal(await page.locator('.fm-explore').getAttribute('data-sheet'),'collapsed');}
 await page.getByRole('button',{name:'Close place details',exact:true}).click();
 await page.getByRole('button',{name:'Layers',exact:true}).click();await page.getByRole('link',{name:'Depth & survey tools',exact:false}).click();await page.waitForURL(url=>url.searchParams.get('mode')==='survey');await page.locator('#explorer').waitFor({state:'visible'});assert.equal(await page.locator('.fm-explore').isVisible(),false);
 await page.getByRole('link',{name:'← Explore map',exact:true}).click();await page.locator('.fm-explore').waitFor({state:'visible'});
 if(width===1440){await page.route('https://tiles.openfreemap.org/styles/liberty',r=>r.abort());await page.reload();await page.locator('.fm-map-status').filter({hasText:'could not load'}).waitFor();await page.getByRole('button',{name:'Dive spots',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.fm-card').length===2);assert.equal(await page.locator('.fm-result-tools a').first().isVisible(),true);}
 assert.deepEqual(errors,[]);await context.close();
 }
 console.log('EXPLORE_MAP_PASS: real WebGL engine with local style fixture, categories, search, cards, pagination, shared links, history, mobile sheet, layers and retained survey map.');
}finally{await browser.close();}
