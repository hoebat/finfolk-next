import {test,expect} from '@playwright/test';
async function mount(page,country='AU',state='VIC'){
 await page.route('**/_next/location',route=>route.fulfill({json:{country,state}}));
 await page.goto('/__test');await page.evaluate(async()=>{
 const html=new DOMParser().parseFromString(await(await fetch('/index.html')).text(),'text/html');for(const link of html.querySelectorAll('link[rel=stylesheet]'))document.head.append(link.cloneNode());document.body.innerHTML=html.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g,'');document.getElementById('discover-page').hidden=false;
 for(const id of ['suggest-state','state-filter'])for(const key of ['VIC','NSW','QLD','WA','SA','TAS','ACT','NT']){const option=document.createElement('option');option.value=key;option.textContent=key;document.getElementById(id).append(option);}
 const {installDiscoverPreferences}=await import('/discover-preferences.js');window.preferences=installDiscoverPreferences({catalog:{},refresh(){}});const {installMapSettings}=await import('/map-settings.js');installMapSettings();
 });
}
test('Discover has accessible icon tabs, state selection and public map Settings',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mount(page);
 await expect(page.getByRole('tab',{name:'Suggested',exact:true})).toBeVisible();await expect(page.locator('.discover-tabs svg')).toHaveCount(4);
 await expect(page.locator('#suggest-state')).toHaveValue('VIC');await page.getByRole('button',{name:'NSW',exact:true}).click();await expect(page.locator('#state-filter')).toHaveValue('NSW');await expect(page.getByRole('button',{name:'NSW',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('dialog',{name:'Settings',exact:true})).toBeVisible();await expect(page.locator('#basemap-layer')).toBeVisible();await page.getByRole('button',{name:'Close settings'}).click();await expect(page.locator('.map-settings')).not.toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('overseas visitors keep All Australia and a manual choice overrides location',async({page})=>{
 await mount(page,'NZ',null);await expect(page.locator('#suggest-state')).toHaveValue('');await page.getByRole('button',{name:'All Australia',exact:true}).click();await expect(page).toHaveURL(/all_states=1/);await page.getByRole('button',{name:'WA',exact:true}).click();await expect(page.locator('#suggest-state')).toHaveValue('WA');
});
