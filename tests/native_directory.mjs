import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
const document=name=>({name,category:'Group',state:'NSW',country:'Australia',locality:'Sydney',description:'Native directory proof',website:'https://example.test/',image:'',sources:['https://example.test/source'],socials:[]});
export async function nativeDirectory({db,users,operation,publicOperation}){
 const owned=[];
 async function call(user,name,values={}){const r=await operation(user,name,values);assert.equal(r.status,200,await r.clone().text());return r.json();}
 async function guest(name,values={}){const r=await publicOperation(name,values);assert.equal(r.status,200,await r.clone().text());return r.json();}
 try{
  assert.deepEqual(await guest('publicDirectory'),{listings:[],next:null});
  assert.deepEqual(await call(users[0],'directoryMine'),{admin:false,listings:[],claims:[]});
  const requestId=randomUUID(),doc=document('Native group');
  const created=await call(users[0],'directoryCreate',{requestId,document:doc});owned.push(created.id);assert.equal(created.status,'candidate');
  assert.deepEqual(await call(users[0],'directoryCreate',{requestId,document:doc}),created);
  assert.equal((await operation(users[1],'directoryCreate',{requestId,document:doc})).status,409);
  assert.equal((await operation(users[0],'directoryCreate',{requestId,document:{...doc,name:'Changed'}})).status,409);
  assert.equal((await operation(users[0],'directoryCreate',{requestId:randomUUID(),document:doc,admin:true})).status,400);
  assert.equal((await publicOperation('publicDirectoryDetail',{id:created.id})).status,404);
  assert.deepEqual((await call(users[1],'directoryMine')).listings,[]);
  assert.equal((await operation(users[1],'directoryOwnerSave',{id:created.id,revision:1,document:doc})).status,403);
  await assert.rejects(db.query('SELECT finfolk_rpc.native_directory_owner_create($1,false,$2)',[users[0].id,{requestId:randomUUID(),document:doc}]),error=>error.code==='42501');
  await call(users[0],'directoryOwnerSave',{id:created.id,revision:1,document:{...doc,description:'Updated description'}});doc.description='Updated description';
  assert.equal((await operation(users[0],'directoryOwnerSave',{id:created.id,revision:1,document:doc})).status,409);
  assert.equal((await operation(users[0],'directoryAdmin')).status,403,'Auth metadata cannot grant directory administration');
  await db.query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,\'admin\')',[users[0].id]);
  await call(users[0],'directoryAdminSave',{id:created.id,revision:2,document:doc,status:'published',notes:'Private moderation proof'});
  const publicRow=await guest('publicDirectoryDetail',{id:created.id});assert.equal(publicRow.name,doc.name);assert.equal(publicRow.managed,true);
  assert.equal(JSON.stringify(publicRow).includes('Private moderation proof'),false);assert.equal(Object.hasOwn(publicRow,'owner_id'),false);
  assert.deepEqual(await(await publicOperation('publicDirectoryDetail',{id:created.id},users[0].access_token)).json(),publicRow,'Bearer tokens cannot change public scope');
  const invite=await call(users[0],'pageInvite',{id:created.id});assert.match(invite.token,/^[0-9a-f]{64}$/);
  const stored=(await db.query('SELECT secret FROM finfolk."AccessInviteExternal" WHERE id=$1',[invite.id])).rows[0].secret;assert.equal(stored,createHash('sha256').update(invite.token).digest('hex'));
  const access=await call(users[0],'pageAccess',{id:created.id});assert.equal(access.invites[0].id,invite.id);assert.equal(JSON.stringify(access).includes(invite.token),false);
  assert.deepEqual(await call(users[1],'pageInviteRedeem',{token:invite.token}),{id:created.id});
  assert.deepEqual(await call(users[1],'pageInviteRedeem',{token:invite.token}),{id:created.id});
  assert.equal((await call(users[1],'pageAccess',{id:created.id})).role,'admin');
  assert.equal((await operation(users[1],'pageInvite',{id:created.id})).status,403);
  await call(users[1],'directoryOwnerSave',{id:created.id,revision:3,document:doc});
  await call(users[0],'pageAdminRemove',{id:created.id,user:users[1].id});assert.deepEqual((await call(users[1],'directoryMine')).listings,[]);
  const revoked=await call(users[0],'pageInvite',{id:created.id});await call(users[0],'pageInviteRevoke',{id:created.id,invite:revoked.id});
  assert.equal((await operation(users[1],'pageInviteRedeem',{token:revoked.token})).status,409);
  const expired=await call(users[0],'pageInvite',{id:created.id});await db.query('UPDATE finfolk."AccessInviteExternal" SET expires_at=0 WHERE id=$1',[expired.id]);
  assert.equal((await operation(users[1],'pageInviteRedeem',{token:expired.token})).status,409);
  assert.equal((await operation(users[1],'pageInviteRedeem',{token:'0'.repeat(64)})).status,404);
  await call(users[1],'directoryReport',{id:created.id,message:'Correction request'});
  const review=await call(users[0],'directoryAdmin');assert.equal(review.reports.length,1);await call(users[0],'directoryReportResolve',{id:review.reports[0].id});
  assert.deepEqual((await call(users[0],'directoryAdmin')).reports,[]);
  await call(users[0],'directoryAdminSave',{id:created.id,revision:4,document:doc,status:'archived'});assert.equal((await publicOperation('publicDirectoryDetail',{id:created.id})).status,404);
  const adminCreated=await call(users[0],'directoryAdminSave',{document:document('Admin-created target'),status:'published'});owned.push(adminCreated.id);
  const duplicate=await call(users[0],'directoryAdminSave',{document:{...document('Admin duplicate'),sources:['https://example.test/other-source']},status:'candidate'});owned.push(duplicate.id);
  assert.equal((await operation(users[1],'directoryMerge',{source:duplicate.id,target:adminCreated.id})).status,403);
  assert.equal((await operation(users[0],'directoryMerge',{source:adminCreated.id,target:adminCreated.id})).status,400);
  assert.equal((await operation(users[0],'directoryMerge',{source:created.id,target:adminCreated.id})).status,409,'Owned/archived sources cannot be merged');
  assert.deepEqual(await call(users[0],'directoryMerge',{source:duplicate.id,target:adminCreated.id}),{id:adminCreated.id});
  assert.deepEqual(await call(users[0],'directoryMerge',{source:duplicate.id,target:adminCreated.id}),{id:adminCreated.id},'Merge replay is idempotent');
  assert.equal((await publicOperation('publicDirectoryDetail',{id:duplicate.id})).status,404);
  assert.ok((await guest('publicDirectoryDetail',{id:adminCreated.id})).sources.includes('https://example.test/other-source'));
  async function seed(name){const value=(await db.query("SELECT finfolk_rpc.insert_directory_listing($1,finfolk.op_fn('fixture',$2,'{}'::jsonb)) value",[document(name),users[0].id])).rows[0].value;owned.push(value.id);await db.query('UPDATE finfolk."DirectoryListing" SET status=\'published\' WHERE id=$1',[value.id]);return value.id;}
  const unowned=await seed('Unmanaged native page');const claim=await call(users[1],'directoryClaim',{id:unowned});assert.match(claim.challenge,/^FINFOLK-/);assert.ok(claim.expires_at>Date.now());
  await call(users[0],'directoryClaimReview',{id:claim.id,approve:true,evidence:'Mock verification evidence'});assert.equal((await call(users[1],'directoryMine')).listings[0].id,unowned);
  assert.equal((await operation(users[0],'directoryClaim',{id:unowned})).status,409);
  for(let i=0;i<26;i++)await seed('Paging '+String(i).padStart(2,'0'));
  const first=await guest('publicDirectory',{q:'Paging',state:'NSW'});assert.equal(first.listings.length,20);assert.equal(first.next,20);
  const second=await guest('publicDirectory',{q:'Paging',state:'NSW',offset:'20'});assert.equal(second.listings.length,6);assert.equal(second.next,null);assert.equal(new Set([...first.listings,...second.listings].map(row=>row.id)).size,26);
 }finally{
  await db.query('DELETE FROM finfolk."UserRole" WHERE user_id=$1 AND role=\'admin\'',[users[0].id]);
  await db.query('DELETE FROM finfolk."DirectoryReport" WHERE listing_id=ANY($1::uuid[])',[owned]);
  const rows=(await db.query('DELETE FROM finfolk."DirectoryListing" WHERE id=ANY($1::uuid[]) RETURNING rev_id,audit_id,access_id,social_id',[owned])).rows;
  for(const row of rows){
   await db.query('DELETE FROM finfolk."Access" WHERE class_table=\'DirectoryListing\' AND class_context=\'Global\' AND id=$1',[row.access_id]);
   for(const [table,id] of [['Rev',row.rev_id],['Audit',row.audit_id],['Social',row.social_id]])await db.query('DELETE FROM finfolk."'+table+'" WHERE class_table=\'DirectoryListing\' AND id=$1',[id]);
  }
 }
}
