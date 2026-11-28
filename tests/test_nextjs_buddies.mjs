import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {mockAccount,accountModule} from './fixtures/nextjs-account.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3271';
const fixture=`
if(action==='buddyRead')return value.mode==='inbox'?{conversations:[{id:'thread',kind:'direct',title:'Bob',unread:0},{id:'second',kind:'direct',title:'Carol',unread:0}]}:{messages:window.fixtureMessages?.[value.conversation]||[],canSend:true,canArchive:false};
if(action==='buddyAction'){
 if(value.mode==='open')return {id:'thread'};
 if(value.mode==='send'){
  if(window.fixtureHoldSend)await new Promise(r=>setTimeout(r,1000));
  window.fixtureMessages||={};const messages=window.fixtureMessages[value.conversation]||=[];
  messages.push({sequence:messages.length+1,sender:'alice',name:'Alice',body:value.body,sentAt:'2026-11-27T00:00:00Z'});
  setTimeout(()=>window.fixtureSendDone=true,50);return {sequence:messages.length};
 }
 return {ok:true};
}
if(action==='sessionPlanning'){if(window.holdPlan)await new Promise(resolve=>window.finishPlan=resolve);if(window.failPlan)throw Error('Could not save plan');window.savedPlan=value;return {id:'planned'};}
if(action==='sessionPlans')return {sessions:[],connections:[]};
if(action==='connections')return [{id:'bob',name:'Bob',status:'accepted'}];
if(action==='me')`;
const browser=await chromium.launch();
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});
  await mockAccount(page,base);
  await page.route('**/v1/features',r=>r.fulfill({json:{flags:{buddies:true},revision:1}}));
  await page.route('**/account-client.js',r=>r.fulfill({contentType:'text/javascript',body:accountModule.replace("if(action==='me')",fixture)}));
  await page.goto(base+'/buddies');
  await page.getByLabel('Search messages',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Invitations',exact:true}).click();await page.getByRole('heading',{name:'Your session invitations',exact:true}).waitFor();
  const makePlan=page.getByRole('button',{name:'Make a plan',exact:true}),before=page.url();await makePlan.click();const dialog=page.getByRole('dialog',{name:'Schedule session',exact:true});await dialog.waitFor();assert.equal(page.url(),before);assert.equal(await page.locator('#buddies-workspace .buddy-tabs').count(),1);assert.equal(await page.getByRole('region',{name:'Invite buddies'}).count(),0);
  for(const theme of ['yellow','cobalt','navy-light','navy']){await page.evaluate(async theme=>(await import('/theme.js')).setTheme(theme),theme);const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/buddy-plan-'+width+'-'+theme+'.png'});}
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await expect(makePlan).toBeFocused();assert.equal(await page.evaluate(()=>window.accountCalls.filter(x=>x.action==='sessionPlanning').length),0);
  await page.getByRole('button',{name:'Invite to a session',exact:true}).click();const panel=page.getByRole('region',{name:'Invite buddies'});await panel.getByLabel('Bob',{exact:true}).check();await panel.getByRole('button',{name:'Plan a new session',exact:true}).click();await dialog.waitFor();await page.waitForFunction(()=>document.querySelector('.session-plan-wizard select')?.options.length>1);const select=dialog.locator('select');await select.selectOption(await select.locator('option').nth(1).getAttribute('value'));await dialog.getByRole('button',{name:'Plan here',exact:true}).click();await dialog.getByLabel('Session',{exact:true}).fill('Morning shore session');await dialog.getByLabel('Day and meeting time',{exact:true}).fill('2099-01-01T10:00');await dialog.getByRole('button',{name:'Choose your people',exact:true}).click();await expect(dialog.getByRole('checkbox',{name:/Bob/})).toBeChecked();
  await page.evaluate(()=>{window.holdPlan=true;window.failPlan=true;});await dialog.getByRole('button',{name:'Send 1 invitation',exact:true}).click();await dialog.getByRole('button',{name:'Saving…',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true);assert.equal(await dialog.getByRole('button',{name:'Close session form'}).isDisabled(),true);await page.evaluate(()=>window.finishPlan());await dialog.getByRole('alert').filter({hasText:'Could not save plan'}).waitFor();await expect(dialog.getByRole('checkbox',{name:/Bob/})).toBeChecked();await page.evaluate(()=>{window.holdPlan=false;window.failPlan=false;});await dialog.getByRole('button',{name:'Send 1 invitation',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.savedPlan.title),'Morning shore session');assert.deepEqual(await page.evaluate(()=>window.savedPlan.invitees),['bob']);assert.equal(await page.evaluate(()=>window.savedPlan.state),'upcoming');
  await page.getByRole('button',{name:'Messages',exact:true}).click();if(width<900)await page.getByRole('button',{name:'Back to conversations',exact:true}).click();

  await page.getByLabel('Search messages',{exact:true}).fill('Carol');
  await expect(page.locator('.buddy-conversation-row')).toHaveCount(1);
  await page.getByLabel('Search messages',{exact:true}).fill('');
  await expect(page.locator('.buddy-conversation-row')).toHaveCount(2);
  await page.getByRole('button',{name:'Buddies',exact:true}).click();
  await page.getByRole('heading',{name:'Your buddies',exact:true}).waitFor();
  if(width===1440)await page.screenshot({path:'/tmp/buddies-people.png'});
  await page.getByRole('button',{name:'Message',exact:true}).click();
  await page.getByLabel('Message',{exact:true}).fill('See you at the beach');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.getByText('See you at the beach',{exact:true}).waitFor();
  await expect(page.getByLabel('Message',{exact:true})).toHaveValue('');
  await page.screenshot({path:'/tmp/buddies-'+width+'.png'});
  const box=await page.locator('.buddies-page').boundingBox();assert(box.x+box.width<=width+1);
  if(width===1440){
   await page.evaluate(()=>{window.fixtureHoldSend=true;window.fixtureSendDone=false});
   await page.getByLabel('Message',{exact:true}).fill('Message during switch');
   await page.getByRole('button',{name:'Send',exact:true}).click();
   await page.locator('.buddy-conversation-row').nth(1).click();
   await page.getByLabel('Message',{exact:true}).fill('Carol draft');
   await page.waitForFunction(()=>window.fixtureSendDone);
   await expect(page.getByLabel('Message',{exact:true})).toHaveValue('Carol draft');
   await expect(page.getByText('Message during switch',{exact:true})).toHaveCount(0);
   await expect(page.getByRole('heading',{name:'Carol',exact:true,level:2})).toBeVisible();
  }
  if(width===390){await page.getByRole('button',{name:'Back to conversations',exact:true}).click();await expect(page.getByLabel('Search messages',{exact:true})).toBeVisible();}
  if(width===1440){await page.evaluate(()=>window.FinFolkAppearance.apply('navy'));await page.screenshot({path:'/tmp/buddies-navy.png',animations:'disabled'});}
  await page.close();
 }
 console.log('BUDDIES_BROWSER_PASS: desktop/mobile shared planning overlays, cancellation/focus, retained invitees, failed saves/retry, chat, confirmed sends, responsive layout and draft isolation when switching conversations during a send.');
}finally{await browser.close()}
