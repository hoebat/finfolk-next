import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from '@playwright/test';
const root=resolve('.'),port=process.env.MOCK_LAUNCHER_TEST_PORT||'3391',base='http://127.0.0.1:'+port;
const state=await mkdtemp(resolve('.cache/mock-launcher-test-'));
const child=spawn(process.execPath,[resolve('scripts/mock_preview.mjs'),'--port',port],{cwd:resolve('js/finfolk-next/site/web-main'),env:{...process.env,PREVIEW_PORT:'3010',FINFOLK_PREVIEW_STATE_DIR:state},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',c=>logs=(logs+c).slice(-10000));child.stderr.on('data',c=>logs=(logs+c).slice(-10000));
let browser;
try{
 let ready=false;
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(logs);try{const response=await fetch(base+'/api/account-config');if(response.ok){assert.equal((await response.json()).authProvider,'preview');ready=true;break;}}catch{}await delay(200);}
 assert.ok(ready,logs);
 browser=await chromium.launch();const page=await browser.newPage({serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/members/bob');await page.getByRole('heading',{name:'Bob',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Could not load this page',exact:true}).count(),0);assert.deepEqual(errors,[]);
 console.log('MOCK_LAUNCHER_PASS: nested working directory, --port, mock configuration, member SSR and browser rendering.');
}finally{await browser?.close();child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(10000)]);}
