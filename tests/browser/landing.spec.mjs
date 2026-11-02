import {test,expect} from '@playwright/test';

test('offline navigation keeps the landing page separate from app and deep links',async({page,context})=>{
 await page.goto('/__landing/');
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/__landing/sw.js',{scope:'/__landing/'});await navigator.serviceWorker.ready;});
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await page.evaluate(()=>new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();resolve();};navigator.serviceWorker.controller.postMessage('offline',[channel.port2]);}));
 await context.setOffline(true);
 for(const path of ['/__landing/','/__landing/?utm_source=instagram&fbclid=example']){
  await page.goto(path);await expect(page.locator('h1')).toHaveText('FinFolk landing');
 }
 for(const path of ['/__landing/?view=discover','/__landing/?site=bondi','/__landing/app']){
  await page.goto(path);await expect(page.locator('h1')).toHaveText('FinFolk app');
 }
 await page.goto('/__landing/profiles?screen=people');await expect(page.locator('h1')).toHaveText('FinFolk profiles');
});

test('landing walkthroughs, themes and forecasts work on desktop and mobile',async({page,browserName})=>{
 await page.goto('/landing.html');
 await expect(page.locator('#landing-signature [role=img]')).toHaveAttribute('aria-label','FinFolk');
 await expect(page.locator('[data-feature-demo]')).toHaveCount(7);
 await expect(page.locator('iframe')).toHaveCount(0);
 await expect(page.locator('.landing-illustration')).toHaveCount(4);
 await expect(page.locator('.landing-story .landing-illustration,.landing-social-feature .landing-illustration')).toHaveCount(0);
 await page.getByRole('button',{name:'Pause animations'}).click();
 await expect(page.locator('[data-feature-demo][data-motion=paused]')).toHaveCount(7);
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
 await expect(page.locator('[data-feature-demo][data-motion=paused]')).toHaveCount(7);
});
