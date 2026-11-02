import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {collectInstagramDM,processInstagramDM} from '../backend/messaging-engine.mjs';
import {seal} from '../backend/messaging-config.mjs';
import {windowFor} from '../backend/community-core.mjs';
const pg=process.env.FINFOLK_TEST_DATABASE_URL?await(await import('./db/harness.mjs')).compatDatabase(true):new PGlite();
const q=async(sql,args=[]) => (await pg.query(sql,args)).rows;
const db={query:q,transaction:fn=>pg.transaction(tx=>fn(async(sql,args=[]) => (await tx.query(sql,args)).rows))};
const scope='instagram-login:777:900',env={MESSAGING_ENCRYPTION_KEY:Buffer.alloc(32,8).toString('base64'),INSTAGRAM_MESSAGING_PROVIDER:'instagram-login',INSTAGRAM_MESSAGING_APP_ID:'777',INSTAGRAM_MESSAGING_CLIENT_SECRET:'test',INSTAGRAM_MESSAGING_ACCOUNT_ID:'900',INSTAGRAM_QUEUE:{send:async()=>{}}};
let follows=true,clock=Date.now()-20000;
const fetcher=async(url,options={})=>options.method==='POST'?{ok:true,json:async()=>({message_id:randomUUID()})}:{ok:true,json:async()=>({id:new URL(url).pathname.split('/').at(-1),username:'diver'+new URL(url).pathname.split('/').at(-1),is_user_follow_business:follows})};
const incoming=async(text,{sender='100',at=clock+=100,mid=randomUUID()}={})=>{
 await collectInstagramDM({sender:{id:sender},recipient:{id:'900'},timestamp:at,message:{mid,text}},env,q);
 const id='dm:'+scope+':'+mid;await processInstagramDM(id,env,db,{fetcher});
 const row=(await q('SELECT e.*,o.body FROM finfolk.instagram_dm_events e LEFT JOIN finfolk.messaging_outbox o ON o.event_id=e.id WHERE e.id=$1',[id]))[0];return {...row,mid};
};
const visits=()=>q("SELECT *,visit_day::text AS day FROM finfolk.checkins WHERE user_id='alice' ORDER BY visit_day,beach_id");
const originalLog=console.log;console.log=()=>{};
try{
 await pg.exec('CREATE SCHEMA neon_auth; CREATE TABLE neon_auth."user"(id text PRIMARY KEY,name text,"emailVerified" boolean,banned boolean); DO $$ BEGIN CREATE ROLE finfolk_api NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;');
 for(const file of(await readdir('backend/migrations')).filter(n=>n.endsWith('.sql')).sort()){
  if(file==='0029_instagram_visit_times.sql')await q(`UPDATE finfolk.messaging_accounts SET mode='pilot',generation=7,pilot_sender_ids='["100"]',enabled_commands='["help","checkin"]'`);
  await pg.exec(await readFile('backend/migrations/'+file,'utf8'));
 }
 const migrated=(await q('SELECT mode,generation,pilot_sender_ids,enabled_commands FROM finfolk.messaging_accounts'))[0];
 assert.deepEqual(migrated,{mode:'pilot',generation:7,pilot_sender_ids:['100'],enabled_commands:['help','in','out']});
 await pg.exec(`INSERT INTO neon_auth."user" VALUES('alice','Alice',true,false),('bob','Bob',true,false);INSERT INTO finfolk.members(user_id) VALUES('alice'),('bob');`);
 await q(`INSERT INTO finfolk.beaches(id,name,timezone,area_name,state) VALUES('brighton','Brighton Beach','Australia/Melbourne','Port Phillip Bay','VIC'),('brighton-wa','Brighton Beach','Australia/Perth','Perth','WA'),('portsea','Portsea Beach','Australia/Melbourne','Port Phillip Bay','VIC');`);
 await q(`INSERT INTO finfolk.instagram_connections(user_id,handle,sender_id,status,provider_scope) VALUES('alice','diver100','100','connected',$1),('bob','diver200','200','connected',$1)`,[scope]);
 await q(`UPDATE finfolk.messaging_accounts SET mode='live',enabled_commands='["help","in","out"]',account_id='900',provider_scope=$1,credential_ciphertext=$2,checks='{"authorization":true,"subscription":true,"followLookup":true}'`,[scope,seal({accessToken:'test'},env,scope)]);
 await pg.exec('GRANT USAGE ON SCHEMA finfolk TO finfolk_api; SET ROLE finfolk_api');
 assert.match((await incoming('/in Brighton Beach')).body,/Which beach/);assert.equal((await visits()).length,0);
 assert.match((await incoming('/in Brighton Beach, VIC')).body,/Checked in/);
 let rows=await visits();assert.equal(rows.length,1);assert.equal(rows[0].beach_id,'brighton');assert.equal(rows[0].day,windowFor(new Date(clock),'Australia/Melbourne').today);assert.equal(rows[0].checked_out_at,null);
 assert.match((await incoming('/in brighton')).body,/already checked in/);assert.equal((await visits()).length,1);
 assert.match((await incoming('/in Portsea Beach')).body,/Send \/out before/);
 assert.match((await incoming('/out',{at:clock-1000})).body,/older than/);assert.equal((await visits())[0].checked_out_at,null);
 assert.match((await incoming('/out',{sender:'200'})).body,/not checked in/);assert.equal((await visits())[0].checked_out_at,null,'Another member cannot close this visit');
 const departed=await incoming('/out');assert.match(departed.body,/Checked out/);const ended=String((await visits())[0].checked_out_at);assert.notEqual(ended,'null');
 await incoming('/out',{mid:departed.mid});assert.equal(String((await visits())[0].checked_out_at),ended,'Duplicate delivery cannot change departure time');
 assert.match((await incoming('/in brighton',{at:new Date(departed.message_at).getTime()-50})).body,/older than/);
 assert.match((await incoming('/in brighton')).body,/Checked in/);assert.equal((await visits()).length,1,'Returning on the same day keeps one visit day');assert.equal((await visits())[0].checked_out_at,null);
 follows=false;assert.equal((await incoming('/out')).processing_state,'blocked');assert.equal((await visits())[0].checked_out_at,null,'Follower checks gate departures');follows=true;
 assert.match((await incoming('/out')).body,/Checked out/);
 assert.match((await incoming('/out')).body,/not checked in/);
 assert.match((await incoming('/in brighton',{sender:'300'})).body,/not connected/);
 assert.match((await incoming('/out',{sender:'200'})).body,/not checked in/);
 assert.match((await incoming('/in portsea',{sender:'200',at:clock-50})).body,/older than/,'Out-of-order arrival cannot reopen after a departure');
 assert.equal((await q('SELECT count(*)::int AS count FROM finfolk.sessions'))[0].count,0,'Visits do not create or finish dive sessions');
 originalLog('INSTAGRAM_VISITS_PASS: migration rollout preservation, in/out lifecycle, date uniqueness, qualified locations, duplicate and stale delivery, follower/owner isolation and separate dive logs.');
}finally{console.log=originalLog;await pg.close();}
