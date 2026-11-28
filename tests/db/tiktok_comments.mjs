// Disposable real PostgreSQL + native Worker. Provider responses are synthetic.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHmac} from 'node:crypto';
import pg from 'pg';
import {connect} from './harness.mjs';
import {createNativeRPC} from '../../backend/native-rpc.mjs';
import {createNativeTikTokCommentsWorker} from '../../backend/social-tiktok-comments-worker.mjs';
import {tiktokCommentScopes} from '../../backend/tiktok-comments-provider.mjs';
const db=await connect(),actor=randomUUID(),application=randomUUID(),inbox=randomUUID(),role='tt_comments_'+randomUUID().replaceAll('-','');
const appId='7703991919769632789',accountId='synthetic-brand',ownVideo='7203946942097902849',externalVideo='7203946942097902850';
const origin='https://finfolk.com.au',api='https://api.finfolk.com.au',prefix='/v1/messaging/connections/finfolk-tiktok-comments/';
const config={application,inbox,provider:'tiktok',capability:'comments',appId,accountId,pilotVideoId:ownVideo,administrators:[actor],accountAuthorizationURL:'https://www.tiktok.com/v2/auth/authorize/?client_key='+appId};
const env={NATIVE_SOCIAL_ENABLED:'true',NATIVE_SOCIAL_CONFIG:JSON.stringify(config),SUPABASE_URL:'https://supabase.finfolk.com.au',SUPABASE_PUBLISHABLE_KEY:'fixture-public',
 SOCIAL_DB:{connectionString:process.env.FINFOLK_TEST_DATABASE_URL},TIKTOK_COMMENTS_APP_SECRET:'fixture-secret',NATIVE_SOCIAL_REPLY_KEY:'4'.repeat(64),
 MESSAGING_ENCRYPTION_KEY:Buffer.alloc(32,39).toString('base64'),NATIVE_SOCIAL_QUEUE:{send:async()=>{}}};
const rpc=createNativeRPC((...args)=>db.query(...args)),comments=new Map(),posts=[],requests=[],previousFetch=globalThis.fetch;
let counter=7247303576418566913n,sendMode='accepted';
const provider=async(raw,options={})=>{
 const url=new URL(raw),path=url.pathname;requests.push(path);
 if(url.origin==='https://supabase.finfolk.com.au')return Response.json({id:actor,email_confirmed_at:'2026-11-26'});
 assert.equal(url.origin,'https://business-api.tiktok.com');
 if(path.endsWith('/oauth2/token/')||path.endsWith('/oauth2/refresh_token/'))return Response.json({code:0,data:{open_id:accountId,scope:tiktokCommentScopes.join(','),access_token:'fixture-token',refresh_token:'fixture-refresh',expires_in:86400,refresh_token_expires_in:31536000}});
 if(path.endsWith('/token_info/get/'))return Response.json({code:0,data:{app_id:appId,creator_id:accountId,scope:tiktokCommentScopes.join(',')}});
 if(path.endsWith('/business/get/'))return Response.json({code:0,data:{has_advanced_access:true}});
 if(path.endsWith('/webhook/update/')||path.endsWith('/webhook/list/'))return Response.json({code:0,data:{app_id:appId,event_type:url.searchParams.get('event_type')||JSON.parse(options.body).event_type,callback_url:api+'/tiktok/comments/webhook'}});
 if(path.endsWith('/mention/comment/list/'))return Response.json({code:0,data:{comments:[]}});
 if(path.endsWith('/comment/list/')){
  const ids=JSON.parse(url.searchParams.get('comment_ids')||'[]'),value=comments.get(ids[0]);
  return Response.json({code:0,data:{comments:value&&value.video_id===ownVideo&&!value.deleted?[{...value}]:[]}});
 }
 if(path.endsWith('/mention/comment/get/')){
  const value=comments.get(url.searchParams.get('comment_id'));
  return Response.json({code:0,data:{comment:value&&!value.deleted&&value.status==='PUBLIC'?{item_id:value.video_id,comment_id:value.comment_id,comment_type:'COMMENT',commenter_handle_name:'fixture.diver',comment_text:value.text,comment_create_time:value.create_time}:null}});
 }
 if(path.endsWith('/reply/create/')){
  const value=JSON.parse(options.body);posts.push(value);assert.equal(typeof value.comment_id,'string');assert.equal(typeof value.video_id,'string');
  if(sendMode==='uncertain')throw Error('Lost synthetic acknowledgement');
  return Response.json({code:0,data:{comment_id:String(counter++),parent_comment_id:value.comment_id,video_id:value.video_id}});
 }
 throw Error('Unexpected provider request '+path);
};
const worker=createNativeTikTokCommentsWorker({fetcher:provider,openDatabase(connectionString){
 const pool=new pg.Pool({connectionString,options:'-c role='+role,max:1});return {pool,query:async(sql,args)=>(await pool.query(sql,args)).rows};
}});
const request=(path,body,headers={})=>new Request(api+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Authorization:'Bearer fixture-operator',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
async function receive(text,{mediaId=ownVideo,sender='tester',id=String(counter++),event='comment.update',drain=true}={}){
 if(!comments.has(id))comments.set(id,{comment_id:id,video_id:mediaId,unique_identifier:sender,owner:false,status:'PUBLIC',text,create_time:String(Math.floor(Date.now()/1000))});
 const inner=JSON.stringify({comment_id:id,video_id:mediaId,comment_action:'insert',unique_identifier:sender,text:'Untrusted webhook text is not used',
  type_of_event:'CREATE',mention_type:'COMMENT',open_id_of_mentioned_user:accountId}).replace('"comment_id":"'+id+'"','"comment_id":'+id).replace('"video_id":"'+mediaId+'"','"video_id":'+mediaId);
 const raw=JSON.stringify({client_key:appId,user_openid:accountId,event,content:inner}),t=String(Math.floor(Date.now()/1000)),signature='t='+t+',s='+createHmac('sha256',env.TIKTOK_COMMENTS_APP_SECRET).update(t+'.'+raw).digest('hex');
 assert.equal((await worker.fetch(new Request(api+'/tiktok/comments/webhook',{method:'POST',body:raw,headers:{'tiktok-signature':signature}}),env)).status,200);
 if(drain)await worker.scheduled(null,env);
 return id;
}
async function receipt(commentId){return (await db.query('SELECT id FROM finfolk."SocialEvent" WHERE key=$1 AND inbox_id=$2',['comment:'+commentId,inbox])).rows[0]?.id;}
try{
 await db.query(await readFile('resources/finfolkdb/entity-schema.sql','utf8'));
 for(const file of ['account-grants.sql','messaging-grants.sql','social-grants.sql'])await db.query(await readFile('resources/finfolkdb/'+file,'utf8'));
 await rpc('sync_account_identity',[actor,true]);const op=await rpc('new_social_operation',[actor]);
 await rpc('bootstrap_tiktok_comments',[application,inbox,actor,accountId,op]);await rpc('bootstrap_tiktok_comments',[application,inbox,actor,accountId,op]);
 await db.query('CREATE ROLE '+role+' NOLOGIN INHERIT; GRANT finfolk_social,finfolk_messaging TO '+role+'; GRANT '+role+' TO CURRENT_USER WITH SET TRUE');
 globalThis.fetch=provider;
 for(const path of ['/tiktok/webhook','/v1/me/tiktok/connect'])assert.equal((await worker.fetch(request(path,{}),env)).status,404);
 assert.equal((await worker.fetch(new Request(api+'/tiktok/comments/webhook',{method:'POST',body:'{}'}),env)).status,403);
 const begin=await worker.fetch(request(prefix+'authorization',{}),env);assert.equal(begin.status,200);
 const state=new URL((await begin.json()).authorizationURL).searchParams.get('state');
 const callback=request('/v1/integrations/tiktok/comments/oauth/callback?state='+state+'&auth_code=fixture',undefined,{Cookie:begin.headers.get('Set-Cookie').split(';')[0]});
 assert.equal((await worker.fetch(callback,env)).status,303);assert.equal((await worker.fetch(callback,env)).status,400);
 let status=await (await worker.fetch(request(prefix+'status'),env)).json();assert.equal(status.connection.mode,'disabled');
 assert.equal((await worker.fetch(request(prefix+'activation',{generation:status.connection.generation,mode:'live',senders:[]}),env)).status,409);
 assert.equal((await worker.fetch(request(prefix+'activation',{generation:status.connection.generation,mode:'pilot',senders:['tester','nonfollower']}),env)).status,200);
 const own=await receive('/help @finfolk.com.au');assert.match(posts.at(-1).text,/\/help/);assert(!posts.at(-1).text.includes('/connect'));
 const count=posts.length;await receive('/help @finfolk.com.au',{id:own,event:'brand.mention.event'});assert.equal(posts.length,count,'Overlapping owned/mention webhooks deduplicate');
 const ext=await receive('/help @finfolk.com.au',{mediaId:externalVideo,event:'brand.mention.event'});assert.equal(posts.at(-1).video_id,externalVideo);
 const nf=await receive('/help @finfolk.com.au',{sender:'nonfollower'});assert.match(posts.at(-1).text,/Available commands/);
 const guidance=await receive('/connect PRIVATE123 @finfolk.com.au');assert.match(posts.at(-1).text,/send a DM/);assert(!posts.at(-1).text.includes('PRIVATE123'));
 assert.equal((await db.query('SELECT count(*)::int n FROM finfolk."SocialConnectionProof"')).rows[0].n,0,'Public comments never issue linking proofs');
 await receive('/status @finfolk.com.au');assert.match(posts.at(-1).text,/not been published/);
 const site=randomUUID();await db.query('INSERT INTO finfolk."Site"(id,key,name,timezone) VALUES($1,$2,$3,$4)',[site,site,'Synthetic comment beach','Australia/Sydney']);
 const publicPost=await rpc('insert_social_post',[actor,site,'https://www.tiktok.com/@/video/'+ownVideo,'tiktok','finfolk.com.au',true,await rpc('new_social_operation',[actor])]);
 await db.query('UPDATE finfolk."SocialPost" SET status=\'approved\' WHERE id=$1',[publicPost.id]);
 await receive('/status @finfolk.com.au');assert(posts.at(-1).text.includes('Published on FinFolk:')&&posts.at(-1).text.includes(site));
 await db.query('SET ROLE '+role);await assert.rejects(()=>db.query('UPDATE finfolk.\"SocialPost\" SET public_consent=false WHERE id=$1',[publicPost.id]),error=>error.code==='42501');await db.query('RESET ROLE');
 const withdrawing=await receive('/status @finfolk.com.au',{drain:false});await rpc('process_social_event',[application,inbox,await rpc('new_social_operation',[null])]);
 await db.query('UPDATE finfolk."SocialPost" SET public_consent=false WHERE id=$1',[publicPost.id]);
 const beforeWithdrawn=posts.length;await worker.scheduled(null,env);assert.equal(posts.length,beforeWithdrawn,'Withdrawn public-post consent cannot leak a queued status reply');

 let prior=posts.length;await receive('Ordinary conversation @finfolk.com.au');await receive('/help');assert.equal(posts.length,prior);
 const changed=await receive('/help @finfolk.com.au',{drain:false});comments.get(changed).text='/status @finfolk.com.au';await worker.scheduled(null,env);assert.equal(posts.length,prior,'An edited comment cannot receive a stale reply');
 const hidden=await receive('/help @finfolk.com.au',{drain:false});comments.get(hidden).status='HIDDEN';await worker.scheduled(null,env);assert.equal(posts.length,prior);
 const deleted=await receive('/help @finfolk.com.au',{drain:false});comments.get(deleted).deleted=true;const readsBefore=requests.length;await worker.scheduled(null,env);assert.equal(posts.length,prior);assert(!requests.slice(readsBefore).some(path=>path.endsWith('/mention/comment/get/')),'Deleted owned comments never fall back to stale mentions');
 sendMode='uncertain';await receive('/help @finfolk.com.au');assert.equal(posts.length,prior+1);await worker.scheduled(null,env);assert.equal(posts.length,prior+1,'Uncertain sends are never automatically retried');sendMode='accepted';
 status=await (await worker.fetch(request(prefix+'status'),env)).json();
 const body={generation:status.connection.generation,ownedHelp:await receipt(own),mentionHelp:await receipt(ext),nonFollowerHelp:await receipt(nf),privateGuidance:await receipt(guidance),
  confirmations:{visibleReplies:true,ownedAndMention:true,nonFollowerHelp:true,noPrivateData:true}};
 assert.equal((await worker.fetch(request(prefix+'acceptance',{...body,confirmations:{}}),env)).status,409);
 assert.equal((await worker.fetch(request(prefix+'acceptance',body),env)).status,200,'Only disposable synthetic acceptance is recorded here');
 assert.equal((await worker.fetch(request(prefix+'activation',{generation:status.connection.generation,mode:'live',senders:[]}),env)).status,200);
 const old=await receive('/help @finfolk.com.au',{drain:false});
 status=await (await worker.fetch(request(prefix+'status'),env)).json();assert.equal((await worker.fetch(request(prefix+'pause',{generation:status.connection.generation}),env)).status,200);
 prior=posts.length;await worker.scheduled(null,env);assert.equal(posts.length,prior);
 status=await (await worker.fetch(request(prefix+'status'),env)).json();assert.equal((await worker.fetch(request(prefix+'activation',{generation:status.connection.generation,mode:'pilot',senders:['tester']}),env)).status,200);
 await worker.scheduled(null,env);assert.equal(posts.length,prior,'Older rollout work is not replayed');
 assert(!requests.some(path=>path.includes('/message/')),'Comment authorization and replies never use Business Messaging endpoints');
 console.log('TIKTOK_COMMENTS_POSTGRES_PASS: restricted native SQL + Worker OAuth; Accounts/Mentions scopes; exact large IDs; signed owned/external lookup; duplicate suppression; public commands and DM guidance; non-follower help; zero linking proofs; edit/hide/delete preflight; uncertain-send fencing; separate acceptance, pause and generation controls. Synthetic provider only.');
}finally{
 globalThis.fetch=previousFetch;await db.end();const cleanup=new pg.Client({connectionString:process.env.FINFOLK_TEST_DATABASE_URL});await cleanup.connect();
 try{if((await cleanup.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount){await cleanup.query('DROP OWNED BY '+role);await cleanup.query('DROP ROLE '+role);}}finally{await cleanup.end();}
}
