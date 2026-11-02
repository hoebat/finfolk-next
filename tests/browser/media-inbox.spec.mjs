import {test,expect} from '@playwright/test';

test('tagged media can be reviewed and attached with explicit public consent',async({page})=>{
 await page.goto('/__test');
 await page.evaluate(async()=>{
  for(const name of ['style.css','logbook.css','finfolk.css','identity.css','appearance.css']){const link=document.createElement('link');link.rel='stylesheet';link.href='/'+name;document.head.append(link);}
  const {setTheme}=await import('/theme.js');setTheme('yellow');
  document.body.innerHTML='<main class="logbook-page" id="logbook-page"></main>';
  const item={id:crypto.randomUUID(),platform:'instagram',url:'https://www.instagram.com/reel/fixture/',day:'2026-11-01',locationName:'Bondi Beach',beachId:'bondi',notes:'',candidates:[]};
  window.importCalls=[];
  const api={user:{uid:'alice'},async call(action,v){window.importCalls.push({action,...v});if(action==='mediaInbox')return {items:[item],instagram:{connected:true,ownerVerified:true,collecting:true},limit:100};if(action==='tiktokStatus')return {ready:false,connected:false};if(action==='assignImportedMedia')return {id:'session-1'};return {ok:true};},async list(){return {sessions:[{id:'session-1',date:'2026-11-01',locationName:'Bondi Beach',visibility:'public'}],more:false};}};
  const {mediaInbox}=await import('/media-inbox.js');window.inbox=mediaInbox({api,getBeaches:()=>[{id:'bondi',name:'Bondi Beach',state:'NSW'}],createSession:item=>{window.createdImport=item;},openSession:id=>{window.openedSession=id;},openProfile(){}});document.getElementById('logbook-page').append(window.inbox.root);
 });
 await expect(page.getByRole('heading',{name:'Tagged media'})).toBeVisible();
 await page.getByLabel('Additional information').fill('Shore session with my buddy.');
 await page.getByRole('button',{name:'Add to a session',exact:true}).click();
 await page.getByLabel('Session for imported media').selectOption('session-1');
 await page.getByRole('button',{name:'Add selected post'}).click();
 await expect(page.getByRole('status')).toContainText('Confirm the post link');
 await page.getByLabel('Allow this original post link to appear').check();
 await page.getByRole('button',{name:'Add selected post'}).click();
 await expect.poll(()=>page.evaluate(()=>window.openedSession)).toBe('session-1');
 expect(await page.evaluate(()=>window.importCalls.find(c=>c.action==='assignImportedMedia').publicConsent)).toBe(true);
 await page.setViewportSize({width:390,height:844});
 expect(await page.locator('.media-inbox').evaluate(root=>root.scrollWidth<=root.clientWidth)).toBe(true);
 await page.screenshot({path:'.cache/test-results/media-inbox-mobile.png'});
 await page.getByRole('button',{name:'Create private session'}).click();
 await expect.poll(()=>page.evaluate(()=>window.createdImport?.notes)).toBe('Shore session with my buddy.');
});
