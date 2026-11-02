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

test('landing previews, palette synchronisation and forecast recovery work on desktop and mobile',async({page})=>{
 // Isolate the landing interactions from account services and app startup.
 await page.route(/\/\?view=/,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>FinFolk app preview</title><p>App preview</p>'}));
 await page.route(/\/profiles\?/,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>FinFolk People</title><p>People</p>'}));
 await page.goto('/landing.html');
 await expect(page.locator('#landing-signature [role=img]')).toHaveAttribute('aria-label','FinFolk');
 await expect(page.locator('.landing-hero')).not.toHaveClass(/landing-scene/);
 await expect(page.locator('.landing-story')).not.toHaveClass(/landing-scene/);
 await expect(page.locator('.landing-conditions')).not.toHaveClass(/landing-scene/);
 const illustrated=page.locator('.landing-story-intro');await illustrated.scrollIntoViewIfNeeded();
 await expect(illustrated).toHaveCSS('--landing-scene',/ningaloo-acid-light-v1.webp/);
 const log=page.locator('.landing-chapter-copy [data-demo-route=logbook]');
 await log.click();
 await expect(page.locator('#landing-demo')).toBeVisible();
 await expect(page.locator('#landing-demo-frame')).toHaveAttribute('src','./?view=logbook');
 await page.keyboard.press('Escape');
 await expect(page.locator('#landing-demo')).not.toBeVisible();
 await expect(log).toBeFocused();
 await page.locator('.landing-chapter-copy [data-demo-route=people]').click();
 await expect(page.locator('#landing-demo-frame')).toHaveAttribute('src','./profiles?screen=people&location=bondi');
 await page.keyboard.press('Escape');
 const preview=page.frames().find(frame=>frame.url().includes('?view=discover'));
 await preview.evaluate(async()=>{const {setTheme}=await import('/theme.js');setTheme('navy');});
 await expect(page.locator('html')).toHaveAttribute('data-theme','navy');
 await expect(illustrated).toHaveCSS('--landing-scene',/ningaloo-muted-dark-v1.webp/);
 await page.setViewportSize({width:390,height:844});
 await expect(illustrated).toHaveCSS('--landing-scene',/ningaloo-muted-dark-mobile-v1.webp/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#landing-coast').selectOption('portsea');
 await expect(page.locator('#landing-coast-open')).toHaveAttribute('href','./?view=maps&site=portsea');
 await page.route('https://*.open-meteo.com/**',route=>route.abort());
 await page.getByRole('button',{name:'Load forecast'}).click();
 await expect(page.locator('.conditions-status')).toContainText('Forecast unavailable');
 await expect(page.getByRole('button',{name:'Refresh forecast'})).toBeEnabled();
});
