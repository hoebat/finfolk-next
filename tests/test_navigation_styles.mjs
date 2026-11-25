import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

// Exercise the rendered rail before any layout effect adds classes to body.
const root=new URL('../js/finfolk-next/site/web-main/',import.meta.url);
const names=['style','glass','mobile','logbook','finfolk','community','instagram-connect','identity','appearance','filters','navigation','profiles'];
const css=(await Promise.all(names.map(name=>readFile(new URL('src/'+name+'.css',root),'utf8')))).join('\n')+'\n'+await readFile(new URL('app/account-widget.css',root),'utf8');
const appearance=await readFile(new URL('src/appearance.js',root),'utf8');
const browser=await chromium.launch();
try {
 for(const width of [1440,390])for(const theme of ['yellow','cobalt','navy-light','navy']){
  const page=await browser.newPage({viewport:{width,height:1000}});
  await page.setContent(`<html data-theme="yellow"><head><style>${css}</style></head><body><aside class="sidebar app-rail"><a class="brand" href="/">FinFolk</a><nav class="primary-nav ff-primary-nav"><a class="ff-nav-item" href="/map">Explore</a><a class="ff-nav-item" href="/you" aria-current="page">You</a></nav><div class="ff-utility-menu"><button class="ff-menu-toggle" id="local-menu-toggle">Your account</button><nav class="ff-menu-panel" id="local-menu-panel"><a href="/profile">View profile</a><a href="/account/settings">Settings</a></nav></div></aside><main>Content</main></body></html>`);
  await page.addScriptTag({content:appearance});
  await page.evaluate(theme=>FinFolkAppearance.apply(theme),theme);
  const snapshot=()=>page.evaluate(()=>{
   const nav=document.querySelector('.ff-primary-nav'),link=nav.firstElementChild,style=getComputedStyle(nav),box=nav.getBoundingClientRect();
   return {display:style.display,direction:style.flexDirection,position:style.position,background:style.backgroundColor,link:getComputedStyle(link).color,width:box.width,left:box.left,top:box.top,columns:getComputedStyle(document.body).gridTemplateColumns};
  });
  const before=await snapshot();
  assert.equal(before.display,width>900?'flex':'grid');
  assert.equal(before.position,width>900?'static':'fixed');
  await page.evaluate(()=>document.body.classList.add('finfolk-navigation-enabled','finfolk-app-navigation'));
  assert.deepEqual(await snapshot(),before,`${theme} / ${width}: navigation must not change on hydration`);
  const menu=page.locator('.ff-menu-panel'),link=menu.locator('a').first();
  const colors=await menu.evaluate(el=>({ink:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor,shadow:getComputedStyle(el).boxShadow}));
  assert.equal(await link.evaluate(el=>getComputedStyle(el).color),colors.ink);
  assert.equal(colors.shadow,'none');
  await link.hover();
  assert.equal(await link.evaluate(el=>getComputedStyle(el).backgroundColor),colors.ink);
  assert.equal(await link.evaluate(el=>getComputedStyle(el).color),await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor));
  await menu.evaluate(el=>el.hidden=true);
  assert.equal(await menu.isVisible(),false);
  await page.close();
 }
 console.log('NAVIGATION_STYLES_PASS: first paint matches hydrated navigation at desktop/mobile sizes; dropdown colours, hover and hidden state follow all four themes.');
}finally{await browser.close();}
