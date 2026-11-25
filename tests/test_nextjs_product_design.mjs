// Responsive acceptance for the native design refresh. Legacy pixel-parity
// suites deliberately keep their original references and strict thresholds.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {mockMembers} from './fixtures/nextjs-members.mjs';
import {mockLogbook} from './fixtures/nextjs-logbook.mjs';

const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const out='.cache/product-design';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),report=[];
try {
 for(const theme of ['yellow','cobalt','navy-light','navy'])for(const width of [320,390,1440]) {
  for(const group of ['members','logbook']) {
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===1440?1000:844},reducedMotion:'reduce'});
   await context.addInitScript(theme=>localStorage.setItem('finfolk-theme',theme),theme);
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000);
   await (group==='members'?mockMembers:mockLogbook)(page,base);
   const cases=group==='members'?[
    ['profile','/profile',()=>page.getByRole('heading',{name:'Alice',exact:true}).waitFor()],
    ['people','/people',()=>page.locator('[data-person=maya]').waitFor()],
    ['profile-edit','/profile/edit',()=>page.getByLabel('Display name',{exact:true}).waitFor()],
   ]:[
    ['sessions','/logbook',()=>page.getByRole('button',{name:'Bondi',exact:true}).waitFor()],
    ['session','/logbook?session=one',()=>page.locator('.session-detail').waitFor()],
    ['session-edit','/logbook',async()=>{await page.getByRole('button',{name:'Log a session',exact:true}).click();await page.getByLabel('Notes',{exact:true}).waitFor();await page.getByLabel('Date',{exact:true}).blur();}],
   ];
   for(const [screen,path,ready]of cases) {
    await page.goto(base+path);await ready();await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
    const root=page.locator(group==='members'?'#profile-main':'#logbook-page');
    const overflow=await root.evaluate(el=>({content:el.scrollWidth,available:el.clientWidth,document:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(overflow.content<=overflow.available+1&&overflow.document<=overflow.viewport+1,`${screen}/${theme}/${width} overflows: ${JSON.stringify(overflow)}`);
    if(screen==='profile') {
     assert.equal(await page.getByText('Closed profile',{exact:true}).isVisible(),true);
     assert.ok(!(await root.innerText()).includes('PRIVATE CONTENT'));
    }
    if(screen==='session-edit') {
     await page.getByLabel('Notes',{exact:true}).fill('Shore session with my buddy.');
     for(const label of ['Date','Beach or location','Duration (minutes, optional)','Maximum depth (metres, optional)','Notes']) {
      const field=page.getByLabel(label,{exact:true}),box=await field.boundingBox();
      assert.ok(box&&box.width>60&&box.height>=44,`${label} must remain usable at ${width}px`);
     }
     const save=page.getByRole('button',{name:'Save private session',exact:true});await save.scrollIntoViewIfNeeded();
     const box=await save.boundingBox();assert.ok(box.height>=44,`Save button height ${box.height} at ${width}px`);
     assert.equal(await page.getByLabel('Notes',{exact:true}).inputValue(),'Shore session with my buddy.');
    }
    // Capture top and lower editor state: the atlas scrolls inside its page.
    if(group==='logbook')await root.evaluate(el=>el.scrollTop=0);
    const prefix=`${out}/${screen}-${theme}-${width}`;
    await page.screenshot({path:prefix+'.png',fullPage:group==='members'});
    if(screen==='session-edit') {await page.getByRole('button',{name:'Save private session',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:prefix+'-save.png'});}
    assert.deepEqual(errors,[]);report.push({screen,theme,width,overflow});
   }
   await context.close();
  }
 }
 await writeFile(out+'/report.json',JSON.stringify(report,null,2));
 console.log(`PRODUCT_DESIGN_PASS: ${report.length} member/logbook/editor views across four themes and 320/390/1440px; private content excluded, forms usable, no horizontal overflow or browser exceptions.`);
}finally {await browser.close();}
