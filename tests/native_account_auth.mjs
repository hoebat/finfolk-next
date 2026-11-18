import {mockEventDelivery} from '../scripts/lib/mock_event_delivery.mjs';
import {mockDirectorySearch} from '../scripts/lib/mock_directory_search.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {serve} from '@hono/node-server';
import {database as openDatabase} from '../backend/db.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {nativeEventDelivery} from './native_event_delivery.mjs';
import {nativeSiteReview} from './native_site_review.mjs';
import {nativeSites} from './native_sites.mjs';
import {nativeDiscovery} from './native_discovery.mjs';
import {nativeNotes} from './native_notes.mjs';
import {nativeEvents} from './native_events.mjs';
import {nativeDirectory} from './native_directory.mjs';
import {nativeProfile} from './native_profile.mjs';
import {nativeAccountBrowser} from './fixtures/native-account-browser.mjs';
import {supabase} from '../scripts/lib/local_supabase.mjs';
import {reconcileAccountDeletions} from '../backend/native-account-deletion.mjs';
import {createNativeAccount} from '../backend/native-account.mjs';
import {AuthClient} from '@supabase/auth-js';
import {createApplicationBackbone} from '../js/finfolk-next/packages/edge/application.js';
import {createAccountClient} from '../js/finfolk-next/packages/edge/supabase-client.js';
import {createAPI} from '../backend/api.mjs';
const status=JSON.parse(supabase(['status','--output','json']));
const url=status.API_URL, key=status.ANON_KEY, secret=status.SERVICE_ROLE_KEY;
assert.ok(url&&key&&secret,'Local Supabase Auth must be running');
assert.ok(['127.0.0.1','localhost'].includes(new URL(url).hostname));
const database=new URL(process.env.NATIVE_ACCOUNT_TEST_DB);
assert.equal(database.protocol,'postgresql:');assert.ok(['127.0.0.1','localhost'].includes(database.hostname));
assert.match(database.pathname,/^\/app_test_native_account_[a-f0-9]{32}$/);assert.equal(database.search,'');assert.equal(database.hash,'');
const db=new pg.Pool({connectionString:database.href});
const accountURL=new URL(database.href);accountURL.searchParams.set('options','-c role=finfolk_account');
const accountDatabase=openDatabase(accountURL.href),accountDB=accountDatabase.pool;
const owned=[];
const deliveryKey=randomUUID()+randomUUID();
const servers=[],browserAPIs=[];
async function startBrowserAPI(origin){
 const api=createAPI({db:accountDatabase,directorySearch:mockDirectorySearch,eventDelivery:mockEventDelivery,deliveryKey,invitationOrigin:origin,origins:[origin],verify:async()=>{throw Error('Legacy auth is unavailable in the native fixture');}});
 return new Promise(resolve=>{const server=serve({fetch:request=>api.fetch(request,{SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:secret}),hostname:'127.0.0.1',port:0},info=>resolve('http://127.0.0.1:'+info.port));browserAPIs.push(server);});
}
async function startServer(allowedOrigin){
 const serverURL=new URL(database.href);serverURL.searchParams.set('options','-c role=finfolk_account');
 const child=spawn(process.execPath,['backend/server.mjs'],{env:{...process.env,DATABASE_URL:serverURL.href,PORT:'0',FINFOLK_ALLOWED_ORIGINS:allowedOrigin||'',SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:secret,FINFOLK_ACCOUNT_CLEANUP_ENABLED:'false',NEON_AUTH_BASE_URL:'',NEON_AUTH_JWKS_URL:''},stdio:['ignore','pipe','pipe']});
 servers.push(child);
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Native API startup timed out')),20000);
  const fail=()=>{clearTimeout(timer);reject(Error('Native API failed to start'));};
  child.once('error',fail);child.once('exit',fail);
  child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/127\.0\.0\.1:[0-9]+/);if(match){clearTimeout(timer);child.off('error',fail);child.off('exit',fail);resolve(match[0]);}});
 });
}
async function auth(path,body,token=key,method='POST'){
 const r=await fetch(url+'/auth/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const value=await r.json();assert.ok(r.ok,'Local auth fixture request failed: '+r.status);return value;
}
const account=createNativeAccount({query:accountDatabase.query,transaction:accountDatabase.transaction,supabaseUrl:url,publishableKey:key,directorySearch:mockDirectorySearch,eventDelivery:mockEventDelivery,deliveryKey,invitationOrigin:'http://127.0.0.1:3011'});
const request=token=>new Request('http://local.test/account',{headers:token?{Authorization:'Bearer '+token}:{}});
try {
 const users=[];
 for(let i=0;i<2;i++){
  const email='native-'+randomUUID()+'@example.test',password=randomUUID()+'Aa1!';
  const u=await auth('admin/users',{email,password,email_confirm:true,user_metadata:{admin:true}},secret);owned.push(u.id);
  const session=await auth('token?grant_type=password',{email,password});
  users.push({id:u.id,email,password,...session});
 }
 await accountDB.query('SELECT finfolk_rpc.ensure_account($1)',[users[0].id]);
 assert.equal((await account(request())).status,401);
 assert.equal((await account(request('forged-token'))).status,401);
 const api=createAPI({db:accountDatabase,verify:async()=>{throw Error('Legacy auth must not be used')}});
 const routed=await api.fetch(new Request('http://local.test/v1/native/account?actor=forged',{headers:{Authorization:'Bearer '+users[0].access_token}}),{SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key});
 assert.equal((await api.fetch(new Request('http://local.test/v1/native/account'))).status,503);
 assert.equal(routed.status,200);assert.equal((await routed.json()).id,users[0].id);
 const first=await(await account(request(users[0].access_token))).json();
 assert.deepEqual(first,{id:users[0].id,profile:{displayName:'Diver'},verified:true});
 assert.deepEqual(await(await account(request(users[0].access_token))).json(),first);
 const concurrent=await Promise.all(Array.from({length:3},()=>account(request(users[1].access_token))));
 assert.ok(concurrent.every(response=>response.status===200));
 const second=await concurrent[0].json();assert.equal(second.id,users[1].id);assert.notEqual(second.id,first.id);
 const count=(await db.query('SELECT count(*)::int AS n FROM finfolk."User" WHERE id=ANY($1::uuid[])',[owned])).rows[0].n;assert.equal(count,2);
 const refreshed=await auth('token?grant_type=refresh_token',{refresh_token:users[0].refresh_token});
 assert.equal((await(await account(request(refreshed.access_token))).json()).id,first.id);
 async function operation(user,operation,values={}){
  return account(new Request('http://local.test/account',{method:'POST',headers:{Authorization:'Bearer '+user.access_token,'Content-Type':'application/json'},body:JSON.stringify({operation,values})}));
 }
 async function publicOperation(operation,values={},token){return account(new Request('http://local.test/account',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({operation,values})}));}
 const initialStatus=await(await operation(users[0],'postStatus')).json();assert.equal(initialStatus.admin,false,'User-editable Auth metadata must not grant application roles');assert.equal(initialStatus.enabled,false);
 await db.query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,$2)',[users[0].id,'admin']);
 assert.equal((await(await operation(users[0],'postStatus')).json()).admin,true);
 await assert.rejects(accountDB.query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,$2)',[users[1].id,'admin']),error=>error.code==='42501');
 await assert.rejects(accountDB.query('UPDATE finfolk."UserRole" SET role=$1 WHERE user_id=$2',['admin',users[1].id]),error=>error.code==='42501','Account transport cannot promote a role through UPDATE either');
 await db.query('DELETE FROM finfolk."UserRole" WHERE user_id=$1',[users[0].id]);
 await assert.rejects(db.query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,$2)',[users[0].id,'arbitrary']),error=>error.code==='23514');
 const previousRevision=(await db.query('SELECT r.index FROM finfolk."User" u JOIN finfolk."Rev" r ON r.id=u.rev_id WHERE u.id=$1',[users[0].id])).rows[0].index;
 const preferenceResponse=await operation(users[0],'preferences',{profile:{displayName:'  Alice  ',bio:'Ocean',open:true,sharing:{visits:true},activities:['freediving','freediving'],availability:['weekend mornings'],depthGoal:12,tiktok:'https://tiktok.com/@diver'}});
 assert.equal(preferenceResponse.status,200,await preferenceResponse.clone().text());
 const profile=await preferenceResponse.json();assert.equal(profile.displayName,'Alice');assert.equal(profile.open,true);assert.deepEqual(profile.activities,['freediving']);assert.equal(profile.sharing.depth,false);assert.equal(profile.tiktok,'https://www.tiktok.com/@diver/');
 const revision=(await db.query('SELECT r.index, l.deltas FROM finfolk."User" u JOIN finfolk."Rev" r ON r.id=u.rev_id JOIN finfolk."RevLog" l ON l.rev_id=r.id AND l.version=r.index WHERE u.id=$1',[users[0].id])).rows[0];assert.equal(revision.index,previousRevision+1);assert.deepEqual(revision.deltas,profile,'Profile history must agree with the latest committed profile');
 assert.equal((await operation(users[0],'preferences',{profile:{admin:true}})).status,400);
 assert.equal((await operation(users[0],'preferences',{profile:{activities:['unlisted']}})).status,400);
 assert.equal((await operation(users[0],'preferences',{profile:{tiktok:'https://evil.test/@diver'}})).status,400);
 assert.equal((await operation(users[0],'preferences',{profile:{beaches:[randomUUID()]}})).status,400);
 assert.equal((await operation(users[0],'preferences',{profile:{depthGoal:101}})).status,400);
 await assert.rejects(db.query('SELECT finfolk_rpc.save_account_preferences($1,$2::jsonb,false)',[users[0].id,JSON.stringify({open:true})]),error=>error.code==='42501');
 assert.equal((await operation(users[0],'block',{target:users[0].id})).status,400);
 assert.equal((await operation(users[0],'connection',{target:users[1].id,mode:'request'})).status,200);
 assert.equal((await operation(users[0],'connection',{target:users[1].id,mode:'accept'})).status,403);
 const pending=await(await operation(users[1],'connections')).json();assert.equal(pending.length,1);assert.equal(pending[0].requested_by,users[0].id);assert.equal(pending[0].status,'pending');
 assert.equal((await operation(users[1],'connection',{target:users[0].id,mode:'accept'})).status,200);
 assert.equal((await(await operation(users[0],'connections')).json())[0].status,'accepted');
 assert.equal((await operation(users[0],'block',{target:users[1].id})).status,200);
 assert.deepEqual(await(await operation(users[1],'connections')).json(),[]);
 assert.equal((await(await operation(users[0],'blocks')).json())[0].id,users[1].id);
 assert.equal((await operation(users[1],'connection',{target:users[0].id,mode:'request'})).status,404);
 assert.deepEqual(await(await operation(users[1],'blocks')).json(),[]);
 assert.equal((await operation(users[1],'unblock',{target:users[0].id})).status,200);
 assert.equal((await operation(users[1],'connection',{target:users[0].id,mode:'request'})).status,404,'Only the owner can remove a block');
 assert.equal((await operation(users[0],'unblock',{target:users[1].id})).status,200);
 assert.deepEqual(await(await operation(users[0],'connections')).json(),[],'Unblocking must not restore a connection');
 // A request blocked by erasure must recheck the target after its row lock.
 const raceUser=await auth('admin/users',{email:'native-race-'+randomUUID()+'@example.test',password:randomUUID()+'Aa1!',email_confirm:true},secret);owned.push(raceUser.id);
 await accountDB.query('SELECT finfolk_rpc.ensure_account($1)',[raceUser.id]);
 const eraser=await db.connect();let pendingConnection;
 try{
  await eraser.query('BEGIN');await eraser.query('SELECT id FROM finfolk."User" WHERE id=$1 FOR UPDATE',[raceUser.id]);
  pendingConnection=operation(users[0],'connection',{target:raceUser.id,mode:'request'});
  let blocked=false;for(let i=0;i<100;i++){
   blocked=(await db.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS blocked',[eraser.processID])).rows[0].blocked;
   if(blocked)break;await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.ok(blocked,'Concurrent connection must wait for the erasure row lock');
  await eraser.query('SELECT finfolk_rpc.erase_account($1)',[raceUser.id]);await eraser.query('COMMIT');
 }finally{await eraser.query('ROLLBACK');eraser.release();}
 assert.equal((await pendingConnection).status,404,'A concurrent request must not connect to a deleted account');
 assert.deepEqual(await reconcileAccountDeletions({query:accountDatabase.query,supabaseUrl:url,serviceRoleKey:secret}),{completed:1,pending:0});
 const siteId=randomUUID();await db.query('INSERT INTO finfolk."Site"(id,name,timezone) VALUES($1,$2,$3)',[siteId,'Native test beach','Australia/Sydney']);
 const today=(await db.query('SELECT (now() AT TIME ZONE timezone)::date::text AS day FROM finfolk."Site" WHERE id=$1',[siteId])).rows[0].day;
 const checkin=await operation(users[0],'checkin',{beachId:siteId});assert.equal(checkin.status,200,await checkin.clone().text());assert.deepEqual(await checkin.json(),{day:today,count:1,selfReported:true});
 const duplicateVisits=await Promise.all(Array.from({length:3},()=>operation(users[0],'checkin',{beachId:siteId})));for(const response of duplicateVisits){assert.equal(response.status,200);assert.equal((await response.json()).count,1);}
 assert.deepEqual(await(await operation(users[0],'myCheckins')).json(),[{beach_id:siteId,day:today,name:'Native test beach'}]);
 assert.deepEqual(await(await operation(users[1],'myCheckins')).json(),[]);
 assert.equal((await operation(users[0],'checkin',{beachId:randomUUID()})).status,404);
 assert.equal((await operation(users[0],'checkin',{beachId:siteId,actor:users[1].id})).status,400);
 await assert.rejects(accountDB.query('SELECT finfolk_rpc.record_community_checkin($1,$2,false)',[users[1].id,siteId]),error=>error.code==='42501');
 await db.query('INSERT INTO finfolk."UserCheckin"(user_id,site_id,visit_day) VALUES($1,$2,$3::date+1),($1,$2,$3::date-30)',[users[0].id,siteId,today]);
 assert.equal((await(await operation(users[0],'checkin',{beachId:siteId})).json()).count,1,'The rolling window excludes future visits and visits older than 30 days');
 await db.query('DELETE FROM finfolk."UserCheckin" WHERE user_id=$1 AND site_id=$2 AND visit_day<>$3::date',[users[0].id,siteId,today]);
 assert.equal((await operation(users[1],'removeCheckin',{beachId:siteId,day:today})).status,200);
 assert.equal((await(await operation(users[0],'myCheckins')).json()).length,1,'Another actor cannot remove a private visit');
 assert.equal((await operation(users[0],'removeCheckin',{beachId:siteId,day:'2026-02-31'})).status,400);
 assert.equal((await operation(users[0],'removeCheckin',{beachId:siteId,day:'infinity'})).status,400);
 assert.deepEqual(await(await operation(users[0],'removeCheckin',{beachId:siteId,day:today})).json(),{removed:true});
 assert.deepEqual(await(await operation(users[0],'myCheckins')).json(),[]);
 const peopleQuery={mode:'discover',seed:'native-people-mix'};
 const aliceVisible=await operation(users[1],'community',peopleQuery);assert.equal(aliceVisible.status,200,await aliceVisible.clone().text());
 const initialPeople=await aliceVisible.json();assert.equal(initialPeople.people.length,1);assert.equal(initialPeople.people[0].id,users[0].id);assert.equal(initialPeople.people[0].displayName,'Alice');assert.equal(initialPeople.cursor,null);assert.equal(initialPeople.people[0].connection,null,'Removed connections must become connectable again');
 assert.deepEqual((await(await operation(users[0],'community',peopleQuery)).json()).people,[],'Closed profiles must stay outside discovery');
 const mixUsers=Array.from({length:8},()=>randomUUID());
 for(const [i,id] of mixUsers.entries()){
  await accountDB.query('SELECT finfolk_rpc.ensure_account($1)',[id]);
  await accountDB.query('SELECT finfolk_rpc.save_account_preferences($1,$2::jsonb,true)',[id,JSON.stringify({displayName:'Mix '+i,open:true,bio:'Public bio',beaches:[siteId],availability:['weekend mornings'],experience:'new'})]);
 }
 const filtered={...peopleQuery,beachId:siteId,availability:'weekend mornings',experience:'new'};
 const firstMix=await(await operation(users[1],'community',filtered)).json();assert.equal(firstMix.people.length,6);assert.ok(firstMix.cursor);
 assert.deepEqual(await(await operation(users[1],'community',filtered)).json(),firstMix,'The same mix seed must give stable pages');
 const lastMix=await(await operation(users[1],'community',{...filtered,cursor:firstMix.cursor})).json();assert.equal(lastMix.people.length,2);assert.equal(lastMix.cursor,null);
 assert.deepEqual([...firstMix.people,...lastMix.people].map(row=>row.id).sort(),mixUsers.slice().sort(),'Cursor pages must contain every eligible user once');
 assert.equal((await operation(users[1],'community',{...filtered,seed:'different-people-mix',cursor:firstMix.cursor})).status,400);
 assert.equal((await operation(users[0],'community',{...filtered,cursor:firstMix.cursor})).status,400,'A cursor belongs to its verified actor');
 assert.equal((await operation(users[1],'community',{...filtered,experience:'comfortable',cursor:firstMix.cursor})).status,400,'Changed filters require a new cursor');
 assert.equal((await operation(users[1],'block',{target:mixUsers[0]})).status,200);
 await accountDB.query('SELECT finfolk_rpc.set_account_block($1,$2,true)',[mixUsers[1],users[1].id]);
 await accountDB.query("SELECT finfolk_rpc.set_account_connection($1,$2,'request',true)",[mixUsers[2],users[1].id]);
 assert.equal((await operation(users[1],'connection',{target:mixUsers[2],mode:'decline'})).status,200);
 await accountDB.query("SELECT finfolk_rpc.set_account_connection($1,$2,'request',true)",[mixUsers[3],users[1].id]);
 assert.equal((await operation(users[1],'connection',{target:mixUsers[3],mode:'accept'})).status,200);
 assert.equal((await db.query('SELECT count(*)::int n FROM finfolk."UserRole" WHERE user_id=$1',[users[1].id])).rows[0].n,0);
 await db.query('UPDATE finfolk."User" SET deleted=true WHERE id=$1',[mixUsers[4]]);
 await accountDB.query('SELECT finfolk_rpc.save_account_preferences($1,$2::jsonb,true)',[mixUsers[5],JSON.stringify({open:false})]);
 await db.query("UPDATE finfolk.\"User\" SET profile=profile||jsonb_build_object('privateNote','Never expose this') WHERE id=$1",[mixUsers[3]]);
 const safeMix=await(await operation(users[1],'community',filtered)).json();assert.deepEqual(safeMix.people.map(row=>row.id).sort(),[mixUsers[3],mixUsers[6],mixUsers[7]].sort());
 assert.equal(safeMix.people.find(row=>row.id===mixUsers[3]).connection,'accepted');assert.ok(!JSON.stringify(safeMix).includes('Never expose this'));
 assert.equal((await operation(users[1],'community',{...peopleQuery,seed:'short'})).status,400);
 assert.equal((await operation(users[1],'community',{...peopleQuery,availability:'unlisted'})).status,400);
 for(const id of mixUsers){await accountDB.query('SELECT finfolk_rpc.erase_account($1)',[id]);await accountDB.query('SELECT finfolk_rpc.complete_account_deletion($1)',[id]);}
 const sessionValues={date:today,locationName:'Native test beach',beachId:siteId,point:[151,-33],durationMinutes:45,maxDepthMetres:12.5,notes:'Private native session'};
 const savedResponse=await operation(users[0],'saveSession',{values:sessionValues});assert.equal(savedResponse.status,200,await savedResponse.clone().text());const savedSession=await savedResponse.json();assert.match(savedSession.id,/^[a-f0-9-]{36}$/);
 const privateSession=await(await operation(users[0],'session',{id:savedSession.id})).json();assert.deepEqual(privateSession,{...sessionValues,id:savedSession.id,ownerId:users[0].id,visibility:'private',photos:[],linkedMedia:[]});
 assert.equal(await(await operation(users[1],'session',{id:savedSession.id})).json(),null,'Private sessions are invisible to another actor');
 assert.equal((await operation(users[1],'saveSession',{id:savedSession.id,values:sessionValues})).status,404);
 assert.equal((await operation(users[1],'deleteSession',{id:savedSession.id})).status,404);
 assert.equal((await operation(users[0],'saveSession',{values:{...sessionValues,visibility:'public'}})).status,400);
 assert.equal((await operation(users[0],'saveSession',{values:{...sessionValues,photos:['forged']}})).status,400);
 for(const patch of [{date:'2026-02-31'},{durationMinutes:1441},{maxDepthMetres:-1},{point:[181,0]}])assert.equal((await operation(users[0],'saveSession',{values:{...sessionValues,...patch}})).status,400);
 await assert.rejects(accountDB.query('SELECT finfolk_rpc.save_private_session($1,NULL,$2::jsonb)',[users[0].id,JSON.stringify({...sessionValues,visibility:'public'})]),error=>error.code==='22023');
 assert.equal((await operation(users[0],'saveSession',{values:{...sessionValues,beachId:randomUUID()}})).status,404);
 assert.deepEqual(await(await operation(users[1],'sessions',{owner:users[0].id,publicOnly:false})).json(),{sessions:[],cursor:null,more:false},'Another member can browse only published sessions, regardless of publicOnly input');
 const streams=(await db.query('SELECT rev_id,audit_id FROM finfolk."DiveSession" WHERE id=$1',[savedSession.id])).rows[0];
 assert.deepEqual(await(await operation(users[0],'saveSession',{id:savedSession.id,values:{...sessionValues,notes:'Edited private session'}})).json(),savedSession);
 const latestSessionVersion=(await db.query('SELECT r.index,l.deltas FROM finfolk."Rev" r JOIN finfolk."RevLog" l ON l.rev_id=r.id AND l.version=r.index WHERE r.id=$1',[streams.rev_id])).rows[0];assert.equal(latestSessionVersion.index,2);assert.equal(latestSessionVersion.deltas.notes,'Edited private session');
 const sessionIds=[savedSession.id];for(let i=0;i<51;i++){const row=(await accountDB.query('SELECT finfolk_rpc.save_private_session($1,NULL,$2::jsonb) AS value',[users[0].id,JSON.stringify({...sessionValues,notes:'Page '+i})])).rows[0].value;sessionIds.push(row.id);}
 const firstSessions=await(await operation(users[0],'sessions',{})).json();assert.equal(firstSessions.sessions.length,50);assert.equal(firstSessions.more,true);assert.ok(firstSessions.cursor);
 const lastSessions=await(await operation(users[0],'sessions',{cursor:firstSessions.cursor})).json();assert.equal(lastSessions.sessions.length,2);assert.equal(lastSessions.more,false);assert.equal(lastSessions.cursor,null);
 assert.deepEqual([...firstSessions.sessions,...lastSessions.sessions].map(row=>row.id).sort(),sessionIds.slice().sort(),'Private cursor pages contain each owned session once');
 assert.deepEqual((await(await operation(users[1],'sessions',{})).json()).sessions,[]);
 assert.equal((await operation(users[0],'sessions',{cursor:'invalid'})).status,400);
 assert.equal(await(await publicOperation('publicSession',{id:savedSession.id})).json(),null);
 assert.deepEqual(await(await publicOperation('publicSessions',{owner:users[0].id})).json(),{sessions:[],cursor:null,more:false});
 assert.equal((await publicOperation('visibility',{id:savedSession.id,visibility:'public'})).status,401);
 assert.equal((await operation(users[1],'visibility',{id:savedSession.id,visibility:'public'})).status,404);
 await assert.rejects(accountDB.query("SELECT finfolk_rpc.set_session_visibility($1,$2,'public',false)",[users[0].id,savedSession.id]),error=>error.code==='42501');
 assert.deepEqual(await(await operation(users[0],'visibility',{id:savedSession.id,visibility:'public'})).json(),{visibility:'public'});
 const sharedSession=await(await publicOperation('publicSession',{id:savedSession.id})).json();assert.equal(sharedSession.visibility,'public');assert.equal(sharedSession.notes,'Edited private session');assert.equal(sharedSession.ownerId,users[0].id);
 assert.equal((await(await operation(users[1],'session',{id:savedSession.id})).json()).visibility,'public');
 const sharedList=await(await publicOperation('publicSessions',{owner:users[0].id,publicOnly:false})).json();assert.deepEqual(sharedList.sessions.map(row=>row.id),[savedSession.id],'Anonymous browsing must exclude all 51 private records');
 assert.equal((await operation(users[0],'saveSession',{id:savedSession.id,values:sessionValues})).status,403,'Publishing freezes edits until the owner makes the session private');
 await db.query("UPDATE finfolk.\"User\" SET profile=profile||jsonb_build_object('privateNote','Never share this private note') WHERE id=$1",[users[0].id]);
 const publicProfile=await(await publicOperation('publicProfile',{target:users[0].id},users[0].access_token)).json();assert.equal(publicProfile.displayName,'Alice');assert.equal(Object.hasOwn(publicProfile,'privateNote'),false);assert.equal(Object.hasOwn(publicProfile,'sharing'),false,'Public entrypoints stay anonymous even for the owner bearer');
 assert.equal((await(await operation(users[0],'profile',{target:users[0].id})).json()).privateNote,'Never share this private note');
 assert.equal((await operation(users[0],'block',{target:users[1].id})).status,200);
 assert.equal(await(await operation(users[1],'session',{id:savedSession.id})).json(),null);
 assert.deepEqual((await(await operation(users[1],'sessions',{owner:users[0].id})).json()).sessions,[]);
 assert.equal((await operation(users[1],'profile',{target:users[0].id})).status,404);
 assert.equal((await(await publicOperation('publicSession',{id:savedSession.id})).json()).visibility,'public','A public link stays public; member views still respect blocks');
 assert.equal((await operation(users[0],'unblock',{target:users[1].id})).status,200);
 await operation(users[0],'preferences',{profile:{open:false}});
 const closedProfile=await(await publicOperation('publicProfile',{target:users[0].id})).json();assert.deepEqual(Object.keys(closedProfile).sort(),['id','uid','displayName','open','restricted'].sort());assert.equal(closedProfile.restricted,true);
 assert.equal((await operation(users[1],'connection',{target:users[0].id,mode:'request'})).status,200);
 assert.equal((await operation(users[0],'connection',{target:users[1].id,mode:'accept'})).status,200);
 const buddyHeader=await(await operation(users[1],'profile',{target:users[0].id})).json();assert.equal(buddyHeader.restricted,false);assert.equal(buddyHeader.bio,'Ocean');assert.equal(Object.hasOwn(buddyHeader,'privateNote'),false);
 assert.equal((await(await publicOperation('publicProfile',{target:users[0].id},users[1].access_token)).json()).restricted,true,'Buddy authorization must not enter the anonymous profile cache');
 assert.equal((await operation(users[1],'connection',{target:users[0].id,mode:'remove'})).status,200);

 await operation(users[0],'preferences',{profile:{open:true}});
 await db.query(`UPDATE finfolk."DiveSession" SET detail=jsonb_set(detail,'{photos}','["0"]'::jsonb) WHERE id=$1`,[savedSession.id]);
 assert.equal(await(await publicOperation('publicSession',{id:savedSession.id})).json(),null,'Unverified media must not cross the public boundary after publication either');
 assert.equal((await operation(users[0],'visibility',{id:savedSession.id,visibility:'public'})).status,403);
 await db.query(`UPDATE finfolk."DiveSession" SET detail=jsonb_set(detail,'{photos}','[]'::jsonb) WHERE id=$1`,[savedSession.id]);
 assert.deepEqual(await(await operation(users[0],'visibility',{id:savedSession.id,visibility:'private'})).json(),{visibility:'private'});
 assert.equal(await(await publicOperation('publicSession',{id:savedSession.id})).json(),null);
 assert.deepEqual((await(await publicOperation('publicSessions',{owner:users[0].id})).json()).sessions,[]);
 assert.deepEqual(await(await operation(users[0],'deleteSession',{id:savedSession.id})).json(),{deleted:true});
 assert.equal(await(await operation(users[0],'session',{id:savedSession.id})).json(),null);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."Rev" WHERE id=$1',[streams.rev_id])).rows[0].n,0,'Deleting a session removes private revision history');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."Audit" WHERE id=$1',[streams.audit_id])).rows[0].n,0);
 for(const id of sessionIds.slice(1))await accountDB.query('SELECT finfolk_rpc.delete_private_session($1,$2)',[users[0].id,id]);
 await nativeProfile({db,users,operation,siteId,today});
 await nativeDirectory({db,users,operation,publicOperation});
 await nativeEvents({db,nativeQuery:accountDB,users,operation,publicOperation});
 await nativeNotes({db,users,operation,publicOperation});
 await nativeDiscovery({db,accountDatabase,users,operation,publicOperation,supabaseUrl:url,publishableKey:key});
 await nativeSites({db,users,publicOperation});
 await nativeSiteReview({db,accountDatabase,users,operation,publicOperation});
 await nativeEventDelivery({db,accountDatabase,users,operation,url,key,deliveryKey});
 const apiOrigin=await startServer();
 const networkFetch=globalThis.fetch;
 let client,authSDK;
 let holdNext=false,failNextAfterCommit=false,releasePending,signalStarted;
 const started=new Promise(resolve=>{signalStarted=resolve;});
 try {
  globalThis.fetch=(input,options)=>{
   const request=new Request(input,options);
   return new URL(request.url).origin===apiOrigin
    ?networkFetch(request).then(async response=>{if(failNextAfterCommit){failNextAfterCommit=false;assert.equal(response.status,200);return Response.json({error:'Injected response failure after the real write'},{status:503});}if(holdNext){holdNext=false;signalStarted();await new Promise(resolve=>{releasePending=resolve;});}return response;})
    :networkFetch(input,options);
  };
  authSDK=new AuthClient({url:url+'/auth/v1',headers:{apikey:key},persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});
  client=createAccountClient(authSDK,{supabaseUrl:url,apiUrl:apiOrigin+'/'},createApplicationBackbone({authUrl:url,apiUrl:apiOrigin+'/',cacheBackend:'memory'}));await client.ready;
  await assert.rejects(()=>client.request('/legacy-unmigrated',{}),error=>error.status===501&&error.code==='native_operation_unavailable','Native clients must explicitly gate unsupported REST adapters');
  assert.equal(client.user,null);
  await client.email(users[1].email,users[1].password);
  assert.equal(client.user.uid,users[1].id);
  assert.equal((await client.call('me',{})).id,users[1].id);
  await client.refresh();assert.equal((await client.call('me',{})).id,users[1].id);
  assert.deepEqual(await client.call('connections',{}),[]);
  const saved=await client.call('preferences',{profile:{displayName:'Bob'}});assert.equal(saved.displayName,'Bob');
  assert.equal((await client.call('me',{})).profile.displayName,'Bob');
  assert.equal(client.user.emailVerified,true);
  await assert.rejects(client.reauthenticate('wrong-password'));
  await assert.rejects(client.resetPassword('forged-token','Unused123!'),/recovery link/);
  const link=await auth('admin/generate_link',{type:'recovery',email:users[1].email},secret);
  const hash=link.hashed_token??link.properties?.hashed_token;assert.ok(hash,'Local recovery proof must be generated by Supabase Auth');
  const recovered=await authSDK.verifyOtp({token_hash:hash,type:'recovery'});assert.equal(recovered.error,null);
  assert.equal(client.user.recovery,true);
  const newPassword=randomUUID()+'Bb2!';await client.resetPassword(null,newPassword);
  assert.equal(client.user.recovery,false);
  await assert.rejects(client.reauthenticate(users[1].password));
  await client.reauthenticate(newPassword);users[1].password=newPassword;
  await assert.rejects(client.call('preferences',{profile:{admin:true}}),error=>error.status===400&&!error.mutationOutcomeUnknown);
  failNextAfterCommit=true;
  await assert.rejects(client.call('preferences',{profile:{displayName:'Committed despite response failure'}}),error=>error.mutationOutcomeUnknown===true);
  await assert.rejects(client.call('preferences',{profile:{displayName:'Must not retry'}}),/Reload before making another change/);
  await client.refresh();assert.equal((await client.call('me',{})).profile.displayName,'Committed despite response failure','A refresh must reveal the committed write without applying it twice');
  holdNext=true;
  const inflight=client.call('me',{}).then(()=>({resolved:true}),error=>({resolved:false,message:error.message}));
  await started;await client.signOut();releasePending();
  assert.equal((await inflight).resolved,false,'An account response arriving after sign-out must be rejected');
  assert.equal(client.user,null);
  assert.throws(()=>client.call('me',{}),/Sign in first/);
 } finally {releasePending?.();client?.close();authSDK?.stopAutoRefresh();globalThis.fetch=networkFetch;}
 await db.query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,\'admin\')',[users[1].id]);
 await db.query('UPDATE finfolk."Site" SET state=\'VIC\',area_name=\'Example Area\' WHERE id=$1',[siteId]);
 await db.query('INSERT INTO finfolk."SiteProfile"(site_id,revision,waterbody,access_mode,status,payload) VALUES($1,1,\'ocean\',\'shore\',\'published\',$2)',[siteId,{point:[145,-38],region:'example-bay',area_id:'example-area'}]);
 await db.query('INSERT INTO finfolk."SiteCatalog"(revision,metadata) VALUES(1,\'{}\')');
 await nativeAccountBrowser({apiOrigin,startAPI:startBrowserAPI,supabaseUrl:url,publishableKey:key,email:users[1].email,password:users[1].password,userId:users[1].id,siteId,peerId:users[0].id});
 await db.query('UPDATE finfolk."User" SET deleted=true WHERE id=$1',[first.id]);
 assert.equal((await account(request(refreshed.access_token))).status,403);
 await db.query('UPDATE finfolk."User" SET deleted=false WHERE id=$1',[first.id]);
 const ownedSession=(await db.query("SELECT finfolk_rpc.insert_dive_session($1,$2,'{\"notes\":\"Erase this private note\"}'::jsonb,finfolk.op_fn('test',$1,'{}'::jsonb)) AS value",[users[0].id,siteId])).rows[0].value;
 const noCleanup=await operation(users[0],'deleteAccount',{password:users[0].password});assert.equal(noCleanup.status,503);
 assert.equal((await account(request(users[0].access_token))).status,200,'Missing cleanup credentials must not erase data');
 const pendingAccount=createNativeAccount({query:accountDatabase.query,transaction:accountDatabase.transaction,supabaseUrl:url,publishableKey:key,serviceRoleKey:secret,adminFetch:async()=>Response.json({error:'provider unavailable'},{status:503})});
 const deletionRequest=password=>new Request('http://local.test/account',{method:'POST',headers:{Authorization:'Bearer '+users[0].access_token,'Content-Type':'application/json'},body:JSON.stringify({operation:'deleteAccount',values:{password}})});
 assert.equal((await pendingAccount(deletionRequest('wrong-password'))).status,401);
 assert.equal((await account(request(users[0].access_token))).status,200);
 const pendingDeletion=await pendingAccount(deletionRequest(users[0].password));assert.equal(pendingDeletion.status,503);assert.equal((await pendingDeletion.json()).dataDeleted,true);
 const tombstone=(await db.query('SELECT profile,deleted,deletion_state,rev_id FROM finfolk."User" WHERE id=$1',[users[0].id])).rows[0];assert.equal(tombstone.deleted,true);assert.equal(tombstone.deletion_state,'pending_auth');assert.deepEqual(tombstone.profile,{});
 assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."DiveSession" WHERE owner_id=$1',[users[0].id])).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."Rev" WHERE id=$1',[ownedSession['rev_id']])).rows[0].n,0);
 assert.deepEqual((await db.query('SELECT current FROM finfolk."Rev" WHERE id=$1',[tombstone.rev_id])).rows[0].current,{});
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk."RevLog" WHERE rev_id=$1 AND deltas<>'{}'::jsonb`,[tombstone.rev_id])).rows[0].n,0,'Private revision history must be scrubbed');
 assert.equal((await account(request(users[0].access_token))).status,403,'A valid old JWT must not recreate a deleted native account');
 const retry=await reconcileAccountDeletions({query:accountDatabase.query,supabaseUrl:url,serviceRoleKey:secret});assert.deepEqual(retry,{completed:1,pending:0});
 assert.equal((await db.query('SELECT deletion_state FROM finfolk."User" WHERE id=$1',[users[0].id])).rows[0].deletion_state,'complete');
 assert.equal((await account(request(users[0].access_token))).status,401,'Managed Auth identity must be removed after cleanup');
 assert.equal((await account(new Request('http://local.test/account',{method:'PUT'}))).status,405);
 console.log('PASS: real Supabase sign-in/refresh, native idempotent provisioning, actor isolation, invalid tokens and deleted account rejection');
} finally {
 try { for(const id of owned){const response=await fetch(url+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+secret}});assert.ok(response.ok||response.status===404,'Owned Auth user cleanup failed');} }
 finally { for(const server of browserAPIs)await new Promise(resolve=>server.close(resolve));for(const server of servers){if(server.exitCode===null){const closed=once(server,'exit');server.kill();await closed;}} await accountDB.end();await db.end(); }
}
