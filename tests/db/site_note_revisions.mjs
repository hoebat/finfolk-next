import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {Hono} from 'hono';
import {registerSiteNotesPublic,registerSiteNotesPrivate} from '../../backend/site-notes.mjs';
import {connect} from './harness.mjs';
import {installEntities,user} from './fixtures/entities.mjs';
import {createNativeRPC} from '../../backend/native-rpc.mjs';
import {operations,validate} from '../../js/finfolk-next/packages/edge/native-account-contracts.js';
const db=await connect(),owner=randomUUID(),other=randomUUID(),site=randomUUID(),secondSite=randomUUID(),note=randomUUID();
const rpc=createNativeRPC(db.query.bind(db));
const actor=async(id,admin=false)=>db.query("SELECT set_config('finfolk.actor_id',$1,false),set_config('finfolk.directory_admin',$2,false)",[id,admin?'true':'false']);
const history=async()=> (await db.query('SELECT version,deltas FROM finfolk."RevLog" WHERE class_table=\'SiteNote\' AND rev_id=(SELECT rev_id FROM finfolk."SiteNote" WHERE id=$1) ORDER BY version',[note])).rows;
const save=(text='Initial access instructions.',revision=null,id=note,where=site)=>rpc('save_site_note',[where,id,'access',text,null,revision]);
const feed=(member=false,topic='all',offset=0)=>rpc('ret_site_notes',[site,'newest',topic,offset,member]);
try{
 await installEntities(db);await user(db,owner);await user(db,other);
 await db.query('UPDATE finfolk."User" SET email_verified=true WHERE id=ANY($1::uuid[])',[[owner,other]]);
 for(const id of [site,secondSite])await db.query('INSERT INTO finfolk."Site"(id,name,timezone) VALUES($1,\'Test site\',\'Australia/Sydney\')',[id]);
 await db.query(await readFile('resources/finfolkdb/site-notes-grants.sql','utf8'));
 await actor(owner);
 assert.deepEqual(await save(),{id:note,revision:1});
 assert.deepEqual(await save(),{id:note,revision:1});assert.equal((await history()).length,1);
 await assert.rejects(save('A second note is not allowed.',null,randomUUID()),e=>e.code==='40001');
 await assert.rejects(rpc('insert_site_note',[randomUUID(),site,owner,'access','A duplicate inserted directly.',null,{}]),e=>e.code==='23505'&&e.constraint.includes('site_id_author_id'));
 const initial=(await db.query('SELECT * FROM finfolk."SiteNote" WHERE id=$1',[note])).rows[0];
 assert.ok(initial.rev_id);assert.ok(initial.op_created);assert.equal('revision' in initial,false);
 await assert.rejects(save('Cannot overwrite without the opened version.'),e=>e.code==='40001');
 assert.deepEqual(await save('Updated public access instructions.',1),{id:note,revision:2});
 assert.deepEqual(await save('Updated public access instructions.',1),{id:note,revision:2},'Retrying a completed edit creates no extra revision');
 assert.equal((await history()).length,2);assert.equal((await history())[0].deltas.body,'Initial access instructions.');assert.equal((await history())[1].deltas.body,'Updated public access instructions.');
 await assert.rejects(save('An older editor cannot overwrite this.',1),e=>e.code==='40001');
 assert.equal((await feed()).notes.length,1);assert.equal((await feed()).ownNote,null,'Anonymous feed contains no owner draft');
 let mine=(await feed(true,'wildlife',100)).ownNote;assert.equal(mine.id,note);assert.equal(mine.revision,2);assert.equal((await feed(true,'wildlife',100)).notes.length,0);
 await assert.rejects(db.query('UPDATE finfolk."SiteNote" SET body=\'short\' WHERE id=$1',[note]),/bounds/);
 await assert.rejects(db.query('UPDATE finfolk."SiteNote" SET observed_on=\'infinity\' WHERE id=$1',[note]),/finite/);
 await actor(other);await assert.rejects(save('Another person cannot edit this note.',2),/unavailable/);
 assert.equal((await feed(true)).ownNote,null);
 const secondPerson=await save('A separate person gets a separate note.',null,randomUUID());assert.equal(secondPerson.revision,1);
 await actor(owner);await save('The same person can note a different site.',null,randomUUID(),secondSite);
 assert.deepEqual(await rpc('set_site_note_withdrawn',[site,note,2,true]),{id:note,revision:3,withdrawn:true});
 assert.equal((await feed(true)).ownNote.withdrawn,true);
 await assert.rejects(save('Removing does not permit a new note.',null,randomUUID()),e=>e.code==='40001');
 assert.deepEqual(await save('Republished with updated instructions.',3),{id:note,revision:4});
 assert.equal((await feed(true)).ownNote.withdrawn,false);assert.equal((await history())[2].deltas.withdrawn,true);
 await actor(other,true);await rpc('moderate_site_note',[site,note,true]);await actor(owner);
 assert.equal((await feed(true)).ownNote.hidden,true);
 await save('Editing must preserve moderator visibility.',5);
 assert.equal((await feed()).notes.some(n=>n.id===note),false);assert.equal((await feed(true)).ownNote.hidden,true);
 // A failed transaction cannot leave a history row or a partial body update.
 await db.query('BEGIN');try{await save('This content is rolled back.',6);}finally{await db.query('ROLLBACK');}
 assert.equal((await history()).length,6);assert.equal((await feed(true)).ownNote.text,'Editing must preserve moderator visibility.');
 // Distinct create IDs submitted concurrently by one actor still create one note.
 const thirdSite=randomUUID();await db.query('INSERT INTO finfolk."Site"(id,name,timezone) VALUES($1,\'Concurrent site\',\'Australia/Sydney\')',[thirdSite]);
 const pool=new pg.Pool({connectionString:process.env.FINFOLK_TEST_DATABASE_URL,max:4});
 async function concurrent(id,revision,text,where=thirdSite){const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('finfolk.actor_id',$1,true)",[owner]);const value=await createNativeRPC(c.query.bind(c))('save_site_note',[where,id,'access',text,null,revision]);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 try{
  const created=await Promise.allSettled(Array.from({length:4},()=>concurrent(randomUUID(),null,'A concurrent initial note.')));
  assert.equal(created.filter(r=>r.status==='fulfilled').length,1);for(const r of created.filter(r=>r.status==='rejected'))assert.equal(r.reason.code,'40001');
  const single=created.find(r=>r.status==='fulfilled').value;
  const edited=await Promise.allSettled([concurrent(single.id,1,'First concurrent edit.'),concurrent(single.id,1,'Second concurrent edit.')]);assert.equal(edited.filter(r=>r.status==='fulfilled').length,1);assert.equal(edited.find(r=>r.status==='rejected').reason.code,'40001');
 }finally{await pool.end();}
 // Verify trusted server permissions for editing as well as creating.
 await db.query('BEGIN');try{await db.query('GRANT finfolk_site_notes TO CURRENT_USER WITH SET TRUE');await db.query('SET LOCAL ROLE finfolk_site_notes');assert.equal((await save('Edited using the trusted notes role.',6)).revision,7);}finally{await db.query('ROLLBACK');}
 // Verify HTTP validation, conflicts, private owner state and revision persistence.
 const apiDB={transaction:async work=>{await db.query('BEGIN');try{const value=await work(async(sql,args)=>(await db.query(sql,args)).rows);await db.query('COMMIT');return value;}catch(e){await db.query('ROLLBACK');throw e;}}};
 const app=new Hono();let who={uid:owner,verified:true};app.onError((e,c)=>c.json({error:e.message},e.status||500));registerSiteNotesPublic(app,{db:apiDB});app.use('/v1/me/*',async(c,next)=>{c.set('messagingIdentity',who);await next();});registerSiteNotesPrivate(app,{db:apiDB});
 const post=value=>app.request('/v1/me/sites/'+site+'/notes/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
 assert.equal((await post({id:randomUUID(),topic:'access',text:'Duplicate from another client.'})).status,409);
 assert.equal((await post({id:note,topic:'access',text:'Stale HTTP update.',revision:1})).status,409);
 assert.equal((await post({id:note,topic:'access',text:'Invalid HTTP revision.',revision:0})).status,400);
 assert.equal((await post({id:note,topic:'access',text:'An update through the HTTP adapter.',revision:6})).status,200);
 assert.equal((await history()).at(-1).deltas.body,'An update through the HTTP adapter.');
 const privateFeed=await(await app.request('/v1/me/sites/'+site+'/notes?topic=wildlife&offset=100')).json();assert.equal(privateFeed.data.ownNote.id,note);assert.equal(privateFeed.data.ownNote.revision,7);
 assert.equal((await(await app.request('/v1/sites/'+site+'/notes')).json()).ownNote,null);
 validate(operations.siteNotes.result,privateFeed.data,'result');
 const nativeEdit=await rpc('native_notes_save',[owner,true,{site,id:note,topic:'access',text:'Edited through the generated native operation.',revision:7}]);validate(operations.siteNoteSave.result,nativeEdit,'result');assert.equal(nativeEdit.revision,8);
 const nativeFeed=await rpc('native_notes_list',[owner,true,{site,topic:'wildlife',offset:100}]);validate(operations.siteNotes.result,nativeFeed,'result');assert.equal(nativeFeed.ownNote.revision,8);assert.equal((await history()).at(-1).deltas.body,'Edited through the generated native operation.');
 who={uid:other,verified:true};assert.equal((await post({id:note,topic:'access',text:'Unauthorized HTTP update.',revision:8})).status,404);
 console.log('SITE_NOTE_REVISIONS_PASS: one note per author/site, direct constraint, concurrent creation and edits, idempotent retries, private owned note across filters/pages, authorization, withdrawal/republish, immutable snapshots, moderation, rollback, server grants and HTTP conflicts');
}finally{await db.end();}
