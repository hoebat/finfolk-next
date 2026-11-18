// Real Next.js + emitted client + real local API/Auth/DB. No account model stubs.
import assert from 'node:assert/strict';
import {nativeSiteReviewBrowser} from './native-site-review-browser.mjs';
import {nativeAtlasBrowser} from './native-atlas-browser.mjs';
import {nativeDirectoryEventsBrowser} from './native-directory-events-browser.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {resolve} from 'node:path';
import net from 'node:net';
import {rm,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
export async function nativeAccountBrowser({apiOrigin,startAPI,supabaseUrl,publishableKey,email,password,userId,siteId,peerId}){
 for(const file of ['next-backbone.js','app-backbone.js','site-catalog.js']){
  const base='js/finfolk-next/site/web-main/';
  assert.deepEqual(await readFile(base+'public/'+file),await readFile(base+'src/'+file),'Next must serve the current emitted backbone: '+file);
 }
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const origin='http://127.0.0.1:'+port,distDir='.cache/native-account-next-'+port;
 if(startAPI)apiOrigin=await startAPI(origin);
 const next=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{
  cwd:'js/finfolk-next/site/web-main',env:{...process.env,FINFOLK_AUTH_PROVIDER:'supabase',FINFOLK_API_ORIGIN:apiOrigin,FINFOLK_SUPABASE_URL:supabaseUrl,FINFOLK_SUPABASE_PUBLISHABLE_KEY:publishableKey,FINFOLK_NEXT_DIST_DIR:distDir,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
 let logs='';next.stdout.on('data',chunk=>logs+=String(chunk));next.stderr.on('data',chunk=>logs+=String(chunk));
 let browser,page;
 try{
  let ready=false;for(let i=0;i<120;i++){if(next.exitCode!==null)throw Error('Native Next server exited');try{const response=await fetch(origin+'/api/account-config');if(response.ok){const config=await response.json();assert.equal(config.authProvider,'supabase');assert.equal(config.supabaseUrl,supabaseUrl);assert.equal(config.publishableKey,publishableKey);assert.deepEqual(Object.keys(config).sort(),['authProvider','enabled','googleEnabled','publishableKey','supabaseUrl'].sort());ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
  assert.ok(ready,'Native Next fixture must start');
  browser=await chromium.launch();page=await browser.newPage({serviceWorkers:'block'});page.setDefaultTimeout(30000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(id=>{localStorage.setItem('finfolk:welcome','1');localStorage.setItem('finfolk:member-tour:3:'+id,'done');},userId);
  await page.goto(origin+'/account/privacy');
  await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#social-profile').getByLabel('Display name',{exact:true}).fill('Browser Diver');
  await page.getByLabel('A little about you',{exact:true}).fill('Saved through the real native account UI');
  await page.getByLabel('Beaches of interest',{exact:true}).selectOption([siteId]);
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Saved.'}).waitFor();
  await page.reload();await page.getByLabel('Display name',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Display name',{exact:true}).inputValue(),'Browser Diver');
  assert.equal(await page.getByLabel('A little about you',{exact:true}).inputValue(),'Saved through the real native account UI');
  assert.equal(await page.locator('#account-email-verification').count(),0,'Verified identities must not be shown as unverified');
  await page.getByRole('tab',{name:'Check in',exact:true}).click();
  await page.getByLabel('Dive site to check in at',{exact:true}).selectOption(siteId);
  await page.getByRole('button',{name:'Check in today',exact:true}).click();
  await page.getByRole('status').filter({hasText:'checked in at Native test beach'}).waitFor();
  await page.reload();
  const visit=page.locator('#social-checkins p').filter({hasText:'Native test beach'});await visit.waitFor();
  await visit.getByRole('button',{name:'Remove',exact:true}).click();
  await page.getByText('Your first visit starts here. Pick a beach above to check in.',{exact:true}).waitFor();
  await page.goto(origin+'/people');
  const alice=page.locator('.person-card').filter({has:page.getByRole('heading',{name:'Alice',exact:true})});await alice.waitFor();
  await alice.getByRole('button',{name:'Connect',exact:true}).click();
  await alice.getByRole('button',{name:'Request pending',exact:true}).waitFor();
  await page.goto(origin+'/profile');
  await page.getByRole('heading',{name:'Browser Diver',exact:true}).waitFor();
  await page.getByRole('link',{name:'Edit profile',exact:true}).click();
  await page.getByLabel('About you',{exact:true}).fill('Edited through the native profile screen');
  await page.getByLabel('Display name',{exact:true}).fill('Browser Profile Diver');
  await page.getByLabel('Experience',{exact:true}).selectOption('comfortable');
  await page.locator('input[name="sharing-visits"]').check();
  const portraitPNG=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;const ctx=canvas.getContext('2d');ctx.fillStyle='#4265da';ctx.fillRect(0,0,2,2);return canvas.toDataURL('image/png');});
  await page.locator('input[name="portrait"]').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(portraitPNG.split(',')[1],'base64')});
  await page.getByRole('status').filter({hasText:'Portrait ready. Save profile to keep it.'}).waitFor();
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/profile');
  await page.getByRole('heading',{name:'Browser Profile Diver',exact:true}).waitFor();
  await page.getByText('Edited through the native profile screen',{exact:true}).waitFor();
  const portrait=page.getByRole('img',{name:'Profile portrait for Browser Profile Diver',exact:true});await portrait.waitFor();
  assert.match(await portrait.getAttribute('src'),/^data:image\/(webp|jpeg);base64,/);
  await page.reload();await page.getByRole('heading',{name:'Browser Profile Diver',exact:true}).waitFor();
  await page.goto(origin+'/members/'+peerId);await page.getByRole('heading',{name:'Alice',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Shared statistics',exact:true}).waitFor();
  await nativeSiteReviewBrowser({page,origin});
  await nativeDirectoryEventsBrowser({browser,page,origin});
  await nativeAtlasBrowser({browser,page,origin,siteId});
  await page.goto(origin+'/logbook');
  await page.getByRole('button',{name:'Log a session',exact:true}).click();
  await page.getByLabel('Date',{exact:true}).fill('2026-11-17');
  await page.getByLabel('Beach or location',{exact:true}).fill('Native test beach · ');
  await page.getByLabel('Duration (minutes, optional)',{exact:true}).fill('42');
  await page.getByLabel('Maximum depth (metres, optional)',{exact:true}).fill('14');
  await page.getByLabel('Notes',{exact:true}).fill('Saved through native logbook UI');
  await page.getByRole('button',{name:'Save private session',exact:true}).click();
  await page.locator('.session-detail').getByText('Saved through native logbook UI',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByLabel('Notes',{exact:true}).fill('Edited native logbook UI');
  await page.getByRole('button',{name:'Save private session',exact:true}).click();
  await page.locator('.session-detail').getByText('Edited native logbook UI',{exact:true}).waitFor();
  const sharedURL=page.url(),guest=await browser.newPage({serviceWorkers:'block'});
  guest.on('pageerror',error=>errors.push(error.message));
  await guest.addInitScript(()=>localStorage.setItem('finfolk:welcome','1'));
  try{
   await guest.goto(sharedURL);await guest.getByRole('status').filter({hasText:'This session is private.'}).waitFor();
   await page.getByRole('button',{name:'Publish',exact:true}).click();
   await page.getByRole('dialog').getByRole('button',{name:'Publish for everyone',exact:true}).click();
   await page.getByRole('button',{name:'Unpublish',exact:true}).waitFor();
   await guest.reload();await guest.locator('.session-detail').getByText('Edited native logbook UI',{exact:true}).waitFor();
   assert.equal(await guest.getByRole('button',{name:'Edit',exact:true}).count(),0,'Anonymous readers cannot edit a published session');
   await page.getByRole('button',{name:'Unpublish',exact:true}).click();
   await page.getByRole('button',{name:'Publish',exact:true}).waitFor();
   await guest.reload();await guest.getByRole('status').filter({hasText:'This session is private.'}).waitFor();
  }catch(error){throw new Error(error.message+'\nAnonymous page:\n'+await guest.locator('body').innerText(),{cause:error});}finally{await guest.close();}
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete',exact:true}).click();
  await page.getByRole('button',{name:'Log a session',exact:true}).waitFor();
  assert.equal(await page.getByText('Edited native logbook UI',{exact:true}).count(),0);
  await page.goto(origin+'/account/privacy');

  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
  assert.equal(await page.locator('#social-profile').count(),0,'Private form must disappear on sign-out');
  // Exercise the existing destructive-action screen against real Auth and DB.
  await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#social-profile').waitFor();
  await page.getByText('Delete account',{exact:true}).click();
  page.on('dialog',dialog=>dialog.accept());
  await page.getByLabel('Password to confirm deletion',{exact:true}).fill('wrong-password');
  await page.getByRole('button',{name:'Delete my account and data',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Invalid login credentials'}).waitFor();
  assert.equal(await page.locator('#social-profile').count(),1,'Wrong-password deletion must retain the account');
  await page.getByLabel('Password to confirm deletion',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Delete my account and data',exact:true}).click();
  await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
  await page.getByText('Your account has been deleted.',{exact:true}).waitFor();
  assert.equal(await page.locator('#social-profile').count(),0);
  assert.deepEqual(errors,[]);
 }catch(error){const visible=page?await page.locator('body').innerText().catch(()=>'<unavailable>'):'';throw new Error(error.message+'\nVisible page:\n'+visible.slice(0,5000)+'\nNative Next logs:\n'+logs,{cause:error});}
 finally{await browser?.close();if(next.exitCode===null){const closed=once(next,'exit');next.kill('SIGTERM');await closed;}await rm(resolve('js/finfolk-next/site/web-main',distDir),{recursive:true,force:true});}
}
