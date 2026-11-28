// Real native PostgreSQL and signed Instagram webhook, with synthetic provider I/O.
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHmac} from 'node:crypto';
import {connect} from './harness.mjs';
import {listing,user} from './fixtures/entities.mjs';
import {createSocialRuntime} from '../../backend/social-runtime.mjs';
import {createSocialInstagramAdapter} from '../../backend/social-instagram-adapter.mjs';
import {createSocialMemberHTTP} from '../../backend/social-member-http.mjs';
import {createNativeRPC} from '../../backend/native-rpc.mjs';
const db=await connect(),application=randomUUID(),inbox=randomUUID(),member=randomUUID(),other=randomUUID(),unverified=randomUUID(),accountId='99887766',secret='fixture-only';
const rpc=createNativeRPC(async(q,a)=>(await db.query(q,a)).rows),sends=[];let follower=true,handle='fixture.business',externalMismatch=false;
const doc={name:'Fixture Freediving School',category:'School',country:'Australia',state:'NSW',locality:'Bondi',description:'Synthetic business ownership test.',website:'https://business.example',sources:['https://business.example'],socials:['instagram:fixture.business'],image:''};
try{
 await db.query(await readFile('resources/finfolkdb/entity-schema.sql','utf8'));
 for(const f of ['account-grants.sql','messaging-grants.sql','social-grants.sql'])await db.query(await readFile('resources/finfolkdb/'+f,'utf8'));
 for(const id of [member,other,unverified])await user(db,id);await db.query('UPDATE finfolk."User" SET email_verified=false WHERE id=$1',[unverified]);
 const page=await listing(db,doc),wrongPage=await listing(db,{...doc,name:'Other school',socials:['instagram:other.business']});
 await db.query('UPDATE finfolk."DirectoryListing" SET status=\'published\' WHERE id=ANY($1::uuid[])',[[page.id,wrongPage.id]]);
 await db.query('INSERT INTO finfolk."MessagingApplication"(id,name) VALUES($1,\'Claim fixture\')',[application]);
 await db.query('INSERT INTO finfolk."MessagingAccount"(id,application_id,provider,account_id,mode,enabled_commands) VALUES($1,$2,\'instagram\',$3,\'live\',$4)',[inbox,application,accountId,JSON.stringify(['help','connect','claim','status','disconnect'])]);
 await db.query('GRANT finfolk_social TO CURRENT_USER WITH SET TRUE');await db.query('SET ROLE finfolk_social');
 const runtime=await createSocialRuntime({db:{query:async(q,a)=>(await db.query(q,a)).rows},application,inbox,provider:'instagram',cryptoKey:Buffer.alloc(32,2)});
 const adapter=createSocialInstagramAdapter({runtime,appSecret:secret,verifyToken:'fixture-verify',loadProvider:async()=>({profile:async()=>({follows:follower,handle}),sendText:async(to,body)=>{sends.push({to,body});return 'fixture-message-'+sends.length;}})});
 const claimPage=runtime.claimPageVerified.bind(runtime);runtime.claimPageVerified=async(...args)=>{try{return await claimPage(...args)}catch(e){console.error('CLAIM_RPC_ERROR',e.code,e.message,e.where);throw e;}};
 const liveAdapter={...adapter,verifyAccount:async(...args)=>{const v=await adapter.verifyAccount(...args);return externalMismatch?{...v,externalId:'different-sender'}:v;}};
 const http=createSocialMemberHTTP({runtime,adapter:liveAdapter,authenticate:async r=>{const id=r.headers.get('Authorization')?.slice(7);return [member,other,unverified].includes(id)?{id,verified:id!==unverified}:null;},allowedOrigins:['https://finfolk.com.au'],trustedIP:()=> 'fixture-client'});
 const post=async(id,code,actor=member,extra={})=>{const r=await http(new Request('https://api.finfolk.com.au/v1/me/instagram/claim',{method:'POST',headers:{Origin:'https://finfolk.com.au',Authorization:'Bearer '+actor,'Content-Type':'application/json'},body:JSON.stringify({id,code,...extra})}));return {status:r.status,body:await r.json()};};
 async function command(body,sender='123456'){
  const raw=JSON.stringify({object:'instagram',entry:[{id:accountId,messaging:[{sender:{id:sender},recipient:{id:accountId},timestamp:Date.now(),message:{mid:randomUUID(),text:body}}]}]});
  const request=()=>new Request('https://api.finfolk.com.au/instagram/webhook',{method:'POST',headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',secret).update(raw).digest('hex')},body:raw});
  assert.equal((await adapter.webhook(request())).status,200);assert.equal((await adapter.webhook(request())).status,200);
  for(let i=0;i<5;i++)if(!await runtime.processNext())break;
  for(let i=0;i<5;i++)if(!await runtime.performNextAction(adapter))break;
  for(let i=0;i<5;i++)if(!await runtime.deliverNext(adapter))break;
  return sends.at(-1)?.body;
 }
 assert.equal((await rpc('parse_social_command',['mention','@finfolk.com.au /claim'])).guidance,'use_dm');
 follower=false;const denied=await command('/claim','111111');assert.match(denied,/Follow.*\/claim/);assert.equal((await db.query('SELECT count(*)::int n FROM finfolk."SocialConnectionProof"')).rows[0].n,0);
 follower=true;handle='member.person';const personalReply=await command('/connect','222222'),personalCode=(assert.match(personalReply,/code:/,'Personal reply: '+personalReply),personalReply.match(/code: ([A-Z0-9-]+)/)[1]);
 assert(await runtime.redeemVerified(member,personalCode,'a'.repeat(64),adapter));const personal=await runtime.memberStatus(member);
 handle='fixture.business';const reply=await command('/claim');assert.match(reply,/business claim code/);const code=reply.match(/code: ([A-Z0-9-]+)/)[1];
 const proof=(await db.query('SELECT id,token_hash,provider_data FROM finfolk."SocialConnectionProof" WHERE provider_data->>\'purpose\'=\'claim\'')).rows[0];assert.equal(proof.provider_data.purpose,'claim');assert(!JSON.stringify(proof).includes(code));
 assert.equal(await runtime.redeemVerified(other,code,'b'.repeat(64),adapter),null,'A claim code cannot become a personal connection');
 assert.equal((await post(page.id,code,unverified)).status,403);assert.equal((await post(page.id,code,'no-session')).status,401);assert.equal((await post(page.id,code,member,{userId:other})).status,400);
 assert.equal((await post(wrongPage.id,code)).status,409,'Provider handle must match the target page');
 follower=false;assert.equal((await post(page.id,code)).status,409,'Follower eligibility is rechecked at redemption');follower=true;
 externalMismatch=true;assert.equal((await post(page.id,code)).status,409,'Provider subject must match the issued proof');externalMismatch=false;
 const result=await post(page.id,code);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.claimed,true);
 assert.equal((await post(page.id,code,other)).status,409,'A consumed claim proof cannot be replayed by another member');
 assert.equal((await db.query('SELECT count(*)::int n FROM finfolk."SocialConnectionProof" WHERE id=$1',[proof.id])).rows[0].n,0,'One-use claim proof is destroyed atomically');
 assert.deepEqual(await runtime.memberStatus(member),personal,'Claiming a business never changes the personal Instagram connection');
 await db.query('RESET ROLE');const owner=(await db.query('SELECT member_id,scope FROM finfolk."AccessRole" WHERE class_table=\'DirectoryListing\' AND access_id=$1 AND level=\'owner\' AND is_active',[page.access_id])).rows;assert.equal(owner.length,1);assert.equal(owner[0].member_id,member);assert.equal(owner[0].scope.provider,'instagram');assert.equal(owner[0].scope.applicationId,application);assert.equal(owner[0].scope.inboxId,inbox);assert.equal(owner[0].scope.externalId,'123456');
 assert.equal((await db.query('SELECT count(*)::int n FROM finfolk."AuditLog" WHERE audit_id=$1 AND entry->>\'event\'=\'instagram-claim\'',[page.audit_id])).rows[0].n,1);

 await db.query('SET ROLE finfolk_social');await db.query('DELETE FROM finfolk."SocialRateLimit"');
 handle='other.business';const expiring=(await command('/claim','333333')).match(/code: ([A-Z0-9-]+)/)[1];
 const hash=c=>createHmac('sha256','').update(c).digest('hex');
 await db.query("UPDATE finfolk.\"SocialConnectionProof\" SET expires_at=(extract(epoch FROM clock_timestamp())*1000000)::bigint-1 WHERE token_hash=encode(digest($1,'sha256'),'hex')",[expiring]);
 assert.equal((await post(wrongPage.id,expiring)).status,409,'Expired codes cannot claim');
 const stale=(await command('/claim','444444')).match(/code: ([A-Z0-9-]+)/)[1];
 await db.query("UPDATE finfolk.\"SocialAccount\" SET generation=generation+1 WHERE id=(SELECT account_id FROM finfolk.\"SocialConnectionProof\" WHERE token_hash=encode(digest($1,'sha256'),'hex'))",[stale]);
 assert.equal((await post(wrongPage.id,stale)).status,409,'Identity-generation changes invalidate claim codes');
 const paused=(await command('/claim','555555')).match(/code: ([A-Z0-9-]+)/)[1];await db.query('UPDATE finfolk."MessagingAccount" SET mode=\'disabled\' WHERE id=$1',[inbox]);assert.equal((await post(wrongPage.id,paused)).status,409,'Paused inboxes cannot grant page ownership');await db.query('UPDATE finfolk."MessagingAccount" SET mode=\'live\' WHERE id=$1',[inbox]);
 const connectOnly=(await command('/connect','666666')).match(/code: ([A-Z0-9-]+)/)[1];assert.equal((await post(wrongPage.id,connectOnly)).status,409,'Personal connection codes cannot claim business pages');
 const raceCode=(await command('/claim','777777')).match(/code: ([A-Z0-9-]+)/)[1];
 await db.query('DELETE FROM finfolk."SocialRateLimit"');
 const pool=new pg.Pool({connectionString:process.env.FINFOLK_TEST_DATABASE_URL,options:'-c role=finfolk_social',max:4});
 try{const concurrent=await createSocialRuntime({db:{query:async(q,a)=>(await pool.query(q,a)).rows},application,inbox,provider:'instagram',cryptoKey:Buffer.alloc(32,2)});
 const results=await Promise.all([concurrent.claimPageVerified(member,wrongPage.id,raceCode,'c'.repeat(64),adapter),concurrent.claimPageVerified(other,wrongPage.id,raceCode,'d'.repeat(64),adapter)]);assert.equal(results.filter(r=>r?.claimed).length,1,'Concurrent claims have exactly one winner');
 }finally{await pool.end()}
 await db.query('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM finfolk."AccessRole" WHERE class_table=\'DirectoryListing\' AND access_id=$1 AND level=\'owner\' AND is_active',[wrongPage.access_id])).rows[0].n,1);
 console.log('PAGE_INSTAGRAM_CLAIM_PASS: signed DM, duplicate receipts, follower gates, hashed purpose-bound code, fresh subject/handle evidence, verified member, unclaimed page owner, single use, personal connection unchanged, scoped audit.');
}finally{await db.query('RESET ROLE').catch(()=>{});await db.end();}
