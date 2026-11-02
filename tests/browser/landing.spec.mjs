import {test,expect} from '@playwright/test';

test('offline navigation keeps the landing page separate from app and deep links',async({page,context})=>{
 await page.goto('/__landing/');
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/__landing/sw.js',{scope:'/__landing/'});await navigator.serviceWorker.ready;});
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await page.evaluate(()=>new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();resolve();};navigator.serviceWorker.controller.postMessage('offline',[channel.port2]);}));
 await context.setOffline(true);
 for(const path of ['/__landing/','/__landing/?utm_source=instagram&fbclid=example','/__landing/?v=2','/__landing/?v=2&utm_source=instagram']){
  await page.goto(path);await expect(page.locator('h1')).toHaveText('FinFolk landing');
 }
 for(const path of ['/__landing/?view=discover','/__landing/?site=bondi','/__landing/app','/__landing/?view=discover&v=2','/__landing/?site=bondi&v=2']){
  await page.goto(path);await expect(page.locator('h1')).toHaveText('FinFolk app');
 }
 await page.goto('/__landing/profiles?screen=people');await expect(page.locator('h1')).toHaveText('FinFolk profiles');
});

test('landing walkthroughs, themes and forecasts work on desktop and mobile',async({page,browserName})=>{
 await page.goto('/landing.html');
 await expect(page.locator('html')).toHaveAttribute('data-theme','yellow');
 await expect(page.locator('#landing-theme')).toHaveValue('yellow');
 await expect(page.locator('#landing-signature [role=img]')).toHaveAttribute('aria-label','FinFolk');
 await expect(page.locator('[data-feature-demo]')).toHaveCount(8);
 await expect(page.locator('.landing-regulars-section [data-feature-demo=regulars] .demo-page')).toHaveCount(7);
 await expect(page.locator('iframe')).toHaveCount(0);
 await expect(page.locator('figcaption')).not.toContainText(['Animated example','Fictional members','Sample data']);
 await expect(page.locator('[data-feature-demo=planning]')).toContainText('Portsea Beach');
 await expect(page.locator('[data-feature-demo=locations] .beach-thumbnail').first()).toHaveAttribute('aria-label','The Basin Beach location in Western Australia');
 await expect(page.locator('[data-feature-demo=logs]')).toContainText('Waubs Beach');
 await expect(page.locator('[data-feature-demo=tiktok-post]')).toContainText('Aldinga Beach');
 await expect(page.locator('.landing-illustration')).toHaveCount(1);
 await expect(page.locator('.landing-story .landing-illustration,.landing-social-feature .landing-illustration')).toHaveCount(0);
 await page.getByRole('button',{name:'Pause animations'}).click();
 await expect(page.locator('[data-feature-demo][data-motion=paused]')).toHaveCount(8);
 const backdrops=new Set();for(const [theme,scene]of [['yellow','ningaloo'],['cobalt','julian-rocks'],['navy-light','bicheno'],['navy','port-phillip']]){await page.locator('#landing-theme').selectOption(theme);await expect(page.locator('.landing-hero .landing-illustration')).toHaveAttribute('data-scene',scene);backdrops.add(await page.locator('.landing-hero .landing-illustration').evaluate(node=>node.style.getPropertyValue('--landing-illustration')));await expect(page.locator('body')).toHaveCSS('background-image','none');expect(await page.evaluate(()=>getComputedStyle(document.body,'::before').content)).toBe('none');}expect(backdrops.size).toBe(4);
 await page.locator('#landing-theme').selectOption('navy');
 await expect(page.locator('html')).toHaveAttribute('data-theme','navy');
 await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:'.cache/landing-backgrounds-'+browserName+'-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:'.cache/landing-backgrounds-'+browserName+'-mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#landing-coast').selectOption('portsea');
 await expect(page.locator('#landing-coast-open')).toHaveAttribute('href','./?view=maps&site=portsea');
 await page.route('https://*.open-meteo.com/**',route=>route.abort());
 await page.getByRole('button',{name:'Load forecast'}).click();
 await expect(page.locator('.conditions-status')).toContainText('Forecast unavailable');
 await expect(page.getByRole('button',{name:'Refresh forecast'})).toBeEnabled();
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.locator('[data-feature-demo][data-motion=paused]')).toHaveCount(8);
 await page.locator('[data-feature-demo=regulars]').scrollIntoViewIfNeeded();
 await page.locator('[data-feature-demo=regulars]').screenshot({path:'.cache/landing-regulars-'+browserName+'-mobile.png'});
 await page.evaluate(async()=>{const {setDemoStep}=await import('/feature-demos.js');setDemoStep(document.querySelector('[data-feature-demo=regulars]'),4);});
 expect(await page.locator('[data-feature-demo=regulars] .demo-page.is-active').evaluate(n=>n.scrollHeight<=n.clientHeight)).toBe(true);
 await page.locator('[data-feature-demo=regulars]').screenshot({path:'.cache/regulars-eight-day-award-'+browserName+'.png'});
 await page.setViewportSize({width:1280,height:900});
 await page.locator('.landing-regulars-section').screenshot({path:'.cache/landing-regulars-'+browserName+'-desktop.png'});
});
