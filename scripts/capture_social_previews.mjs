// Capture the real landing page; no generated artwork or presentation overlays.
// Run after landing changes: node scripts/capture_social_previews.mjs
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '@playwright/test';

const root=resolve('js/finfolk-next/site/web-main/src');
const palette=process.env.OG_THEME==='navy-light'?{id:'navy-light',slug:'salt-paper'}:{id:'yellow',slug:'acid-club'};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const server=createServer(async(req,res)=>{
  try{
    const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!path.startsWith(root+'/')||!(await stat(path)).isFile())throw Error('Not a file');
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(path));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
try{
  // A native 1600 × 840 browser viewport at 75% pixel density yields exactly
  // 1200 × 630, keeping the live page's layout, text, illustrations and controls.
  const page=await browser.newPage({viewport:{width:1600,height:840},deviceScaleFactor:.75,reducedMotion:'reduce',serviceWorkers:'block'});
  await page.addInitScript(id=>localStorage.setItem('finfolk-theme',id),palette.id);
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.goto(base+'/landing.html');
  await page.locator('#landing-signature [role=img]').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  for(const {key,selector,step} of [
    {key:'home'},
    {key:'discover',selector:'[data-feature-demo=locations]',step:2},
    {key:'people',selector:'[data-feature-demo=people]',step:0},
    {key:'logbook',selector:'[data-feature-demo=logs]',step:3},
  ]){
    await page.evaluate(async({selector,step})=>{
      if(!selector){scrollTo({top:0,behavior:'instant'});return;}
      const figure=document.querySelector(selector),article=figure.closest('article');
      const {setDemoStep}=await import('./feature-demos.js');setDemoStep(figure,step);
      const box=article.getBoundingClientRect();scrollTo({top:scrollY+box.top-(innerHeight-box.height)/2-(selector.includes("locations")?40:0),behavior:'instant'});
      await Promise.all([...article.querySelectorAll('img')].map(image=>image.decode()));
    },{selector,step});
    // Wait for the actual page's short opacity transitions and background masks.
    await page.waitForTimeout(350);
    const path=resolve(root,`og-${key}-${palette.slug}-v1.png`);
    await page.screenshot({path});console.log(path);
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
