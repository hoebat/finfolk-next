import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createAPI} from '../backend/api.mjs';
import {normalizeTikTok,syncTikTok} from '../backend/tiktok.mjs';
import {taggedForFinFolk} from '../backend/media-imports.mjs';
const pg=process.env.FINFOLK_TEST_DATABASE_URL?await(await import('./db/harness.mjs')).compatDatabase(true):new PGlite();
const query=async(sql,args=[]) => (await pg.query(sql,args)).rows;
const db={query,transaction:fn=>pg.transaction(tx=>fn(async(sql,args=[]) => (await tx.query(sql,args)).rows))};
const env={DB_BACKBONE_ENABLED:'true',TIKTOK_IMPORT_ENABLED:'true',TIKTOK_CLIENT_KEY:'fixture-app',TIKTOK_CLIENT_SECRET:'fixture-secret',MESSAGING_ENCRYPTION_KEY:Buffer.alloc(32,4).toString('base64'),INSTAGRAM_DISCOVERY_ENABLED:'true'};
let providerCalls=0,tokenCalls=0,failList=false,removedVideo=false;
const token={open_id:'verified-open-id',access_token:'PRIVATE_ACCESS',refresh_token:'PRIVATE_REFRESH',expires_in:86400,refresh_expires_in:864000,scope:'user.info.basic,video.list'};
const fetcher=async(url,init)=>{
 providerCalls++;assert.ok(!String(url).includes('PRIVATE_'));
 if(String(url).includes('/oauth/revoke/'))return Response.json({});
 if(String(url).includes('/oauth/token/')){tokenCalls++;assert.match(init.body.toString(),/client_secret=fixture-secret/);return Response.json(token);}
 assert.equal(init.headers.Authorization,'Bearer PRIVATE_ACCESS');
 if(String(url).includes('/user/info/'))return Response.json({data:{user:{open_id:token.open_id,display_name:'Fixture diver'}},error:{code:'ok'}});
 if(String(url).includes('/video/query/'))return Response.json({data:{videos:removedVideo?[]:[{id:'123456'}]},error:{code:'ok'}});
 if(String(url).includes('/video/list/')){if(failList)return Response.json({error:{code:'rate_limit_exceeded'}},{status:429});return Response.json({data:{videos:[{id:'123456',create_time:1793485800,video_description:'Bondi Beach @finfolk.com.au',share_url:'https://www.tiktok.com/@fixture/video/123456?track=1'},{id:'987',create_time:1793485800,video_description:'@finfolk.com.au.evil Bondi Beach',share_url:'https://www.tiktok.com/@fixture/video/987'}],has_more:false},error:{code:'ok'}});}
 throw Error('Unexpected TikTok endpoint');
};
let app;
async function call(action,values={},uid='alice'){
 const response=await app.fetch(new Request('https://finfolk.com.au/api',{method:'POST',headers:{Authorization:'Bearer '+uid,'Content-Type':'application/json'},body:JSON.stringify({action,...values})}),env);
 const body=await response.json();if(!response.ok)throw Object.assign(Error(body.error?.message||body.error),{status:response.status});return body.data;
}
const callback=async(url,cookie)=>app.fetch(new Request(url,{headers:cookie?{Cookie:cookie}:{}}),env);
try{
 await pg.exec('DO $$ BEGIN CREATE ROLE finfolk_api NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; CREATE SCHEMA neon_auth; CREATE TABLE neon_auth."user"(id text PRIMARY KEY,name text,"emailVerified" boolean,banned boolean);');
 for(const file of(await readdir('backend/migrations')).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile('backend/migrations/'+file,'utf8'));
 await query(`INSERT INTO neon_auth."user" VALUES('alice','Alice',true,false),('bob','Bob',true,false)`);
 await query("INSERT INTO finfolk.beaches(id,name,timezone) VALUES('bondi','Bondi Beach','Australia/Sydney')");
 await pg.exec('GRANT USAGE ON SCHEMA finfolk TO finfolk_api; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA finfolk TO finfolk_api; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA finfolk TO finfolk_api;');
 await pg.exec('SET ROLE finfolk_api;');
 app=createAPI({db,verify:async sub=>({sub}),messagingFetch:fetcher});await call('me');await call('me',{},'bob');
 await query("INSERT INTO finfolk.instagram_connections(user_id,handle,media_owner_id,status) VALUES('alice','fixture','881','connected'),('bob','same-handle','882','connected')");
 for(const [mediaId,authorId,owner,caption,sources] of [['10','881','alice','Bondi Beach @finfolk.com.au',['caption:10']],['11','881','alice','No caption tag',['tags']],['12','881','alice','Just #freediving',['hashtag:1']],['13','882','bob','@finfolk.com.au',['caption:13']],['14','wrong-owner','alice','@finfolk.com.au',['tags']],['15','881','alice','@finfolk.com.au.evil',['caption:15']]]){
  await query(`INSERT INTO finfolk.instagram_discoveries(media_id,url,author_id,owner_id,caption,sources,posted_at,beach_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,'2026-10-31T14:30:00Z','bondi')`,[mediaId,'https://www.instagram.com/reel/fixture'+mediaId+'/',authorId,owner,caption,JSON.stringify(sources)]);
 }
 let inbox=await call('mediaInbox');assert.equal(inbox.items.length,2);assert.equal(inbox.items[0].day,'2026-11-01','Beach timezone determines the calendar day');assert.equal(inbox.items[0].locationName,'Bondi Beach');
 assert.equal((await call('sessions')).sessions.length,0,'Imports do not create sessions');assert.equal((await call('myCheckins')).length,0,'Imports never create visits');
 assert.equal((await call('mediaInbox')).items.length,2,'Collection is idempotent');
 const item=inbox.items[0];await assert.rejects(()=>call('updateImportedMedia',{id:item.id,values:{}},'bob'),e=>e.status===404);
 await call('updateImportedMedia',{id:item.id,values:{day:'2026-10-30',locationName:'My shore spot',notes:'Private import notes'}});
 await assert.rejects(()=>call('updateImportedMedia',{id:item.id,values:{day:'2026-02-30'}}),e=>e.status===400);
 inbox=await call('mediaInbox');assert.equal(inbox.items.find(i=>i.id===item.id).notes,'Private import notes','Polling preserves edits');
 const key=randomUUID(),values={date:'2026-10-30',locationName:'My shore spot',notes:'Session notes'};
 const saved=await call('assignImportedMedia',{id:item.id,key,values});assert.equal((await call('assignImportedMedia',{id:item.id,key,values})).id,saved.id,'Retries do not create another session');
 let session=await call('session',{id:saved.id});assert.equal(session.linkedMedia.length,1);assert.equal(session.visibility,'private');assert.equal(session.maxDepthMetres,null);assert.equal(session.durationMinutes,null);assert.ok(!JSON.stringify(session).includes('Private import notes'));
 await assert.rejects(()=>call('session',{id:saved.id},'bob'),e=>e.status===404);
 await call('visibility',{id:saved.id,visibility:'public'});session=await call('session',{id:saved.id},'bob');assert.equal(session.linkedMedia.length,1);
 const other=inbox.items.find(i=>i.id!==item.id);
 await assert.rejects(()=>call('assignImportedMedia',{id:other.id,key:randomUUID(),sessionId:saved.id}),e=>e.status===409);
 await call('assignImportedMedia',{id:other.id,key:randomUUID(),sessionId:saved.id,publicConsent:true});
 await assert.rejects(()=>call('assignImportedMedia',{id:other.id,key:randomUUID(),values}),e=>e.status===409);
 if(process.env.FINFOLK_TEST_DATABASE_URL){
  await call('assignImportedMedia',{id:other.id,key:randomUUID(),sessionId:null});
  const concurrentKey=randomUUID(),results=await Promise.all([call('assignImportedMedia',{id:other.id,key:concurrentKey,values}),call('assignImportedMedia',{id:other.id,key:concurrentKey,values})]);assert.equal(results[0].id,results[1].id,'Competing retries create one session');await call('deleteSession',{id:results[0].id});
 }
 await call('deleteSession',{id:saved.id});assert.equal((await call('mediaInbox')).items.length,2,'Deleting a session returns imports to the inbox');
 await call('hideImportedMedia',{id:item.id});assert.equal((await call('mediaInbox')).items.length,1,'A hidden post is not re-imported');
 await query("UPDATE finfolk.instagram_discoveries SET state='unavailable' WHERE media_id=$1",[other.url.match(/fixture(\d+)/)[1]]);assert.equal((await call('mediaInbox')).items.length,0,'Unavailable source posts disappear');
 for(const text of ['@finfolk.com.au','Hi @FINFOLK.COM.AU!'])assert.ok(taggedForFinFolk(text));for(const text of ['x@finfolk.com.au','@finfolk.com.au.evil','@finfolk.com.au_foo','@@finfolk.com.au'])assert.equal(taggedForFinFolk(text),false);
 assert.equal(normalizeTikTok({id:'123',share_url:'https://evil.test/@x/video/123',video_description:'@finfolk.com.au',create_time:10000}),null);
 assert.equal((await call('tiktokStatus')).connected,false);
 // Cookie-bound, one-use OAuth state, with no exchange on invalid callback.
 const start=await app.fetch(new Request('https://finfolk.com.au/api',{method:'POST',headers:{Authorization:'Bearer alice','Content-Type':'application/json'},body:JSON.stringify({action:'tiktokConnect'})}),env);
 const authorization=new URL((await start.json()).data.url),cookie=start.headers.get('Set-Cookie').split(';')[0];assert.match(start.headers.get('Set-Cookie'),/Secure; HttpOnly; SameSite=Lax/);assert.equal(authorization.origin,'https://www.tiktok.com');
 const cb=authorization.searchParams.get('redirect_uri')+'?state='+authorization.searchParams.get('state')+'&code=PRIVATE_CODE';
 assert.equal((await callback(cb)).status,400);assert.equal(tokenCalls,0);
 assert.equal((await callback(cb+'&redirect_uri=https://evil.test',cookie)).status,303);assert.equal(tokenCalls,1);
 assert.equal((await callback(cb,cookie)).status,400);assert.equal(tokenCalls,1,'State cannot be replayed');
 const status=await call('tiktokStatus');assert.equal(status.connected,true);assert.ok(!JSON.stringify(status).includes('PRIVATE_'));
 const row=(await query("SELECT credential_ciphertext FROM finfolk.tiktok_connections WHERE user_id='alice'"))[0];assert.ok(!row.credential_ciphertext.includes('PRIVATE_'));
 await call('tiktokSync');inbox=await call('mediaInbox');assert.equal(inbox.items.length,1);assert.equal(inbox.items[0].platform,'tiktok');assert.equal(inbox.items[0].url,'https://www.tiktok.com/@fixture/video/123456');
 await query("UPDATE finfolk.tiktok_connections SET next_at=now(),access_expires_at=now()-interval '1 minute' WHERE user_id='alice'");await call('tiktokSync');assert.equal(tokenCalls,2,'Expired access tokens refresh server-side');assert.equal((await call('mediaInbox')).items.length,1);
 failList=true;await query("UPDATE finfolk.tiktok_connections SET next_at=now() WHERE user_id='alice'");await assert.rejects(()=>call('tiktokSync'),e=>e.status===503);assert.equal((await call('mediaInbox')).items.length,1,'Rate limiting preserves existing imports');
 failList=false;removedVideo=true;await query("UPDATE finfolk.tiktok_connections SET next_at=now() WHERE user_id='alice'");await call('tiktokSync');assert.equal((await call('mediaInbox')).items.length,0,'Explicit provider revalidation removes unavailable videos');
 await call('tiktokDisconnect');assert.equal((await call('mediaInbox')).items.length,0);assert.equal((await call('tiktokStatus')).connected,false);
 console.log('MEDIA_IMPORTS_PASS: verified Instagram/TikTok ownership, exact tags, timezone dates, private inbox edits, idempotent atomic session assignment, consent, source removal, OAuth nonce/state, encrypted tokens, refresh and rate limiting.');
}finally{await pg.close();}
