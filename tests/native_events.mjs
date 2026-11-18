import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
export async function nativeEvents({db,nativeQuery,users,operation,publicOperation}){
 const pages=[],events=[];
 async function call(user,name,values={}){const r=await operation(user,name,values);assert.equal(r.status,200,await r.clone().text());return r.json();}
 async function guest(name,values={}){const r=await publicOperation(name,values);if(r.status===503)await nativeQuery.query('SELECT finfolk_rpc.call_native_events(NULL,false,NULL,$1,$2)',[name==='publicEvents'?'list':'public-detail',JSON.stringify(values)]);assert.equal(r.status,200,await r.clone().text());return r.json();}
 const document={name:'Event organiser',category:'Club',state:'NSW',country:'Australia',locality:'Sydney',description:'Native event proof',website:'https://example.test',image:'',sources:['https://example.test/source'],socials:[]};
 const starts=new Date(Date.now()+86400000).toISOString(),ends=new Date(Date.now()+90000000).toISOString();
 try{
  assert.deepEqual(await guest('publicEvents'),{events:[]});
  const page=await call(users[0],'directoryCreate',{requestId:randomUUID(),document});pages.push(page.id);
  await db.query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,\'admin\')',[users[0].id]);
  await call(users[0],'directoryAdminSave',{id:page.id,revision:1,document,status:'published'});
  const values={page:page.id,title:'Native public event',description:'Event details',location:'Local pool',category:'Training',starts,ends,timezone:'Australia/Sydney',capacity:1,visibility:'public',state:'draft'};
  const draft=await call(users[0],'eventSave',values);events.push(draft.id);
  assert.equal(await guest('publicEvent',{id:draft.id}),null);
  assert.equal((await operation(users[1],'eventDetail',{id:draft.id})).status,404);
  let detail=await call(users[0],'eventDetail',{id:draft.id});assert.equal(detail.canManage,true);assert.equal(detail.state,'draft');assert.equal(detail.revision,1);
  assert.equal((await operation(users[1],'eventSave',{...values,id:draft.id,revision:1})).status,403);
  await call(users[0],'eventSave',{...values,id:draft.id,revision:1,state:'published'});
  assert.equal((await operation(users[0],'eventSave',{...values,id:draft.id,revision:1,state:'published'})).status,409);
  const publicRow=await guest('publicEvent',{id:draft.id});assert.equal(publicRow.canManage,false);assert.equal(publicRow.canModerate,false);assert.equal(publicRow.myRsvp,null);assert.equal(publicRow.organiser,document.name);
  assert.equal((await guest('publicEvents',{page:page.id})).events.length,1);
  assert.equal((await operation(users[1],'eventRoster',{id:draft.id})).status,403);
  const rsvps=await Promise.all(users.map(user=>operation(user,'eventRsvp',{id:draft.id,state:'going'})));assert.deepEqual(rsvps.map(r=>r.status).sort(),[200,409],'Event-row locking enforces capacity under concurrency');
  const winner=users[rsvps.findIndex(r=>r.status===200)];await call(winner,'eventRsvp',{id:draft.id,state:'going'});
  assert.equal((await guest('publicEvent',{id:draft.id})).going,1);
  assert.equal((await operation(users[0],'eventSave',{...values,id:draft.id,revision:2,state:'draft'})).status,409);
  assert.equal((await operation(users[0],'eventSave',{...values,id:draft.id,revision:2,state:'published',visibility:'private'})).status,409);
  await call(winner,'eventRsvp',{id:draft.id,state:'cancelled'});assert.equal((await guest('publicEvent',{id:draft.id})).going,0);
  const privateEvent=await call(users[0],'eventSave',{...values,title:'Native private event',state:'published',visibility:'private',capacity:4});events.push(privateEvent.id);
  assert.equal(await guest('publicEvent',{id:privateEvent.id}),null);
  assert.equal((await operation(users[1],'eventDetail',{id:privateEvent.id})).status,404);
  const invite=await call(users[0],'eventInvite',{id:privateEvent.id,email:users[1].email});assert.match(invite.token,/^[0-9a-f]{64}$/);
  assert.equal((await db.query('SELECT secret FROM finfolk."AccessInviteEmail" WHERE id=$1',[invite.id])).rows[0].secret,createHash('sha256').update(invite.token).digest('hex'));
  assert.equal((await operation(users[0],'eventAccept',{token:invite.token})).status,409,'Only the verified invited email may accept');
  assert.equal((await operation(users[0],'eventAccept',{token:invite.token,email:users[1].email})).status,400,'Payload email cannot override trusted identity');
  await call(users[1],'eventAccept',{token:invite.token});assert.equal((await call(users[1],'eventDetail',{id:privateEvent.id})).canManage,false);
  await call(users[1],'eventRsvp',{id:privateEvent.id,state:'going'});
  const roster=await call(users[0],'eventRoster',{id:privateEvent.id});assert.equal(roster.attendees[0].id,users[1].id);assert.equal(roster.invitations[0].email,users[1].email);assert.equal(JSON.stringify(roster).includes(invite.token),false);
  await call(users[0],'eventRevoke',{id:privateEvent.id,invite:invite.id});
  assert.equal((await operation(users[1],'eventDetail',{id:privateEvent.id})).status,404);assert.equal((await call(users[0],'eventDetail',{id:privateEvent.id})).going,0);
  const concurrentInvite=await call(users[0],'eventInvite',{id:privateEvent.id,email:users[1].email});
  const race=await Promise.all([operation(users[1],'eventAccept',{token:concurrentInvite.token}),operation(users[0],'eventRevoke',{id:privateEvent.id,invite:concurrentInvite.id})]);assert.ok(race.every(r=>[200,409].includes(r.status)),'Accept/revoke uses consistent event-before-invite locking');
  assert.equal((await operation(users[1],'eventDetail',{id:privateEvent.id})).status,404);
  await call(users[0],'eventCancel',{id:draft.id});assert.equal((await guest('publicEvent',{id:draft.id})).state,'cancelled');assert.deepEqual(await guest('publicEvents'),{events:[]});
  assert.equal((await operation(users[1],'eventModerate',{id:draft.id})).status,403);await call(users[0],'eventModerate',{id:draft.id});assert.equal(await guest('publicEvent',{id:draft.id}),null);
  const revisions=(await db.query('SELECT r.index,(SELECT max(version) FROM finfolk."RevLog" l WHERE l.rev_id=r.id) latest FROM finfolk."Event" e JOIN finfolk."Rev" r ON r.id=e.rev_id WHERE e.id=$1',[draft.id])).rows[0];assert.equal(revisions.index,revisions.latest);
  await call(users[0],'directoryAdminSave',{id:page.id,revision:2,document,status:'archived'});assert.equal(await guest('publicEvent',{id:privateEvent.id}),null);assert.equal((await operation(users[1],'eventRsvp',{id:privateEvent.id,state:'going'})).status,409);
 }finally{
  await db.query('DELETE FROM finfolk."UserRole" WHERE user_id=$1 AND role=\'admin\'',[users[0].id]);
  await db.query('DELETE FROM finfolk."EventRsvp" WHERE event_id=ANY($1::uuid[])',[events]);
  for(const table of ['Event','DirectoryListing']){
   const rows=(await db.query('DELETE FROM finfolk."'+table+'" WHERE id=ANY($1::uuid[]) RETURNING rev_id,audit_id,access_id'+(table==='DirectoryListing'?',social_id':''),[table==='Event'?events:pages])).rows;
   for(const row of rows)for(const [provider,id] of [['Access',row.access_id],['Rev',row.rev_id],['Audit',row.audit_id],...(row.social_id?[['Social',row.social_id]]:[])])await db.query('DELETE FROM finfolk."'+provider+'" WHERE class_table=$1 AND id=$2',[table,id]);
  }
 }
}
