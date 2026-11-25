import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3267';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);await page.addInitScript(()=>localStorage.setItem('finfolk:member-tour:3:alice','done'));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/account/checkin?previewActor=alice');
  const nav=page.getByRole('navigation',{name:'Main navigation',exact:true}),link=nav.getByRole('link',{name:'Check in',exact:true});await link.waitFor();const sessions=nav.getByRole('link',{name:'Sessions',exact:true});assert.equal(await sessions.getAttribute('href'),'/logbook');assert.equal(await nav.getByRole('link',{name:'Practice',exact:true}).count(),0);assert.equal(await link.getAttribute('aria-current'),'page');assert.equal(await page.getByRole('tab',{name:'Check in',exact:true}).count(),0);assert.equal(await page.getByRole('tab',{name:'Dive sites',exact:true}).count(),0);assert.equal(await page.getByRole('tablist',{name:'Your account',exact:true}).count(),0);await page.getByRole('region',{name:'Check in',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'My sessions',exact:true}).count(),0);
  await sessions.click();await page.waitForURL('**/logbook');await page.getByRole('button',{name:'Log a session',exact:true}).waitFor();assert.equal(await sessions.getAttribute('aria-current'),'page');await page.goto(base+'/account/posts');await page.getByRole('tab',{name:'Your posts',exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'Check in',exact:true}).count(),0);assert.equal(await page.getByRole('tab',{name:'Dive sites',exact:true}).count(),0);assert.equal(await nav.getByRole('link',{name:'Check in',exact:true}).getAttribute('aria-current'),null);
  await page.getByRole('button',{name:'Open menu',exact:true}).click();const suggest=page.getByRole('navigation',{name:'Account and settings',exact:true}).getByRole('link',{name:'Suggest a dive site',exact:true});await suggest.click();await page.getByRole('group',{name:'Site basics',exact:true}).waitFor();await page.getByRole('heading',{name:'Contribute a dive site',exact:true}).waitFor();assert.equal(await page.getByRole('tablist',{name:'Your account',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.goto(base+'/community?previewActor=guest');await page.locator('.ff-signin').waitFor();assert.equal(await nav.getByRole('link',{name:'Check in',exact:true}).count(),0);assert.equal(await nav.getByRole('link',{name:'Sessions',exact:true}).count(),0);
 }
 assert.deepEqual(errors,[]);console.log('CHECKIN_NAVIGATION_PASS: member sidebar and active route, guest gating, standalone check-in and contributions, account tabs and mobile layout.');
}finally{await browser.close();}
