import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {connect} from './harness.mjs';
import {installEntities,user} from './fixtures/entities.mjs';
import {readFile} from 'node:fs/promises';
import {Hono} from 'hono';
import {registerSiteNotesPublic,registerSiteNotesPrivate} from '../../backend/site-notes.mjs';
const db=await connect();
async function actor(id,admin=false,query=db){await query.query("SELECT set_config('finfolk.actor_id',$1,false),set_config('finfolk.directory_admin',$2,false)",[id,admin?'true':'false']);}
const rpc=async(name,args=[],query=db)=>(await query.query(`SELECT finfolk_rpc.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS value`,args)).rows[0].value;
const list=(site='bondi',sort='helpful',topic='all',offset=0,member=false)=>rpc('ret_site_notes',[site,sort,topic,offset,member]);
const save=(id=randomUUID(),site='bondi',topic='access',text='Meet your group at an agreed meeting point.',day=null)=>rpc('save_site_note',[site,id,topic,text,day]);
try{
 await installEntities(db);for(const id of ['alice','bob','carol','unverified','banned'])await user(db,id,{displayName:id.toUpperCase(),privateField:'NEVER_PUBLIC'});
 await db.query(await readFile('resources/finfolkdb/site-notes-grants.sql','utf8'));
 await db.query(`UPDATE neon_auth."user" SET "emailVerified"=false WHERE id='unverified'; UPDATE neon_auth."user" SET banned=true WHERE id='banned'; INSERT INTO finfolk."Beach"(id,name,timezone) VALUES('bondi','Bondi','Australia/Sydney'),('portsea','Portsea','Australia/Melbourne')`);
 assert.deepEqual(await list(),{notes:[],next:null});await actor('alice');
 await db.query('SET ROLE finfolk_site_notes');const roleNote=await save();assert.equal((await list()).notes.length,1);await db.query('RESET ROLE');await db.query('DELETE FROM finfolk."SiteNote" WHERE id=$1',[roleNote.id]);
 assert.equal((await db.query("SELECT has_function_privilege('finfolk_api','finfolk_rpc.save_site_note(text,uuid,text,text,date)','EXECUTE') AS allowed")).rows[0].allowed,false);
 const note=await save();assert.equal(note.revision,1);assert.equal((await save(note.id)).id,note.id);assert.equal((await list()).notes.length,1);
 await assert.rejects(save(note.id,'bondi','access','An altered body must not overwrite a retry.'),/already used/);
 await assert.rejects(save(randomUUID(),'missing'),/Check the site/);
 await assert.rejects(save(randomUUID(),'bondi','conditions'),/observation date/);
 await assert.rejects(save(randomUUID(),'bondi','conditions','A dated observation of a previous visit.','2099-01-01'),/observation date/);
 await assert.rejects(save(randomUUID(),'bondi','access','short'),/note length/);
 await assert.rejects(save(randomUUID(),'bondi','__proto__'),/topic/);
 const dated=await save(randomUUID(),'bondi','conditions','An observation recorded after a past visit.','2026-01-01');
 assert.equal((await list('bondi','newest','conditions')).notes[0].observedOn,'2026-01-01');
 assert.equal((await list('portsea')).notes.length,0);
 const output=(await list()).notes[0];assert.deepEqual(Object.keys(output).sort(),['id','site','topic','text','author','createdAt','observedOn','revision','score','own','upvoted'].sort());assert.equal(JSON.stringify(output).includes('NEVER_PUBLIC'),false);assert.equal(output.own,false);
 await actor('bob');let voted=await rpc('set_site_note_vote',['bondi',note.id,true]);assert.equal(voted.score,1);assert.equal(voted.upvoted,true);
 assert.equal((await rpc('set_site_note_vote',['bondi',note.id,true])).score,1);
 assert.equal((await list('bondi','helpful','all',0,true)).notes[0].upvoted,true);assert.equal((await list()).notes[0].upvoted,false);
 assert.equal((await rpc('set_site_note_vote',['bondi',note.id,false])).score,0);assert.equal((await rpc('set_site_note_vote',['bondi',note.id,false])).score,0);
 await assert.rejects(rpc('set_site_note_vote',['portsea',note.id,true]),/unavailable/);
 await assert.rejects(rpc('set_site_note_withdrawn',['bondi',note.id,1,true]),/unavailable/);
 await rpc('set_site_note_vote',['bondi',note.id,true]);await rpc('report_site_note',['bondi',note.id,'This needs review.']);await rpc('report_site_note',['bondi',note.id,'Retry report.']);assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."SiteNoteReport"')).rows[0].n,1);
 await assert.rejects(rpc('moderate_site_note',['bondi',note.id,true]),/Administrator/);
 await db.query(`INSERT INTO finfolk."UserBlock"(owner_id,target_id) VALUES('alice','bob')`);assert.equal((await list('bondi','helpful','all',0,true)).notes.length,0);await assert.rejects(rpc('set_site_note_vote',['bondi',note.id,true]),/unavailable/);assert.equal((await list()).notes.length,2);await db.query('DELETE FROM finfolk."UserBlock"');
 await actor('alice');assert.equal((await list('bondi','helpful','all',0,true)).notes[0].own,true);
 let removed=await rpc('set_site_note_withdrawn',['bondi',note.id,1,true]);assert.equal(removed.revision,2);assert.equal((await list()).notes.length,1);assert.equal((await rpc('set_site_note_withdrawn',['bondi',note.id,1,true])).revision,2);
 await actor('carol',true);await rpc('moderate_site_note',['bondi',note.id,true]);await actor('alice');await assert.rejects(rpc('set_site_note_withdrawn',['bondi',note.id,2,false]),/changed/);await rpc('set_site_note_withdrawn',['bondi',note.id,3,false]);assert.equal((await list()).notes.length,1,'Owner restoration must not undo moderation');
 await actor('carol',true);await rpc('moderate_site_note',['bondi',note.id,false]);assert.equal((await list()).notes.length,2);assert.ok((await db.query('SELECT resolved_at FROM finfolk."SiteNoteReport"')).rows[0].resolved_at);
 for(const id of ['', 'unverified','banned']){await actor(id);await assert.rejects(save(),/Verified/);await assert.rejects(rpc('set_site_note_vote',['bondi',note.id,true]),/Verified/);}
 await db.query(`UPDATE finfolk."User" SET deleted=true WHERE id='bob'`);assert.equal((await list()).notes.find(n=>n.id===note.id).score,0);await db.query(`UPDATE finfolk."User" SET deleted=false WHERE id='bob'`);
 await db.query(`UPDATE neon_auth."user" SET banned=true WHERE id='bob'`);assert.equal((await list()).notes.find(n=>n.id===note.id).score,0);await db.query(`UPDATE neon_auth."user" SET banned=false WHERE id='bob'`);
 await db.query(`INSERT INTO finfolk."SiteProfile"(beach_id,revision,waterbody,access_mode,status,payload) VALUES('bondi',1,'ocean','shore','archived','{}')`);assert.equal((await list()).notes.length,0);await actor('alice');await assert.rejects(save(),/Check the site/);await db.query('DELETE FROM finfolk."SiteProfile"');
 // Parallel desired-state retries must create exactly one relationship.
 const pool=new pg.Pool({connectionString:process.env.FINFOLK_TEST_DATABASE_URL,max:5});
 try{await Promise.all(Array.from({length:8},async()=>{const c=await pool.connect();try{await actor('carol',false,c);return await rpc('set_site_note_vote',['bondi',note.id,true],c);}finally{c.release();}}));}finally{await pool.end();}
 assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."SiteNoteVote" WHERE note_id=$1',[note.id])).rows[0].n,2);
 // Exercise the HTTP adapter against this same native schema, including actor
 // spoofing, public/member cache separation and transaction-local identity.
 const httpPool=new pg.Pool({connectionString:process.env.FINFOLK_TEST_DATABASE_URL,max:2}),apiDB={transaction:async work=>{const c=await httpPool.connect();try{await c.query('BEGIN');const value=await work(async(sql,args)=>(await c.query(sql,args)).rows);await c.query('COMMIT');return value;}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}};
 try{const app=new Hono();let who={uid:'alice',verified:true};app.onError((error,c)=>c.json({error:error.message},error.status||500));registerSiteNotesPublic(app,{db:apiDB});app.use('/v1/me/*',async(c,next)=>{c.set('messagingIdentity',who);await next();});registerSiteNotesPrivate(app,{db:apiDB});const id=randomUUID(),post=(action,value)=>app.request('/v1/me/sites/portsea/notes/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
  assert.equal((await post('save',{id,topic:'access',text:'A public note created through the native HTTP adapter.',author:'bob'})).status,200);assert.equal((await db.query('SELECT author_id FROM finfolk."SiteNote" WHERE id=$1',[id])).rows[0].author_id,'alice');
  who={uid:'bob',verified:true};assert.equal((await post('vote',{id,upvoted:true,uid:'alice'})).status,200);assert.equal((await db.query('SELECT voter_id FROM finfolk."SiteNoteVote" WHERE note_id=$1',[id])).rows[0].voter_id,'bob');
  const member=await(await app.request('/v1/me/sites/portsea/notes')).json(),anonymous=await(await app.request('/v1/sites/portsea/notes?uid=bob')).json();assert.equal(member.data.notes[0].upvoted,true);assert.equal(anonymous.notes[0].upvoted,false);assert.equal(anonymous.notes[0].own,false);
  assert.equal((await post('vote',{id,upvoted:'true'})).status,400);assert.equal((await post('save',{id:randomUUID(),topic:'conditions',text:'A condition note without a date.'})).status,400);who={uid:'unverified',verified:false};assert.equal((await post('vote',{id,upvoted:true})).status,403);
  await db.query('DELETE FROM finfolk."SiteNote" WHERE id=$1',[id]);
 }finally{await httpPool.end();}
 await actor('alice');for(let i=0;i<23;i++)await save(randomUUID(),'portsea','facilities','A facilities note for pagination number '+i+'.');
 const page=await list('portsea');assert.equal(page.notes.length,20);assert.equal(page.next,20);const next=await list('portsea','helpful','all',page.next);assert.equal(next.notes.length,3);assert.equal(next.next,null);assert.equal(new Set([...page.notes,...next.notes].map(n=>n.id)).size,23);
 await assert.rejects(db.query('INSERT INTO finfolk."SiteNoteVote"(note_id,voter_id) VALUES($1,$2)',[note.id,'bob']),e=>e.code==='23505');
 await db.query(`UPDATE finfolk."User" SET deleted=true WHERE id='alice'`);assert.equal((await list()).notes.length,0);await db.query(`UPDATE finfolk."User" SET deleted=false WHERE id='alice'`);
 await db.query('DELETE FROM finfolk."SiteNote" WHERE id=$1',[note.id]);assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."SiteNoteVote" WHERE note_id=$1',[note.id])).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."SiteNoteReport"')).rows[0].n,0);
 console.log('SITE_NOTES_DB_PASS: native references/constraints, public projection, verified actors, blocks, retry-safe concurrent votes, ranking, pagination, withdrawal, moderation and cascades.');
}finally{await db.end();}
