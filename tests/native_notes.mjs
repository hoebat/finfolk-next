import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function nativeNotes({db,users,operation,publicOperation}){
 const site=randomUUID(),id=randomUUID();
 await db.query('INSERT INTO finfolk."Site"(id,name,timezone) VALUES($1,$2,$3)',[site,'Native notes beach','Australia/Sydney']);
 async function call(user,name,values){const response=await operation(user,name,values);assert.equal(response.status,200,await response.clone().text());return response.json();}
 async function feed(){const response=await publicOperation('publicSiteNotes',{site});assert.equal(response.status,200,await response.clone().text());return response.json();}
 const save={site,id,topic:'access',text:'Use the marked public access path.'};
 try{
  assert.deepEqual(await feed(),{enabled:true,notes:[],next:null});
  assert.deepEqual(await call(users[0],'siteNoteSave',save),{id,revision:1});
  assert.deepEqual(await call(users[0],'siteNoteSave',save),{id,revision:1});
  assert.equal((await operation(users[1],'siteNoteSave',save)).status,403);
  assert.equal((await operation(users[0],'siteNoteSave',{...save,id:randomUUID(),topic:'conditions'})).status,403);
  const publicNote=(await feed()).notes[0];assert.equal(publicNote.own,false);assert.equal(publicNote.upvoted,false);assert.equal(publicNote.text,save.text);assert.equal(Object.hasOwn(publicNote,'author_id'),false);
  const votes=await Promise.all(Array.from({length:3},()=>operation(users[1],'siteNoteVote',{site,id,upvoted:true})));for(const response of votes)assert.equal(response.status,200,await response.clone().text());
  assert.equal((await feed()).notes[0].score,1);
  await db.query('UPDATE finfolk."User" SET email_verified=false WHERE id=$1',[users[1].id]);assert.equal((await feed()).notes[0].score,0);
  await call(users[1],'me',{});assert.equal((await feed()).notes[0].score,1,'Verified getUser state restores native membership');
  await call(users[0],'block',{target:users[1].id});assert.deepEqual((await call(users[1],'siteNotes',{site})).notes,[]);await call(users[0],'unblock',{target:users[1].id});
  assert.equal((await operation(users[1],'siteNoteWithdraw',{site,id,revision:1,withdrawn:true})).status,403);
  const withdrawn=await call(users[0],'siteNoteWithdraw',{site,id,revision:1,withdrawn:true});assert.equal(withdrawn.revision,2);assert.deepEqual((await feed()).notes,[]);
  await call(users[0],'siteNoteWithdraw',{site,id,revision:2,withdrawn:false});assert.equal((await feed()).notes.length,1);
  await call(users[1],'siteNoteReport',{site,id,reason:'Please check access details.'});
  assert.equal((await operation(users[0],'siteNoteModerate',{site,id,hidden:true})).status,403,'Auth metadata cannot moderate notes');
  await db.query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,\'admin\')',[users[0].id]);
  await call(users[0],'siteNoteModerate',{site,id,hidden:true});assert.deepEqual((await feed()).notes,[]);
  await call(users[0],'siteNoteModerate',{site,id,hidden:false});assert.equal((await feed()).notes.length,1);
 }finally{
  await db.query('DELETE FROM finfolk."UserRole" WHERE user_id=$1 AND role=\'admin\'',[users[0].id]);
  const notes=(await db.query('DELETE FROM finfolk."SiteNote" WHERE site_id=$1 RETURNING rev_id',[site])).rows;
  for(const note of notes)await db.query('DELETE FROM finfolk."Rev" WHERE id=$1 AND class_table=\'SiteNote\'',[note.rev_id]);
  await db.query('DELETE FROM finfolk."Site" WHERE id=$1',[site]);
 }
}
