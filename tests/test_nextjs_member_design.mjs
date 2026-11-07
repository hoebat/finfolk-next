// Independent legacy renderers and native React use the same deterministic member fixtures.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {PNG} from 'pngjs';import pixelmatch from 'pixelmatch';
import {mockMembers} from './fixtures/nextjs-members.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const html=(await readFile('js/finfolk-next/site/web-main/src/profiles.html','utf8')).replace('<head>','<head><base href="/">');
const out='.cache/design-parity/members';await mkdir(out,{recursive:true});const report=[];
const cases=process.env.MEMBER_DESIGN_CASES?process.env.MEMBER_DESIGN_CASES.split(','):['people','me','member','edit'];
const screens={people:['/people','Discover your FinFolk.'],me:['/profile','Alice'],member:['/members/maya','Maya'],edit:['/profile/edit','Edit profile']};
const browser=await chromium.launch({headless:true});
try{for(const screen of cases)for(const theme of ['yellow','cobalt','navy-light','navy'])for(const [size,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const context=await browser.newContext({serviceWorkers:'block',viewport,reducedMotion:'reduce'});await context.addInitScript(theme=>localStorage.setItem('finfolk-theme',theme),theme);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await mockMembers(page,base);
 await page.route('**/__original-members*',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(base+'/__original-members?screen='+screen+(screen==='member'?'&id=maya':''));await page.getByRole('heading',{name:screens[screen][1],exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('#profile-main')?.getAttribute('aria-busy')!=='true');
 const prefix=`${out}/${screen}-${theme}-${size}`;await page.screenshot({path:prefix+'-reference.png',fullPage:true});
 await page.goto(base+screens[screen][0]);await page.getByRole('heading',{name:screens[screen][1],exact:true}).first().waitFor();if(screen==='people')await page.locator('[data-person=maya]').waitFor();if(screen==='me')await page.getByRole('heading',{name:'Your buddies',exact:true}).waitFor();if(screen==='member')await page.getByRole('heading',{name:'Shared statistics',exact:true}).waitFor();if(screen==='edit')await page.getByLabel('Display name',{exact:true}).waitFor();
 await page.screenshot({path:prefix+'-react.png',fullPage:true});const reference=PNG.sync.read(await readFile(prefix+'-reference.png')),actual=PNG.sync.read(await readFile(prefix+'-react.png'));let ratio=1;
 if(reference.width===actual.width&&reference.height===actual.height){const diff=new PNG({width:actual.width,height:actual.height});ratio=pixelmatch(reference.data,actual.data,diff.data,actual.width,actual.height,{threshold:.1})/(actual.width*actual.height);await writeFile(prefix+'-diff.png',PNG.sync.write(diff));}
 report.push({screen,theme,size,ratio,reference:[reference.width,reference.height],actual:[actual.width,actual.height]});assert.deepEqual(errors,[]);await context.close();
 }await writeFile(out+'/report.json',JSON.stringify(report,null,2));if(process.argv.includes('--verify'))assert.ok(report.every(x=>x.ratio<=.005),'Member design parity failed; see .cache/design-parity/members/report.json');console.log('MEMBER_DESIGN_CAPTURE_PASS: deterministic original/native member screenshots. Verification '+(process.argv.includes('--verify')?'passed':'not requested')+'.');
}finally{await browser.close();}
