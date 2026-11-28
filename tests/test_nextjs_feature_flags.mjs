import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
const origin='http://127.0.0.1:'+port;
let flags={};const controller=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({environment:'ui',flags,revision:1,preview:true}));});controller.listen(0,'127.0.0.1');await once(controller,'listening');
const server=spawn(process.execPath,['scripts/mock_preview.mjs','--port',String(port)],{env:{...process.env,APP_MANAGE_FEATURE_FLAGS_URL:'http://127.0.0.1:'+controller.address().port+'/features?id=ui',FINFOLK_NEXT_DIST_DIR:'.cache/feature-flags-ui-'+port,NEXT_TELEMETRY_DISABLED:'1'},detached:true,stdio:['ignore','pipe','pipe']});
let log='',browser;server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
try{
 const deadline=Date.now()+120000;while(Date.now()<deadline){try{if((await fetch(origin+'/api/account-config')).ok)break;}catch{}if(server.exitCode!==null)throw Error(log);await new Promise(r=>setTimeout(r,300));}
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/practice');await page.getByRole('link',{name:'Open Sessions →',exact:true}).waitFor();
 for(const name of ['Progress','Breathing practice','Watch imports','Breath check'])assert.equal(await page.getByRole('heading',{name,exact:true}).count(),0,name);
 assert.equal(await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Events',exact:true}).count(),0);
 await page.goto(origin+'/community');await page.getByRole('heading',{name:'Community',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:/FinFolk Coop/}).count(),0);
 for(const path of ['/shop','/shop/manage','/events','/events/my','/events/new','/events/invitation','/events/public-event']){await page.goto(origin+path);await page.getByRole('heading',{name:'Feature unavailable',exact:true}).waitFor();}
 for(const path of ['/practice/progress','/practice/breathing','/practice/watch-imports','/practice/breath-check','/shop/not-a-route']){const response=await page.goto(origin+path);assert.equal(response.status(),404);await page.getByRole('heading',{name:'Page unavailable',exact:true}).waitFor();}
 flags={events:true,shop:true,'practice.progress':true};await page.goto(origin+'/practice');await page.getByRole('heading',{name:'Progress',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Breathing practice',exact:true}).count(),0);
 await page.goto(origin+'/events');await page.getByRole('heading',{name:'Events',exact:true}).waitFor();await page.getByRole('link',{name:'Ocean training'}).waitFor();
 // A live change while a page remains open unmounts feature content on focus.
 flags={};await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('heading',{name:'Feature unavailable',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('Next feature flags: Sessions-only Practice, independent cards, navigation, direct routes and live revocation passed.');
}catch(error){throw new Error(error.message+'\n'+log.slice(-6000),{cause:error});}
finally{await browser?.close();process.kill(-server.pid,'SIGTERM');if(server.exitCode===null)await once(server,'exit').catch(()=>{});await new Promise(r=>controller.close(r));}
