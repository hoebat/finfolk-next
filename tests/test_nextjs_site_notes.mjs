import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {mockMapTools} from './fixtures/nextjs-map.mjs';
import {postsModule} from './fixtures/nextjs-posts.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3329';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();await mkdir('.cache/site-notes',{recursive:true});
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1000},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await mockMapTools(page,base);
 const fake=postsModule+`\nconst oldRequest=api.request.bind(api);api.request=async function(path,options={}){if(!/\\/sites\\/[^/]+\\/notes/.test(path))return oldRequest(path,options);if(!user)throw Error('Sign in first.');const response=await fetch(path,{method:options.method||'GET',headers:{'Content-Type':'application/json','X-Notes-Actor':user.uid},...(options.body?{body:JSON.stringify(options.body)}:{})});const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'Notes failed'),{status:response.status});return value.data;};`;
 await page.route('**/neon-client.js',r=>r.fulfill({contentType:'text/javascript',body:fake}));
 const seed=[{id:'11111111-1111-4111-8111-111111111111',site:'bondi',topic:'access',text:'Agree on a meeting point before the group arrives.',author:'Maya',createdAt:'2026-11-01T00:00:00Z',observedOn:null,revision:1,score:8,own:false,upvoted:false},{id:'22222222-2222-4222-8222-222222222222',site:'bondi',topic:'conditions',text:'A dated observation from a previous visit.',author:'Kai',createdAt:'2026-11-03T00:00:00Z',observedOn:'2026-11-02',revision:1,score:3,own:false,upvoted:false}],entries=structuredClone(seed),requests=[];let fail=false,enabled=true,slowVote=null,releaseVote;
 await page.route(/\/v1\/(?:me\/)?sites\/[^/]+\/notes/,async route=>{
  const request=route.request(),url=new URL(request.url()),match=url.pathname.match(/\/sites\/([^/]+)\/notes(?:\/(.+))?$/),site=match[1],action=match[2],member=url.pathname.includes('/me/'),actor=request.headers()['x-notes-actor'];requests.push({path:url.pathname,member,actor});
  if(fail)return route.fulfill({status:503,json:{error:'Temporary notes failure'}});
  const reply=data=>route.fulfill({json:member?{data}:data});
  if(!action){let rows=entries.filter(n=>n.site===site&&!n.withdrawn);const topic=url.searchParams.get('topic')||'all';if(topic!=='all')rows=rows.filter(n=>n.topic===topic);rows.sort(url.searchParams.get('sort')==='newest'?(a,b)=>b.createdAt.localeCompare(a.createdAt):(a,b)=>b.score-a.score);return reply({enabled,notes:enabled?rows.map(n=>({...n,own:member&&n.author==='Alice',upvoted:member&&!!n.upvoted})):[],next:null});}
  const value=request.postDataJSON();if(action==='save'){assert.equal(value.site,undefined);entries.push({id:value.id,site,topic:value.topic,text:value.text,observedOn:value.observedOn,author:'Alice',createdAt:new Date().toISOString(),score:0,revision:1,upvoted:false});return reply({id:value.id,revision:1});}
  const note=entries.find(n=>n.id===value.id);assert.ok(note);assert.equal(note.site,site);
  if(action==='vote'){if(slowVote)await new Promise(resolve=>releaseVote=resolve);if(note.upvoted!==value.upvoted)note.score+=value.upvoted?1:-1;note.upvoted=value.upvoted;return reply(note);}
  if(action==='withdraw'){note.withdrawn=value.withdrawn;note.revision++;return reply({id:note.id,revision:note.revision,withdrawn:note.withdrawn});}
  if(action==='report')return reply({reported:true});return route.fulfill({status:404,json:{error:'Unexpected action'}});
 });
 await page.route('https://tiles.openfreemap.org/**',r=>r.abort());await page.goto(base+'/map?site=bondi');const notes=page.locator('.fm-detail .fn-notes');await notes.locator('.fn-note').first().waitFor();assert.equal(await notes.locator('.fn-note').count(),2);
 await notes.getByRole('button',{name:'Upvote note by Maya',exact:true}).click();await notes.getByRole('button',{name:'Remove upvote from note by Maya',exact:true}).waitFor();assert.match(await notes.locator('.fn-note').first().locator('.fn-note-upvote').innerText(),/9/);
 await notes.getByRole('button',{name:'Remove upvote from note by Maya',exact:true}).click();await notes.getByRole('button',{name:'Upvote note by Maya',exact:true}).waitFor();
 await notes.getByRole('combobox',{name:'Sort community notes',exact:true}).selectOption('newest');await notes.locator('.fn-note').first().filter({hasText:'Kai'}).waitFor();
 await notes.getByRole('combobox',{name:'Filter community notes',exact:true}).selectOption('conditions');await page.waitForFunction(()=>document.querySelectorAll('.fm-detail .fn-note').length===1);
 await notes.getByRole('button',{name:'+ Add note',exact:true}).click();await notes.getByRole('textbox',{name:'Your note',exact:true}).fill('A published note with <b>literal</b> markup.');await notes.getByRole('combobox',{name:'New note topic',exact:true}).selectOption('facilities');await notes.getByRole('button',{name:'Publish note',exact:true}).click();await notes.locator('.fn-note').filter({hasText:'literal'}).waitFor();assert.equal(await notes.locator('.fn-note-text b').count(),0);assert.equal(await notes.locator('.fn-note').count(),3);
 await notes.getByRole('button',{name:'Remove',exact:true}).click();await notes.getByRole('button',{name:'Undo removal',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelectorAll('.fm-detail .fn-note').length===2);await notes.getByRole('button',{name:'Undo removal',exact:true}).click();await notes.locator('.fn-note').filter({hasText:'literal'}).waitFor();
 await notes.getByRole('button',{name:'Report',exact:true}).first().click();await notes.getByRole('textbox',{name:'What should we review?',exact:true}).fill('Please review this location detail.');await notes.getByRole('button',{name:'Send report',exact:true}).click();await notes.getByText('Report sent for review.',{exact:true}).waitFor();
 await notes.getByRole('heading',{name:/Community notes/}).scrollIntoViewIfNeeded();await page.screenshot({path:'.cache/site-notes/native-'+width+'.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // A late private mutation cannot put its result or undo controls into a guest view.
 slowVote=true;await notes.getByRole('button',{name:'Upvote note by Maya',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.fn-note-upvote')?.disabled);await page.evaluate(()=>window.signOutAccountFixture());await notes.getByRole('link',{name:'Sign in to add a note or upvote',exact:false}).waitFor();if(releaseVote)releaseVote();assert.equal(await notes.getByRole('button',{name:'Remove',exact:true}).count(),0);assert.equal(await notes.getByRole('button',{name:'Undo removal',exact:true}).count(),0);assert.equal(await notes.locator('.fn-note-upvote').count(),0);
 enabled=false;await page.goto(base+'/map?site=portsea');await notes.getByText('Community notes are being prepared for this site.',{exact:true}).waitFor();assert.equal(await notes.locator('.fn-note').count(),0);
 fail=true;await page.reload();await notes.getByRole('button',{name:'Retry notes',exact:true}).waitFor();fail=false;await notes.getByRole('button',{name:'Retry notes',exact:true}).click();await notes.getByText('Community notes are being prepared for this site.',{exact:true}).waitFor();
 assert.ok(requests.some(r=>r.member)&&requests.some(r=>!r.member));assert.deepEqual(errors,[]);await context.close();
 }
 console.log('NATIVE_SITE_NOTES_UI_PASS: member/public transport, vote/unvote, sorting, topics, publishing, withdrawal/undo, reports, logout fences, disabled/error states and phone/desktop layout.');
}finally{await browser.close();}
