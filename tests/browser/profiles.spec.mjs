import {test,expect} from '@playwright/test';

async function mount(page,{guest=false,location='bondi'}={}){
 await page.goto('/__test?screen=people'+(location?'&location='+location:''));
 await page.evaluate(async guest=>{
  const html=await(await fetch('/profiles.html')).text(),parsed=new DOMParser().parseFromString(html,'text/html');
  for(const link of parsed.querySelectorAll('link[rel=stylesheet]'))document.head.append(link.cloneNode());
  document.body.className='profile-demo';document.body.innerHTML=parsed.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g,'');
  const profile={displayName:'Alice',bio:'Freediving and training.',open:false,instagram:'https://www.instagram.com/alice.dives/',tiktok:'',beaches:['bondi'],availability:['weekend mornings'],experience:'comfortable',sharing:{visits:true},featuredLogs:['public-one','private-one']};
  window.profileState=profile;window.profileCalls=[];window.instagramState={state:'ready',capabilities:{connect:true}};
  const diver={id:'maya',displayName:'Maya',bio:'A diver at Bondi.',open:true,beaches:['bondi'],availability:['weekend mornings'],experience:'experienced',regular:true};
  const logs=[{id:'public-one',visibility:'public',title:'Published freedive',beachId:'bondi',durationMinutes:45,maxDepthMetres:12},{id:'private-one',visibility:'private',title:'PRIVATE NOTES SHOULD NOT APPEAR',notes:'PRIVATE CONTENT'}];
  const connections=[];
  const api={user:guest?null:{uid:'alice',emailVerified:true},async request(path,options){window.profileCalls.push({action:'instagramConnect',path,code:options.body.code});window.instagramState={state:'claimed',capabilities:{connect:true},handle:'alice.dives'};window.profileState.instagram='https://www.instagram.com/alice.dives/';return window.instagramState;},async call(action,values={}){
   window.profileCalls.push({action,...values});
   if(action==='instagramClaimStatus')return window.instagramState;
   if(action==='me')return {id:'alice',profile:window.profileState};
   if(action==='community')return {people:(!values.beachId||values.beachId==='bondi')&&(!values.experience||values.experience===diver.experience)?[diver]:[],cursor:null};
   if(action==='connections')return connections;
   if(action==='profile')return window.restrictedProfile?{id:'maya',restricted:true}:diver;
   if(action==='sessions')return {sessions:logs.map(log=>({...log,ownerId:values.owner||'alice'})),cursor:null};
   if(action==='myPosts')return [{id:'post-one',platform:'tiktok',url:'https://www.tiktok.com/@fixture/video/123456',status:'approved',public_consent:true,beach_name:'Bondi Beach'},{id:'post-private',platform:'instagram',status:'pending',public_consent:false,beach_name:'PENDING POST'}];
   if(action==='stats')return {stats:{visits:3}};
   if(action==='blocks')return [];
   if(action==='preferences'){if(window.failSave)throw Error('Save failed. Try again.');window.profileState={...values.profile};return {profile:window.profileState};}
   if(action==='connection'){if(window.failConnection)throw Error('Connection unavailable. Retry.');connections.push({id:values.target,status:'pending',requested_by:'alice'});return {ok:true};}
   return {ok:true};
  }};
  const {installProfiles}=await import('/profiles.js');
  window.profiles=await installProfiles({api,directory:{beaches:[{id:'bondi',name:'Bondi Beach',state_id:'NSW'},{id:'portsea',name:'Portsea Beach',state_id:'VIC'}]}});
 },guest);
}

test('People filters, real connection outcomes and shared profiles preserve privacy',async({page})=>{
 await mount(page);
 await expect(page.locator('[data-person=maya]')).toBeVisible();
 await page.locator('.people-options > summary').click();
 await page.getByRole('combobox',{name:'Experience',exact:true}).selectOption('new');await expect(page.getByText('Your people are still finding their way here.',{exact:true})).toBeVisible();
 await expect(page).toHaveURL(/experience=new/);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.locator('[data-person=maya]')).toBeVisible();
 await page.getByRole('link',{name:'View profile ↗',exact:true}).click();await expect(page.locator('h1')).toHaveText('Maya');
 await expect(page.locator('[data-public-log]')).toHaveCount(1);await expect(page.locator('body')).not.toContainText('PRIVATE CONTENT');
 await page.evaluate(()=>{window.failConnection=true;});await page.getByRole('button',{name:'Connect',exact:true}).click();
 await expect(page.locator('#profile-status')).toContainText('Connection unavailable');await expect(page.getByRole('button',{name:'Connect',exact:true})).toBeEnabled();
 await page.evaluate(()=>{window.failConnection=false;});await page.getByRole('button',{name:'Connect',exact:true}).click();await expect(page.getByRole('button',{name:'Request sent',exact:true})).toBeDisabled();
 await page.evaluate(()=>{window.restrictedProfile=true;return window.profiles.render();});await expect(page.getByRole('heading',{name:'Profile unavailable'})).toBeVisible();
});

test('profile editor saves portraits and selected public content and preserves failed drafts',async({page})=>{
 await mount(page);await page.evaluate(()=>window.profiles.navigate('edit'));
 await expect(page.locator('.profile-editor [name=featuredLogs]')).toHaveCount(1);
 await expect(page.locator('.profile-editor [name=featuredPosts]')).toHaveCount(1);
 await page.getByLabel('Display name',{exact:true}).fill('Alice Diver');await page.getByLabel('About you',{exact:true}).fill('New biography.');
 await page.getByLabel('TikTok profile URL',{exact:true}).fill('https://www.tiktok.com/@alice.dives/');
 await page.getByLabel('Open — appear in People at your locations',{exact:true}).check();
 const image=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=24;canvas.height=30;const c=canvas.getContext('2d');c.fillStyle='#1641ff';c.fillRect(0,0,24,30);return canvas.toDataURL('image/png').split(',')[1];});
 await page.locator('[name=portrait]').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await expect(page.locator('.profile-form-error')).toContainText('Portrait ready');
 await page.evaluate(()=>{window.failSave=true;});await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.locator('.profile-form-error')).toContainText('Save failed');await expect(page.getByLabel('Display name',{exact:true})).toHaveValue('Alice Diver');
 await page.evaluate(()=>{window.failSave=false;});await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.locator('.member-hero h1')).toHaveText('Alice Diver');
 await expect(page.locator('.member-hero img')).toHaveAttribute('src',/^data:image\/(?:webp|jpeg);base64,/);await expect(page.locator('[data-public-log]')).toHaveCount(1);
 const saved=await page.evaluate(()=>window.profileCalls.filter(call=>call.action==='preferences').at(-1).profile);expect(saved.featuredLogs).toEqual(['public-one']);expect(saved.featuredPosts).toEqual(['post-one']);expect(saved.open).toBe(true);
 await page.getByRole('link',{name:'Edit profile',exact:true}).first().click();await page.getByRole('button',{name:'Remove portrait',exact:true}).click();await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.locator('.member-hero img')).toHaveCount(0);
});

test('guest profiles and five-item navigation fit mobile and retain one responsive logo',async({page})=>{
 await mount(page,{guest:true});await expect(page.getByRole('link',{name:'Sign in or create an account ↗'})).toBeVisible();await expect(page.locator('[data-person]')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('.navigation-logo')).toBeVisible();await expect(page.locator('.navigation-logo')).toHaveCSS('width','36px');
 expect(await page.locator('.ff-primary-nav>.ff-nav-item:visible').count()).toBe(5);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Open menu',exact:true}).click();await expect(page.locator('#local-menu-panel')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#local-menu-panel')).not.toBeVisible();
 await page.setViewportSize({width:1440,height:1000});await expect(page.locator('.navigation-logo')).toHaveCSS('width','146px');
 await page.getByRole('combobox',{name:'Theme',exact:true}).selectOption('navy');await expect(page.locator('html')).toHaveAttribute('data-theme','navy');
});

test('People offers a fresh global mix with optional filters and spot-led browsing',async({page})=>{
 await mount(page,{location:''});await expect(page.locator('.profile-filters')).not.toBeVisible();await expect(page.locator('[data-person=maya]')).toBeVisible();
 const first=await page.evaluate(()=>window.profileCalls.find(c=>c.action==='community'));expect(first.mode).toBe('discover');expect(first.beachId).toBe('');
 await page.getByRole('button',{name:'Mix it up again',exact:true}).click();expect(await page.evaluate(()=>window.profileCalls.filter(c=>c.action==='community').at(-1).seed)).not.toBe(first.seed);
 await page.locator('[data-person=maya] .person-spot').click();await expect(page).toHaveURL(/location=bondi/);await expect(page.locator('.profile-filters')).not.toBeVisible();
 await page.locator('[data-nav=me]').click();await expect(page.locator('[data-nav=me]')).toHaveText('Profile');await expect(page.locator('#instagram-claim')).toBeVisible();
 await page.getByRole('button',{name:'Connect Instagram',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByLabel('Code from your Instagram DM').fill('abcd efgh');await expect(page.getByRole('dialog')).toContainText('Connected to @alice.dives');
 await page.getByRole('button',{name:'Done',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('#instagram-claim')).toContainText('Instagram connected');
 await page.locator('[data-nav=people]').click();await page.getByRole('link',{name:'View profile ↗',exact:true}).click();await expect(page.locator('#instagram-claim')).toHaveCount(0);
});
