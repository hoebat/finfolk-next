import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {once} from 'node:events';import net from 'node:net';
import {chromium} from '@playwright/test';
import {serve} from '../ref/foundation/resources/assets/app.manage/environments/controller.mjs';
const root=process.cwd();async function freePort(){const s=net.createServer().listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
const fixture=fs.mkdtempSync(path.join(root,'.cache/environment-preview-')),previewPort=await freePort(),managerPort=await freePort();
const definitions=JSON.parse(fs.readFileSync('resources/finfolkdb/feature-flags.json','utf8')).definitions;
const cfg={platform:'Preview flags fixture',port:0,versions:[{id:'app',label:'App',path:root}],feature_flags:{definitions},resources:[{id:'mock',version:'app',env:{FINFOLK_PREVIEW_STATE_DIR:path.join(fixture,'mock-state')},start:[process.execPath,path.join(root,'scripts/mock_preview.mjs'),'--port',String(previewPort)],probes:[{type:'http',url:'http://127.0.0.1:'+previewPort}],ready_timeout_ms:120000}],environments:[{id:'dev',label:'Development',kind:'local',version:'app',resources:['mock'],feature_flags:{resources:['mock']}}]};
const {server,controller:c}=await serve(fixture,cfg);cfg.port=server.address().port;fs.mkdirSync(path.join(fixture,'config'),{recursive:true});fs.writeFileSync(path.join(fixture,'config/environments.json'),JSON.stringify(cfg));
let browser,manager,logs='';
async function lifecycle(environment, action) {
 const previous=c.state.operations?.at(-1)?.id;
 await environment.getByRole('button',{name:action,exact:true}).first().click();
 for(let i=0;i<400;i++){
  const run=c.state.operations?.at(-1);
  if(run?.id!==previous&&run?.status==='error')throw Error(run.message);
  if(run?.id!==previous&&run?.status==='ok')return;
  await new Promise(r=>setTimeout(r,300));
 }
 throw Error('Environment '+action+' did not complete');
}
try{
 manager=spawn('lein',['-o','run','-m','clojure.main','-e',`(require '[finfolkbuild.project.management :as m] '[app.manage.server :as s]) (def P (assoc m/PROJECT :root ${JSON.stringify(fixture)} :project-panels [] :dev-servers [] :previews [])) (s/-main 'user/P "--port" "${managerPort}")`],{cwd:root,env:process.env,detached:true,stdio:['ignore','pipe','pipe']});manager.stdout.on('data',x=>logs+=x);manager.stderr.on('data',x=>logs+=x);
 const managerURL='http://127.0.0.1:'+managerPort,previewURL='http://127.0.0.1:'+previewPort;
 for(let i=0;i<300;i++){try{if((await fetch(managerURL+'/api/session')).ok)break;}catch{}if(manager.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,300));}
 browser=await chromium.launch({headless:true});const page=await browser.newPage();let preview=await browser.newPage();const errors=[];for(const p of [page,preview])p.on('pageerror',e=>errors.push(e.message));
 await page.goto(managerURL+'/#/environments');const frame=page.frameLocator('iframe[data-environments]');
 await frame.locator('details[data-id="dev"] > summary').click();const environment=frame.locator('details[data-id="dev"]');
 await lifecycle(environment,'start');
 await preview.goto(previewURL+'/practice');await preview.getByRole('link',{name:'Open Sessions →',exact:true}).waitFor();assert.equal(await preview.getByRole('heading',{name:'Progress',exact:true}).count(),0);
 await environment.getByRole('checkbox',{name:'Progress',exact:true}).check();await preview.getByRole('heading',{name:'Progress',exact:true}).waitFor({timeout:10000});
 await environment.getByRole('checkbox',{name:'Progress',exact:true}).uncheck();await preview.getByRole('heading',{name:'Progress',exact:true}).waitFor({state:'hidden',timeout:10000});
 await environment.getByRole('checkbox',{name:'Shop',exact:true}).check();await preview.goto(previewURL+'/community');await preview.getByRole('link',{name:'Visit FinFolk Coop →',exact:true}).waitFor();
 await environment.getByRole('checkbox',{name:'Shop',exact:true}).uncheck();await preview.getByRole('link',{name:'Visit FinFolk Coop →',exact:true}).waitFor({state:'hidden',timeout:10000});
 assert.equal((await fetch(previewURL+'/shop/items')).status,403);
 await preview.close();await lifecycle(environment,'stop');assert.equal(c.owned(c.state.mock),false);
 assert.equal((await fetch(managerURL+'/api/state')).status,200);
 await lifecycle(environment,'start');preview=await browser.newPage();preview.on('pageerror',e=>errors.push(e.message));
 await preview.goto(previewURL+'/community');await preview.getByRole('heading',{name:'Your people. Your coast.',exact:true}).waitFor();assert.equal(await preview.getByRole('link',{name:'Visit FinFolk Coop →',exact:true}).count(),0);
 assert.deepEqual(errors,[]);await page.screenshot({path:'.cache/environment-flags-workbench.png',fullPage:true});
 console.log('Environment preview flags: workbench navigation, real start/stop, live card updates without reload, backend gates and persistence passed.');
}catch(error){throw new Error(error.message+'\n'+logs.slice(-3000)+'\n'+(c.state.mock?.log?c.logs('mock').slice(-2500):''),{cause:error});}
finally{await browser?.close();c.enqueue('stop','dev');await c.queue;if(manager){process.kill(-manager.pid,'SIGTERM');if(manager.exitCode===null)await once(manager,'exit');}await new Promise(r=>server.close(r));fs.rmSync(fixture,{recursive:true,force:true});}
