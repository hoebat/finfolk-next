import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3267';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();await mkdir('.cache/checkin-composer',{recursive:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('finfolk:member-tour:3:alice','done'));
 for(const width of [320,390,1440])for(const theme of ['yellow','cobalt','navy-light','navy']){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/account/checkin?previewActor=alice');await page.getByRole('heading',{name:'Create a check-in',exact:true}).waitFor();await page.evaluate(theme=>{localStorage.setItem('finfolk-theme',theme);globalThis.FinFolkAppearance.apply(theme)},theme);
  const submit=page.getByRole('button',{name:'Check in today',exact:true});assert.equal(await submit.isDisabled(),true);await page.getByRole('button',{name:'Choose a place',exact:true}).click();assert.equal(await page.getByLabel('Find your dive site').evaluate(el=>el===document.activeElement),true);
  await page.getByLabel('Dive site to check in at').selectOption('bondi');await page.locator('.checkin-preview').getByRole('heading',{name:'Bondi Beach',exact:true}).waitFor();assert.equal(await submit.isEnabled(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} ${theme}`);
  if(width!==320&&['yellow','navy'].includes(theme))await page.screenshot({path:`.cache/checkin-composer/${width}-${theme}.png`,fullPage:true});
  await page.getByLabel('Find your dive site').fill('nothing-matches-this');assert.equal(await submit.isDisabled(),true);assert.equal(await page.getByLabel('Dive site to check in at').inputValue(),'');
 }
 await page.getByLabel('Find your dive site').fill('');await page.getByLabel('Dive site to check in at').selectOption('bondi');await page.getByRole('button',{name:'Check in today',exact:true}).click();await page.getByRole('status').filter({hasText:'You’re checked in at Bondi Beach.'}).waitFor();await page.locator('.acct-checkin-row').getByRole('button',{name:'Remove',exact:true}).first().click();await page.locator('.acct-checkin-row').waitFor({state:'hidden'});assert.deepEqual(errors,[]);console.log('CHECKIN_COMPOSER_PASS: place preview, selection reset, submit and remove; four themes at 320/390/1440px without overflow or browser errors.');
}finally{await browser.close()}
