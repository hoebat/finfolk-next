import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,copyFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {configure} from '../scripts/configure_feature_flags.mjs';
import {once} from 'node:events';
import net from 'node:net';
import {serve} from '@hono/node-server';
import {chromium} from '@playwright/test';
import {connectAdmin,ensureSupabase,withTestDatabase} from '../scripts/lib/local_supabase.mjs';
import {database} from '../backend/db.mjs';
import {createAPI} from '../backend/api.mjs';
const base=ensureSupabase(),admin=await connectAdmin(base),credential='local-fixture-flag-management-token-32-characters';
try{await withTestDatabase(admin,base,async url=>{
 const db=database(url.href);let api,manager,browser,fixtureRoot,log='';
 try{
  await db.query(await readFile(new URL('../resources/finfolkdb/feature-flags.sql',import.meta.url),'utf8'));
  const app=createAPI({db,verify:async()=>{throw Error('No fixture account');}});
  api=serve({fetch:r=>app.fetch(r,{FINFOLK_FLAG_MANAGEMENT_TOKEN:credential}),hostname:'127.0.0.1',port:0});await once(api,'listening');
  const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
  const origin='http://127.0.0.1:'+port;
  fixtureRoot=await mkdtemp(path.resolve('.cache/flag-manager-connection-'));
  await mkdir(path.join(fixtureRoot,'config/feature-flags-panel'),{recursive:true});
  for(const name of ['index.html','panel.js','panel.css'])await copyFile('config/feature-flags-panel/'+name,path.join(fixtureRoot,'config/feature-flags-panel',name));
  const tokenFile=path.join(fixtureRoot,'fixture-token');await writeFile(tokenFile,credential,{mode:0o600});
  await configure({root:fixtureRoot,apiOrigin:'http://127.0.0.1:'+api.address().port,tokenFile});
  const managerEnv={...process.env};delete managerEnv.FINFOLK_FLAG_API_ORIGIN;delete managerEnv.FINFOLK_FLAG_MANAGEMENT_TOKEN;

  manager=spawn('lein',['run','-m','clojure.main','-e',`(require '[finfolkbuild.project.management :as m] '[app.manage.server :as s]) (def P (assoc m/PROJECT :root ${JSON.stringify(fixtureRoot)} :workbench-ui :next)) (s/-main 'user/P "--port" "${port}")`],{env:managerEnv,detached:true,stdio:['ignore','pipe','pipe']});
  manager.stdout.on('data',v=>log+=v);manager.stderr.on('data',v=>log+=v);
  const deadline=Date.now()+150000;while(Date.now()<deadline){try{if((await fetch(origin+'/api/session')).ok)break;}catch{}if(manager.exitCode!==null)throw Error(log);await new Promise(r=>setTimeout(r,300));}
  const {token}=await(await fetch(origin+'/api/session')).json(),endpoint=origin+'/project-panels/feature-flags/';
  assert.equal((await fetch(endpoint+'api/state')).status,403);
  assert.equal((await fetch(endpoint+'api/state',{headers:{'X-App-Manage-Token':token,Origin:'https://evil.test'}})).status,403);
  assert.equal((await fetch(endpoint+'api/actions/shell',{method:'POST',headers:{'X-App-Manage-Token':token},body:'{}'})).status,404);
  assert.equal((await fetch(endpoint+'panel.js')).status,200);assert.equal((await fetch(endpoint+'secret.env')).status,404);
  browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/legacy');await page.getByRole('button',{name:'Production flags',exact:true}).click();
  const panel=page.frameLocator('iframe[data-project-panel]');await panel.getByText('Connected environment: production').waitFor();
  assert.equal(await panel.locator('article').filter({has:panel.getByRole('heading',{name:'Shop',exact:true})}).count(),1);
  const shop=panel.locator('#flags article').filter({has:panel.getByRole('heading',{name:'Shop',exact:true})});
  await shop.getByLabel('Access mode').selectOption('testers');await shop.getByLabel('Tester member IDs').fill('00000000-0000-4000-8000-000000000001');
  await shop.getByRole('button',{name:'Save',exact:true}).click();await panel.getByRole('status').filter({hasText:'Saved.'}).waitFor();
  const rows=await db.query("SELECT * FROM finfolk_flags.flags WHERE id='shop'");assert.equal(rows[0].mode,'testers');assert.equal(rows[0].revision,1);
  assert.equal((await db.query('SELECT * FROM finfolk_flags.history')).length,1);
  const body=await(await fetch(endpoint+'api/state',{headers:{'X-App-Manage-Token':token}})).text();assert.ok(!body.includes(credential));
  // A manager poll must preserve unsaved panel edits.
  await shop.getByLabel('Tester member IDs').fill('unsaved tester edit');await page.waitForTimeout(2500);assert.equal(await shop.getByLabel('Tester member IDs').inputValue(),'unsaved tester edit');
  assert.deepEqual(errors,[]);
  // Next workbench embeds the same project panel through Application navigation.

  await page.goto(origin);await page.getByRole('button',{name:'Application',exact:true}).click();await page.getByRole('button',{name:'Production flags',exact:true}).click();
  const embedded=page.frameLocator('iframe.legacy').frameLocator('iframe[data-project-panel]');await embedded.getByText('Connected environment: production').waitFor();
  console.log('app.manage project panel: private config loaded with no credential environment variables; real browser save persisted through local manager → API → PostgreSQL; token/origin/action/asset controls passed.');
 }catch(error){throw new Error(error.message+'\n'+log.slice(-5000),{cause:error});}
 finally{await browser?.close();if(manager){process.kill(-manager.pid,'SIGTERM');if(manager.exitCode===null)await once(manager,'exit').catch(()=>{});}if(api)await new Promise(r=>api.close(r));await db.pool.end();if(fixtureRoot)await rm(fixtureRoot,{recursive:true,force:true});}
});}finally{await admin.end();}
