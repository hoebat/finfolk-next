import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {createNativeAccount} from '../backend/native-account.mjs';
export async function nativeEventDelivery({db,accountDatabase,users,operation,url,key,deliveryKey}){
 const pages=[],events=[],extraUsers=[];const seen=new Map();let requests=0;
 const provider=async message=>{requests++;if(!seen.has(message.idempotencyKey))seen.set(message.idempotencyKey,message);return {id:'fixture-'+message.idempotencyKey};};
 const transport=(send=provider,transaction=accountDatabase.transaction,keyValue=deliveryKey)=>createNativeAccount({query:accountDatabase.query,transaction,supabaseUrl:url,publishableKey:key,eventDelivery:send,deliveryKey:keyValue,invitationOrigin:'http://127.0.0.1:3011'});
 const request=(name,values,user=users[0])=>new Request('http://local.test/account',{method:'POST',headers:{Authorization:'Bearer '+user.access_token,'Content-Type':'application/json'},body:JSON.stringify({operation:name,values})});
 async function invoke(api,name,values,user){const response=await api(request(name,values,user));assert.equal(response.status,200,await response.clone().text());return response.json();}
 async function call(name,values={}){const response=await operation(users[0],name,values);assert.equal(response.status,200,await response.clone().text());return response.json();}
 async function row(invite){return (await db.query('SELECT * FROM finfolk."EventInviteDelivery" WHERE invite_id=$1',[invite])).rows[0];}
 try{
  await db.query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,\'admin\')',[users[0].id]);
  const document={name:'Native delivery organiser',category:'Club',state:'NSW',sources:['https://example.test/source'],socials:[]};
  const page=await call('directoryCreate',{requestId:randomUUID(),document});pages.push(page.id);await call('directoryAdminSave',{id:page.id,revision:1,document,status:'published'});
  const event=await call('eventSave',{page:page.id,title:'Delivery fixture event',location:'Sydney',starts:new Date(Date.now()+86400000).toISOString(),ends:new Date(Date.now()+90000000).toISOString(),timezone:'Australia/Sydney',state:'published',visibility:'private'});events.push(event.id);
  const values={id:event.id,email:users[1].email,send:true,requestId:randomUUID()};const api=transport();
  assert.equal((await transport(provider,accountDatabase.transaction,null)(request('eventInvite',values))).status,503);assert.equal((await db.query('SELECT count(*)::int n FROM finfolk."AccessInviteEmail" WHERE access_id=(SELECT access_id FROM finfolk."Event" WHERE id=$1)',[event.id])).rows[0].n,0,'Missing sealing configuration cannot create half an invitation');
  const sent=await invoke(api,'eventInvite',values);assert.equal(sent.delivery.state,'sent');assert.equal(sent.delivery.attempts,1);assert.equal((await row(sent.id)).sealed_token,'');
  const replay=await invoke(api,'eventInvite',values);assert.equal(replay.token,'');assert.equal(replay.delivery.state,'sent');assert.equal(requests,1,'Idempotent request replay cannot send a second email');
  const message=[...seen.values()][0];assert.equal(message.to,users[1].email);assert.equal(new URL(message.url).searchParams.get('token'),sent.token);assert.equal((await db.query('SELECT secret FROM finfolk."AccessInviteEmail" WHERE id=$1',[sent.id])).rows[0].secret,createHash('sha256').update(sent.token).digest('hex'));
  assert.equal((await api(request('eventInviteRetry',{id:event.id,invite:sent.id},users[1]))).status,403);
  let fail=true;const failing=transport(async message=>{if(fail)throw Error('DO_NOT_EXPOSE_PROVIDER_SECRET');return provider(message);});
  const failed=await invoke(failing,'eventInvite',{...values,requestId:randomUUID()});assert.equal(failed.delivery.state,'failed');assert.equal(failed.delivery.attempts,1);assert.equal(JSON.stringify(failed).includes('DO_NOT_EXPOSE'),false);
  const encrypted=await row(failed.id);assert.ok(encrypted.sealed_token.length>64);assert.equal(encrypted.sealed_token.includes(failed.token),false);assert.equal(encrypted.sealed_token.includes(deliveryKey),false);
  fail=false;const retried=await invoke(failing,'eventInviteRetry',{id:event.id,invite:failed.id});assert.equal(retried.delivery.state,'sent');assert.equal(retried.delivery.attempts,2);assert.equal((await row(failed.id)).sealed_token,'');
  let release,started;const begun=new Promise(resolve=>{started=resolve;});let concurrentCalls=0;
  const slow=transport(async message=>{concurrentCalls++;started();await new Promise(resolve=>{release=resolve;});return provider(message);});
  const pending=slow(request('eventInvite',{...values,requestId:randomUUID()}));await begun;
  const active=(await db.query('SELECT invite_id FROM finfolk."EventInviteDelivery" WHERE state=\'sending\'')).rows[0].invite_id;
  const busy=await invoke(slow,'eventInviteRetry',{id:event.id,invite:active});assert.equal(busy.delivery.state,'sending');assert.equal(concurrentCalls,1);release();assert.equal((await pending).status,200);
  let loseAck=true;
  const uncertain=transport(provider,fn=>accountDatabase.transaction(async query=>fn(async(text,args)=>{if(loseAck&&text.includes('"event_delivery_complete"')){loseAck=false;throw Error('Synthetic lost acknowledgement');}return query(text,args);})))
  const uncertainId=randomUUID(),before=seen.size;assert.equal((await uncertain(request('eventInvite',{...values,requestId:uncertainId}))).status,503);assert.equal(seen.size,before+1);
  await db.query('UPDATE finfolk."EventInviteDelivery" SET lease_until=0 WHERE invite_id=$1',[uncertainId]);const recovered=await invoke(api,'eventInviteRetry',{id:event.id,invite:uncertainId});assert.equal(recovered.delivery.state,'sent');assert.equal(seen.size,before+1,'Provider idempotency recovers a lost DB acknowledgement without duplicate mail');
  const refused=await invoke(transport(async()=>{throw Error('Synthetic failed provider');}),'eventInvite',{...values,requestId:randomUUID()});await call('eventRevoke',{id:event.id,invite:refused.id});assert.equal((await row(refused.id)).state,'cancelled');assert.equal((await row(refused.id)).sealed_token,'');
  assert.equal((await invoke(api,'eventInviteRetry',{id:event.id,invite:refused.id})).delivery.state,'cancelled');
  let failureCalls=0;const permanent=transport(async()=>{failureCalls++;throw Error('Synthetic permanent provider failure');});
  const capped=await invoke(permanent,'eventInvite',{...values,email:'always-fail-'+randomUUID()+'@example.test',requestId:randomUUID()});
  for(let attempt=2;attempt<=5;attempt++)assert.equal((await invoke(permanent,'eventInviteRetry',{id:event.id,invite:capped.id})).delivery.attempts,attempt);
  assert.equal((await row(capped.id)).sealed_token,'','Exhausted work cannot retain a recoverable token');
  await invoke(permanent,'eventInviteRetry',{id:event.id,invite:capped.id});assert.equal(failureCalls,5,'Retries have a database-enforced bound');
  let releaseRevoked,startRevoked;const revokedStarted=new Promise(resolve=>{startRevoked=resolve;});
  const revokeInFlight=transport(async message=>{startRevoked();await new Promise(resolve=>{releaseRevoked=resolve;});return provider(message);});
  const pendingId=randomUUID(),revoking=revokeInFlight(request('eventInvite',{...values,email:'revoke-'+randomUUID()+'@example.test',requestId:pendingId}));await revokedStarted;
  await call('eventRevoke',{id:event.id,invite:pendingId});releaseRevoked();const revokedResponse=await revoking;assert.equal(revokedResponse.status,200);assert.equal((await revokedResponse.json()).delivery.state,'cancelled','A late provider acknowledgement cannot revive revoked work');assert.equal((await row(pendingId)).sealed_token,'');
  const roster=await call('eventRoster',{id:event.id});assert.ok(roster.invitations.every(i=>!Object.hasOwn(i,'sealed_token')&&!Object.hasOwn(i,'secret')&&!Object.hasOwn(i,'token')));assert.equal(JSON.stringify(roster).includes(deliveryKey),false);
  const organiser=randomUUID();extraUsers.push(organiser);await db.query('SELECT finfolk_rpc.sync_account_identity($1,true)',[organiser]);
  const ownedPage=(await accountDatabase.pool.query('SELECT finfolk_rpc.native_directory_owner_create($1,true,$2) value',[organiser,{requestId:randomUUID(),document:{name:'Erased organiser fixture',category:'Club',state:'NSW',sources:['https://example.test/owner'],socials:[]}}])).rows[0].value;pages.push(ownedPage.id);
  await db.query('UPDATE finfolk."DirectoryListing" SET status=\'published\' WHERE id=$1',[ownedPage.id]);
  await db.query('INSERT INTO finfolk."AccessRole"(class_table,class_context,access_id,member_id,from_id,level) SELECT \'DirectoryListing\',\'Global\',access_id,$2,$3,\'admin\' FROM finfolk."DirectoryListing" WHERE id=$1',[ownedPage.id,users[0].id,organiser]);
  const ownedEvent=(await accountDatabase.pool.query('SELECT finfolk_rpc.native_events_save($1,true,$2,$3) value',[organiser,'organiser@example.test',{page:ownedPage.id,title:'Erased organiser event',location:'Sydney',starts:new Date(Date.now()+86400000).toISOString(),ends:new Date(Date.now()+90000000).toISOString(),timezone:'Australia/Sydney',state:'published',visibility:'private'}])).rows[0].value;events.push(ownedEvent.id);
  const orphaned=await invoke(transport(async()=>{throw Error('Synthetic unavailable provider');}),'eventInvite',{id:ownedEvent.id,email:'pending-owner@example.test',send:true,requestId:randomUUID()});assert.ok((await row(orphaned.id)).sealed_token);
  await accountDatabase.pool.query('SELECT finfolk_rpc.erase_account($1)',[organiser]);assert.equal((await row(orphaned.id)).state,'cancelled');assert.equal((await row(orphaned.id)).sealed_token,'','Deleting the page owner clears another manager\'s pending encrypted delivery');
 }finally{
  for(const id of extraUsers)await db.query('SELECT finfolk_rpc.complete_account_deletion($1)',[id]);
  await db.query('DELETE FROM finfolk."UserRole" WHERE user_id=$1 AND role=\'admin\'',[users[0].id]);
  for(const [table,ids]of[['Event',events],['DirectoryListing',pages]]){const rows=(await db.query('DELETE FROM finfolk."'+table+'" WHERE id=ANY($1::uuid[]) RETURNING rev_id,audit_id,access_id'+(table==='DirectoryListing'?',social_id':''),[ids])).rows;for(const r of rows)for(const [provider,id]of[['Rev',r.rev_id],['Audit',r.audit_id],['Access',r.access_id],...(r.social_id?[['Social',r.social_id]]:[])])await db.query('DELETE FROM finfolk."'+provider+'" WHERE id=$1 AND class_table=$2',[id,table]);}
 }
}
