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
  await page.getByRole('heading',{name:'Your buddies',exact:true}).waitFor();
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
   await page.locator('.buddy-messages aside button').nth(1).click();
   await page.getByLabel('Message',{exact:true}).fill('Carol draft');
   await page.waitForFunction(()=>window.fixtureSendDone);
   await expect(page.getByLabel('Message',{exact:true})).toHaveValue('Carol draft');
   await expect(page.getByText('Message during switch',{exact:true})).toHaveCount(0);
   await expect(page.getByRole('heading',{name:'Carol',exact:true})).toBeVisible();
  }
  await page.close();
 }
 console.log('BUDDIES_BROWSER_PASS: desktop/mobile chat, confirmed sends, responsive layout and draft isolation when switching conversations during a send.');
}finally{await browser.close()}
