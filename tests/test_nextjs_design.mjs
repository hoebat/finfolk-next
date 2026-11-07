// Original-vs-React capture, read-only and local-only. Reference images are never derived from React.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import {directoryResponse} from './fixtures/nextjs-directory.mjs';
import {chromium} from '@playwright/test';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const directoryHTML=await readFile('js/finfolk-next/site/web-main/src/directory.html','utf8');
const output='.cache/design-parity/directory';await mkdir(output,{recursive:true});
const comparisons=[];
const browser=await chromium.launch({headless:true});
try{for(const [screen,query,expected]of [['list','','Melbourne Freedivers'],['filtered','?category=Group&state=NSW','Coastal Folk'],['empty','?q=nonexistent','No listings found. Try another location or category.'],['page-two','?offset=2','Coastal Folk']])for(const theme of ['yellow','cobalt','navy-light','navy'])for(const [size,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const context=await browser.newContext({serviceWorkers:'block',viewport,reducedMotion:'reduce'});await context.addInitScript(theme=>localStorage.setItem('finfolk-theme',theme),theme);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/v1/directory**',route=>route.fulfill({json:directoryResponse(new URL(route.request().url()).searchParams)}));
 await page.route('**/neon-config.json*',route=>route.fulfill({json:{enabled:false,backbone:true,apiUrl:base+'/',authUrl:'https://auth.invalid'}}));
 await page.route('**/__original-directory*',route=>route.fulfill({contentType:'text/html',body:directoryHTML}));
 await page.goto(base+'/__original-directory'+(query?query+'&':'?')+'screen=directory');await page.getByText(expected,{exact:true}).waitFor();await page.screenshot({path:`${output}/reference-directory-${screen}-${theme}-${size}.png`,fullPage:true});
 await page.goto(base+'/directory'+query);await page.getByText(expected,{exact:true}).waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),theme);await page.locator('.profile-topbar select').selectOption(theme);await page.getByRole('link',{name:'Skip to content'}).count();assert.equal(await page.locator('.profile-footer').count(),1);assert.ok(await page.locator('.ff-nav-item svg').count()>=2);assert.equal(await page.locator('.profile-topbar-actions').count(),1);
 await page.screenshot({path:`${output}/react-directory-${screen}-${theme}-${size}.png`,fullPage:true});
 const reference=PNG.sync.read(await readFile(`${output}/reference-directory-${screen}-${theme}-${size}.png`)),actual=PNG.sync.read(await readFile(`${output}/react-directory-${screen}-${theme}-${size}.png`));
 let ratio=1;if(reference.width===actual.width&&reference.height===actual.height){const diff=new PNG({width:actual.width,height:actual.height});ratio=pixelmatch(reference.data,actual.data,diff.data,actual.width,actual.height,{threshold:0.1})/(actual.width*actual.height);await writeFile(`${output}/diff-directory-${screen}-${theme}-${size}.png`,PNG.sync.write(diff));}comparisons.push({screen,theme,size,ratio,reference:[reference.width,reference.height],actual:[actual.width,actual.height]});
 assert.deepEqual(errors,[],`${theme}/${size}`);await context.close();
 }await writeFile(`${output}/report.json`,JSON.stringify(comparisons,null,2));if(process.argv.includes('--verify'))assert.ok(comparisons.every(x=>x.ratio<=0.005),'Original design parity failed: see .cache/design-parity/directory/report.json and diff images');console.log('DESIGN_CAPTURE_PASS: independent original/React directory captures, fixed local public data, populated/filtered/empty/paginated views, four themes, desktop/mobile and chrome structure.');
}finally{await browser.close();}
