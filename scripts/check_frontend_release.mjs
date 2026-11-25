import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require = createRequire(resolve('.cache/promotion-tools/package.json'));
const {chromium} = require('playwright');
const base=process.argv[2],url=new URL(base);
assert.equal(url.protocol,'https:');assert(url.hostname === 'finfolk.com.au' || /^[a-f0-9]{24}--finfolk\.netlify\.app$/.test(url.hostname));assert(!url.search&&!url.hash);
const configResponse=await fetch(base+'/api/account-config');assert(configResponse.ok,'Production account configuration must load');
const config=await configResponse.json();assert(config.enabled);assert.notEqual(config.authProvider,'preview');
for(const key of ['apiUrl','cacheApiUrl','authUrl','supabaseUrl'])if(config[key]){assert(!/localhost|127\.0\.0\.1|\[::1\]/.test(config[key]),'Local service leaked into '+key);assert.notEqual(config[key],'preview');}
const backendStatus=await fetch('https://api.finfolk.com.au/health', {signal:AbortSignal.timeout(15000)}).then(r=>r.status).catch(()=>null);
const browser=await chromium.launch({headless:true});const errors=[],requests=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push({url:page.url(),message:e.message}));page.on('request',r=>requests.push(r.url()));
 await page.goto(base+'/map',{waitUntil:'domcontentloaded'});await page.getByRole('region',{name:'Explore map',exact:true}).waitFor();await page.locator('.fm-map-canvas canvas').waitFor();
 const main=page.getByRole('navigation',{name:'Main navigation'});await main.waitFor();assert.equal(await main.getByRole('link',{name:'Events',exact:true}).count(),0);
 for(const path of ['/shop','/events','/practice/progress','/practice/breathing','/practice/watch-imports','/practice/breath-check']){
  const r=await page.goto(base+path,{waitUntil:'domcontentloaded'});if(path.startsWith('/practice/')&&r.status()===404)continue;await page.getByRole('heading',{name:'Feature unavailable',exact:true}).waitFor();
 }
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/practice',{waitUntil:'domcontentloaded'});await page.getByRole('link',{name:'Open Sessions →',exact:true}).waitFor();
 for(const name of ['Progress','Breathing practice','Watch imports','Breath check'])assert.equal(await page.getByRole('heading',{name,exact:true}).count(),0);
 assert(!requests.some(u=>['localhost','127.0.0.1','[::1]'].includes(new URL(u).hostname)||new URL(u).pathname.startsWith('/api/preview/')||new URL(u).pathname.startsWith('/__preview/')),'Mock/local request escaped into the production build');
 assert.deepEqual(errors,[]);
 const report={passed:true,url:base,checkedAt:new Date().toISOString(),mockAccountConfig:false,localRequests:false,disabledFlags:['shop','events','practice.progress','practice.breathing','practice.watch-imports','practice.breath-check'],directRoutesClosed:true,practiceSessionsAvailable:true,mapRendered:true,browserErrors:0,apiHttpStatus:backendStatus,liveBackendReadiness:'Authentication and data writes are outside this frontend check'};
 console.log(JSON.stringify(report));
}finally{await browser.close()}
