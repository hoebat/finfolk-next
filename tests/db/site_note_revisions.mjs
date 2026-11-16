import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {connect} from './harness.mjs';
import {installEntities,user} from './fixtures/entities.mjs';
import {createNativeRPC} from '../../backend/native-rpc.mjs';
const db=await connect(),owner=randomUUID(),other=randomUUID(),site=randomUUID(),note=randomUUID();
const rpc=createNativeRPC(db.query.bind(db));
const actor=async(id,admin=false)=>db.query("SELECT set_config('finfolk.actor_id',$1,false),set_config('finfolk.directory_admin',$2,false)",[id,admin?'true':'false']);
const history=async()=> (await db.query('SELECT version,deltas FROM finfolk."RevLog" WHERE class_table=\'SiteNote\' AND rev_id=(SELECT rev_id FROM finfolk."SiteNote" WHERE id=$1) ORDER BY version',[note])).rows;
try{
 await installEntities(db);await user(db,owner);await user(db,other);
 await db.query('INSERT INTO finfolk."Site"(id,name,timezone) VALUES($1,\'Test site\',\'Australia/Sydney\')',[site]);
 await db.query(await readFile('resources/finfolkdb/site-notes-grants.sql','utf8'));
 await actor(owner);
 assert.deepEqual(await rpc('save_site_note',[site,note,'access','Initial access instructions.',null]),{id:note,revision:1});
 assert.deepEqual((await history()).map(r=>r.version),[1]);
 const initial=(await db.query('SELECT * FROM finfolk."SiteNote" WHERE id=$1',[note])).rows[0];
 assert.ok(initial.rev_id);assert.ok(initial.op_created);assert.equal('revision' in initial,false);assert.ok(Number(initial.time_created)>0);
 await rpc('save_site_note',[site,note,'access','Initial access instructions.',null]);assert.equal((await history()).length,1);
 await assert.rejects(rpc('save_site_note',[site,note,'access','Different content cannot overwrite an idempotent save.',null]),/already used/);
 await assert.rejects(db.query('UPDATE finfolk."SiteNote" SET body=\'short\' WHERE id=$1',[note]),/bounds/);
 await assert.rejects(db.query('UPDATE finfolk."SiteNote" SET observed_on=\'infinity\' WHERE id=$1',[note]),/finite/);
 assert.deepEqual(await rpc('set_site_note_withdrawn',[site,note,1,true]),{id:note,revision:2,withdrawn:true});
 await rpc('set_site_note_withdrawn',[site,note,1,true]);assert.equal((await history()).length,2);
 await assert.rejects(rpc('set_site_note_withdrawn',[site,note,1,false]),/changed/);assert.equal((await history()).length,2);
 await actor(other,true);await rpc('moderate_site_note',[site,note,true]);await rpc('moderate_site_note',[site,note,true]);
 assert.deepEqual((await history()).map(r=>r.version),[1,2,3]);assert.equal((await history())[2].deltas.hidden,true);
 await actor(owner);await assert.rejects(rpc('set_site_note_withdrawn',[site,note,2,false]),/changed/);
 await rpc('set_site_note_withdrawn',[site,note,3,false]);assert.equal((await history())[3].deltas.withdrawn,false);
 const stream=(await db.query('SELECT "index",current FROM finfolk."Rev" WHERE class_table=\'SiteNote\' AND class_ref=$1',[note])).rows[0];assert.equal(stream.index,4);assert.equal(stream.current.hidden,true);
 await db.query('BEGIN');
 try{await rpc('set_site_note_withdrawn',[site,note,4,true]);await db.query('ROLLBACK');}catch(e){await db.query('ROLLBACK');throw e;}
 assert.equal((await history()).length,4);
 // Verify the generated server role can create a real revisioned note.
 await db.query('BEGIN');
 try{await db.query('GRANT finfolk_site_notes TO CURRENT_USER WITH SET TRUE');await db.query('SET LOCAL ROLE finfolk_site_notes');
  const created=await rpc('save_site_note',[site,randomUUID(),'access','Created using the trusted notes role.',null]);assert.equal(created.revision,1);
 }finally{await db.query('ROLLBACK');}
 console.log('SITE_NOTE_REVISIONS_PASS: native Site references, inherited tracking, column validators, scoped Rev/RevLog history, idempotence, stale updates, moderation, rollback and role grants');
}finally{await db.end();}
