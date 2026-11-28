import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {nativeSQLFixture} from './fixtures/native-sql.mjs';
import {publicSessionMedia} from '../js/finfolk-next/site/web-main/src/logbook-model.js';
const {db,query,rpc}=await nativeSQLFixture(),owner=randomUUID(),other=randomUUID();
try{
 await rpc('sync_account_identity',[owner,true]);await rpc('sync_account_identity',[other,true]);
 const {id}=await rpc('save_private_session',[owner,null,{date:'2026-11-28',locationName:'Port Melbourne Beach',notes:'A public session',dives:[{depthMetres:10}]}]);
 const links=[
  {id:'ig',platform:'instagram',url:'https://www.instagram.com/p/abc/?tracking=private',notes:'PRIVATE_INBOX_NOTE',token:'PRIVATE_TOKEN'},
  {id:'tt',platform:'tiktok',url:'https://www.tiktok.com/@diver/video/123456789#private',kind:'video',candidates:['PRIVATE_CANDIDATE']},
  {id:'bad',platform:'instagram',url:'javascript:alert(1)'},
  {id:'host',platform:'instagram',url:'https://www.instagram.com.evil.test/p/abc/'},
  {id:'credential',platform:'instagram',url:'https://user:secret@www.instagram.com/p/abc/'},
  {id:'mismatch',platform:'tiktok',url:'https://www.instagram.com/p/abc/'},
  {id:'port',platform:'instagram',url:'https://www.instagram.com:443/p/abc/'},
  {id:'newline',platform:'instagram',url:'https://www.instagram.com/p/abc/\n'},
 ];
 await assert.rejects(rpc('save_private_session',[owner,id,{date:'2026-11-28',locationName:'Port Melbourne Beach',linkedMedia:links}]),e=>e.code==='22023','Session saves cannot forge attached media');
 await query('UPDATE finfolk."DiveSession" SET detail=detail||$2::jsonb WHERE id=$1',[id,JSON.stringify({photos:['PRIVATE_PHOTO'],linkedMedia:links})]);
 await db.exec('SET ROLE finfolk_account');
 await assert.rejects(rpc('set_session_visibility',[other,id,'public',true]),e=>e.code==='P0002');
 await assert.rejects(rpc('set_session_visibility',[owner,id,'public',false]),e=>e.code==='42501');
 assert.equal(await rpc('ret_public_session',[id]),null);
 assert.deepEqual(await rpc('set_session_visibility',[owner,id,'public',true]),{visibility:'public'});
 const expected=[{id:'ig',platform:'instagram',url:'https://www.instagram.com/p/abc/',kind:'post'},{id:'tt',platform:'tiktok',url:'https://www.tiktok.com/@diver/video/123456789',kind:'video'}];
 assert.deepEqual(publicSessionMedia(links),expected);
 const published=await rpc('ret_public_session',[id]);
 assert.deepEqual(published.linkedMedia,expected);assert.deepEqual(published.photos,[]);assert.equal(published.dives,undefined);
 assert.ok(!JSON.stringify(published).includes('PRIVATE_'));
 const visible=await rpc('ret_visible_session',[other,id]);assert.deepEqual(visible,published);
 const list=await rpc('ret_public_sessions',[{owner}]);assert.deepEqual(list.sessions,[published]);
 assert.deepEqual((await rpc('ret_visible_sessions',[other,{owner}])).sessions,[published]);
 await rpc('set_account_block',[other,owner,true]);assert.equal(await rpc('ret_visible_session',[other,id]),null);assert.deepEqual((await rpc('ret_visible_sessions',[other,{owner}])).sessions,[]);assert.deepEqual(await rpc('ret_public_session',[id]),published,'Public links remain anonymous when members block each other');await rpc('set_account_block',[other,owner,false]);
 const privateEntry=await rpc('ret_visible_session',[owner,id]);assert.deepEqual(privateEntry.photos,['PRIVATE_PHOTO']);assert.deepEqual(privateEntry.linkedMedia,links);
 const revision=(await query('SELECT r.index FROM finfolk."DiveSession" s JOIN finfolk."Rev" r ON r.id=s.rev_id WHERE s.id=$1',[id]))[0].index;
 await rpc('set_session_visibility',[owner,id,'public',true]);
 assert.equal((await query('SELECT r.index FROM finfolk."DiveSession" s JOIN finfolk."Rev" r ON r.id=s.rev_id WHERE s.id=$1',[id]))[0].index,revision,'Publishing retries do not add a revision');
 await rpc('set_session_visibility',[owner,id,'private',true]);assert.equal(await rpc('ret_public_session',[id]),null);assert.deepEqual((await rpc('ret_public_sessions',[{owner}])).sessions,[]);
 console.log('SESSION_PUBLICATION_PASS: owner/verification gates, attached social links, safe public projection, private photos/inbox/dives, public detail/list consistency, retry and unpublish.');
}finally{await db.close();}
