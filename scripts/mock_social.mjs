import {spawn} from 'node:child_process';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {ensureSupabase,connectAdmin,withTestDatabase} from './lib/local_supabase.mjs';
import {createMockSocial,signMock} from '../backend/messaging-mock.mjs';
export async function withMock(work){
 const base=ensureSupabase(),admin=await connectAdmin(base);
 try{return await withTestDatabase(admin,base,async url=>{
  const fixture=await new Promise((resolve,reject)=>{
   let output='';
   const child=spawn('lein',['run','-m','finfolkbuild.testing.mock'],{stdio:['ignore','pipe','inherit'],env:{...process.env,FINFOLK_TEST_DATABASE_URL:url.toString()}});
   child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{output+=chunk;});
   child.on('error',reject);child.on('exit',code=>{
    const line=output.split('\n').find(value=>value.startsWith('MOCK_FIXTURE:'));
    if(code||!line)return reject(Error('Native mock setup failed'));
    try{resolve(JSON.parse(line.slice('MOCK_FIXTURE:'.length)));}catch{reject(Error('Invalid native fixture output'));}
   });
  });
  const pool=new pg.Pool({connectionString:url.toString()});
  const db={query:(...a)=>pool.query(...a),transaction:async work=>{const c=await pool.connect();try{await c.query('BEGIN');const value=await work(c.query.bind(c));await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
  let mock;try{mock=await createMockSocial({db,databaseURL:url.toString(),fixture,enabled:true});return await work(mock,db);}finally{await mock?.close();await pool.end();}
 });}finally{await admin.end();}
}
async function main(){
 const [command,...args]=process.argv.slice(2);
 if(command==='start')return withMock(async mock=>{
  console.log(JSON.stringify({url:mock.url,secret:mock.secret,adminToken:mock.adminToken,inboxes:mock.inboxes,members:mock.memberTokens}));
  await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
 });
 const [url,credential,...rest]=args;
 if(!url||!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Supply a running loopback mock URL and credential');
 let path='/__mock/'+command,body,headers={authorization:'Bearer '+credential,'content-type':'application/json'};
 if(command==='send'||command==='send-comment'){
  const [inbox,sender,...text]=rest,id=randomUUID();body=JSON.stringify({version:1,inbox,events:[{eventId:id,messageId:id,...(command==='send'?{threadId:sender}:{}),senderId:sender,text:text.join(' '),channel:command==='send'?'message':'mention',timestamp:Date.now()}]});
  path='/v1/messaging/webhooks/mock';headers['mock-signature']=signMock(body,credential);
 }else if(command==='redeem')body=JSON.stringify({inbox:rest[0],code:rest[1]});
 else if(command==='disconnect')body=JSON.stringify({inbox:rest[0],connectionId:rest[1],identityVersion:rest[2]});
 else if(command==='outcome')body=JSON.stringify({outcome:rest[0]});
 else if(!['replies','inspect','drain'].includes(command))throw Error('Commands: start, send, send-comment, drain, replies, inspect, redeem, disconnect, outcome');
 const response=await fetch(url+path,{method:['replies','inspect'].includes(command)?'GET':'POST',headers,body});console.log(response.status,await response.text());
}
if(process.argv[1]?.endsWith('/mock_social.mjs'))main().catch(e=>{console.error(e.message);process.exitCode=1;});
