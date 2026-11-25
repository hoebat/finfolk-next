// Synthetic reference-map files and basemap only. Auth, site catalogue and notes use real native RPCs.
import assert from 'node:assert/strict';
import {atlasCatalog,atlasContours} from './nextjs-atlas.mjs';
export async function nativeAtlasReferences(page){
 await page.route('https://datasets.finfolk.com.au/**',route=>{
  const path=new URL(route.request().url()).pathname;
  const value=path.endsWith('/data/catalog.json')?atlasCatalog:path.endsWith('/beaches.json')||path.endsWith('/sites-snapshot.json')?{beaches:[],states:[],areas:[],sources:[]}:path.endsWith('/data/beach-summaries.json')?{beaches:[]}:path.endsWith('/guides.json')?{}:path.endsWith('/social.json')?{posts:[]}:path.endsWith('-contours.json')?atlasContours:path.includes('coastline')?{type:'FeatureCollection',features:[]}:{stays:[],surveys:[]};
  return route.fulfill({json:value});
 });
 await page.route('https://datasets.finfolk.com.au/v1/map/providers/openfreemap/**',route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#d8eeeb'}}]}}));
 await page.route('https://datasets.finfolk.com.au/v1/map/providers/osm/**',route=>route.abort());
}
export async function nativeAtlasBrowser({browser,page,origin,siteId}){
 await nativeAtlasReferences(page);
 const calls=[];page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/v1/native/account'){const body=request.postDataJSON();calls.push(body.operation);}});
 await page.goto(origin+'/map?site='+siteId);
 const notes=page.locator('.fm-detail .fn-notes');
 await notes.getByRole('button',{name:'Add note',exact:true}).waitFor();
 await notes.getByRole('button',{name:'Add note',exact:true}).click();
 await notes.getByLabel('Your note',{exact:true}).fill('Browser native map access note.');
 await notes.getByRole('button',{name:'Publish note',exact:true}).click();
 await notes.getByRole('status').filter({hasText:'Your note is published.'}).waitFor();
 await notes.locator('.fn-note-text').filter({hasText:'Browser native map access note.'}).waitFor();
 await page.reload();await notes.locator('.fn-note-text').filter({hasText:'Browser native map access note.'}).waitFor();
 await notes.locator('.fn-note-downvote').click();await notes.locator('.fn-note-downvote[aria-pressed=true]').waitFor();
 await page.reload();await notes.locator('.fn-note-downvote[aria-pressed=true]').waitFor();assert.match(await notes.locator('.fn-note-upvote').innerText(),/-1/);
 await notes.locator('.fn-note-downvote').click();await notes.locator('.fn-note-downvote[aria-pressed=false]').waitFor();
 const context=await browser.newContext({serviceWorkers:'block'});
 let guest;
 try{
  guest=await context.newPage();await nativeAtlasReferences(guest);await guest.addInitScript(()=>localStorage.setItem('finfolk:welcome','1'));await guest.goto(origin+'/map?site='+siteId);
  const publicNotes=guest.locator('.fm-detail .fn-notes');await publicNotes.getByText('Browser native map access note.',{exact:true}).waitFor();
  const backbone=await guest.evaluate(async site=>{const module=await import('/app-backbone.js'),app=await module.applicationBackbone();return {provider:app.authProvider,catalog:app.public.read('siteCatalog',{}),notes:await app.public.call('publicSiteNotes',{site})};},siteId);
  assert.equal(backbone.provider,'supabase');assert.equal(backbone.notes.enabled,true);assert.equal(backbone.notes.notes.length,1,'Legacy helpers must retain the native public transport');
  assert.equal(Object.hasOwn(backbone.catalog.beaches[0],'region_name'),false,'Map adaptation must not mutate native backbone DTOs');
  assert.equal(await publicNotes.getByRole('button',{name:'Remove',exact:true}).count(),0);
  await notes.getByRole('button',{name:'Remove',exact:true}).click();await notes.getByRole('button',{name:'Undo removal',exact:true}).waitFor();
  await guest.reload();await publicNotes.getByText('No community notes yet. Share the first useful detail.',{exact:true}).waitFor();
  await notes.getByRole('button',{name:'Undo removal',exact:true}).click();await notes.getByText('Your note was restored.',{exact:true}).waitFor();
  await guest.reload();await publicNotes.getByText('Browser native map access note.',{exact:true}).waitFor();
 }catch(error){throw new Error(error.message+'\nNative atlas guest page:\n'+await guest.locator('body').innerText(),{cause:error});}finally{await context.close();}
 assert.ok(calls.includes('siteCatalog'),'Map must load the real native catalogue');assert.ok(calls.includes('siteNotes')&&calls.includes('siteNoteSave')&&calls.includes('siteNoteWithdraw'),'Map notes must execute generated native models and actions');
}
