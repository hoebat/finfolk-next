import assert from 'node:assert/strict';
import pg from 'pg';
import {connect,migrate,apiDatabase} from './harness.mjs';
import {withActor,memberProfile,recordMemberCheckin} from '../../backend/backbone.mjs';
import {createAPI} from '../../backend/api.mjs';
const owner=await connect(),pool=new pg.Pool({connectionString:process.env.FINFOLK_TEST_DATABASE_URL,max:4,options:'-c role=finfolk_api'}),db=apiDatabase(pool);
try{
 await migrate(owner);
 await owner.query(`INSERT INTO neon_auth."user" VALUES('alice','Alice',true,false),('bob','Bob',true,false);
 INSERT INTO finfolk.members(user_id,profile) VALUES('alice','{"displayName":"Alice"}'),('bob','{"displayName":"Bob"}');
 INSERT INTO finfolk.beaches(id,name,timezone) VALUES('bondi','Bondi','Australia/Sydney');`);
 const results=await Promise.all(Array.from({length:24},(_,i)=>withActor(db,i%2?'alice':'bob',async q=>{
  await q('SELECT pg_sleep(0.005)');return (await q('SELECT finfolk_rpc.actor_id() AS actor,finfolk_rpc.member_profile() AS profile'))[0];
 })));
 for(const row of results)assert.equal(row.profile.displayName,row.actor==='alice'?'Alice':'Bob');
 const checkins=await Promise.all(Array.from({length:16},()=>recordMemberCheckin(db,'alice','bondi')));
 assert.ok(checkins.every(c=>c.count===1));assert.equal((await owner.query('SELECT count(*)::int AS n FROM finfolk.checkins')).rows[0].n,1);
 await Promise.all(Array.from({length:12},(_,i)=>assert.rejects(withActor(db,i%2?'alice':'bob',async q=>{await q('SELECT pg_sleep(0.002)');throw Error('intentional rollback');}),/intentional rollback/)));
 for(let i=0;i<8;i++)assert.equal((await db.query('SELECT finfolk_rpc.actor_id() AS actor'))[0].actor,'');
 assert.deepEqual(await memberProfile(db,'bob'),{displayName:'Bob'});
 const env={DB_BACKBONE_ENABLED:'true',ENVIRONMENT:'next',COMMUNITY_POSTS_ENABLED:'true',INSTAGRAM_ADMIN_IDS:'alice'};
 const app=createAPI({db,verify:async sub=>({sub}),origins:['https://finfolk.com.au']});
 async function call(actor,action,values={}){
  const r=await app.fetch(new Request('https://finfolk.com.au/api',{method:'POST',headers:{Authorization:'Bearer '+actor,'Content-Type':'application/json'},body:JSON.stringify({action,...values})}),env);
  return {status:r.status,body:await r.json()};
 }
 const connections=await Promise.all(Array.from({length:4},()=>call('alice','connection',{target:'bob',mode:'request'})));
 assert.ok(connections.every(r=>r.status===200));assert.equal((await owner.query('SELECT count(*)::int AS n FROM finfolk.connections')).rows[0].n,1);
 assert.equal((await call('bob','connection',{target:'alice',mode:'accept'})).status,200);
 assert.equal((await call('alice','block',{target:'bob'})).status,200);
 assert.equal((await call('bob','connection',{target:'alice',mode:'request'})).status,404);
 await call('alice','unblock',{target:'bob'});
 const created=await call('alice','saveSession',{values:{date:'2026-11-01',locationName:'Bondi',beachId:'bondi',notes:'Private fixture'}});
 assert.equal(created.status,200);const id=created.body.data.id;
 assert.equal((await call('bob','session',{id})).status,404);
 assert.equal((await call('alice','visibility',{id,visibility:'public'})).status,200);
 assert.equal((await call('bob','session',{id})).body.data.notes,'Private fixture');
 assert.equal((await call('alice','deleteSession',{id})).status,200);
 assert.equal((await call('alice','session',{id})).status,404);
 console.log('FINFOLKDB_TRANSACTIONS_PASS: concurrent pooled actors, duplicate check-ins, rollback, buddy/block races and session ownership/visibility.');
}finally{await pool.end();await owner.end();}
