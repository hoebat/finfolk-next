import {randomBytes} from 'node:crypto';
import {seal,unseal,digest} from './messaging-config.mjs';
import {matchInstagramBeach} from './instagram-discovery.mjs';
import {taggedForFinFolk} from './media-imports.mjs';
const callback='https://finfolk.com.au/v1/integrations/tiktok/oauth/callback';
const cookie='__Host-finfolk-tiktok';
const aad=(uid,env)=>'tiktok:'+env.TIKTOK_CLIENT_KEY+':'+uid;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export const tiktokReady=env=>env.TIKTOK_IMPORT_ENABLED==='true'&&!!env.TIKTOK_CLIENT_KEY&&!!env.TIKTOK_CLIENT_SECRET&&Buffer.from(env.MESSAGING_ENCRYPTION_KEY||'','base64').length===32;
const cookieValue=value=>`${cookie}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${value?600:0}`;
async function provider(path,init,fetcher){
 const response=await fetcher('https://open.tiktokapis.com'+path,{...init,redirect:'error',signal:AbortSignal.timeout(12000)});
 let data;try{data=await response.json();}catch{fail('TikTok could not be reached. Try again later.',503);}
 if(!response.ok||data.error?.code&&data.error.code!=='ok'||typeof data.error==='string'){
  const error=Object.assign(Error('TikTok access needs attention. Reconnect your account or try again later.'),{status:503,providerCode:data.error?.code||data.error||'unavailable'});throw error;
 }
 return data;
}
async function tokens(values,env,fetcher){
 return provider('/v2/oauth/token/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_key:env.TIKTOK_CLIENT_KEY,client_secret:env.TIKTOK_CLIENT_SECRET,...values})},fetcher);
}
function checkedToken(token){
 if(!token.access_token||!token.refresh_token||!token.open_id||!String(token.scope).split(',').includes('video.list')||!String(token.scope).split(',').includes('user.info.basic')||!(token.expires_in>0)||!(token.refresh_expires_in>0))fail('Allow access to your basic profile and public videos to connect TikTok.');
 return token;
}
export const tiktokActions=new Set(['tiktokStatus','tiktokConnect','tiktokDisconnect','tiktokSync']);
export async function tiktokAction({action,uid,db,env,c,fetcher=fetch}){
 const q=db.query,ready=tiktokReady(env);
 if(action==='tiktokStatus'){
  const row=(await q('SELECT display_name,status,last_success,refresh_expires_at FROM finfolk.tiktok_connections WHERE user_id=$1 AND app_id=$2',[uid,env.TIKTOK_CLIENT_KEY||'']))[0];
  return {ready,connected:ready&&row?.status==='connected',status:row?.status||'disconnected',displayName:row?.display_name||'',lastSuccess:row?.last_success||null};
 }
 if(action==='tiktokDisconnect'){
  const previous=(await q('SELECT credential_ciphertext FROM finfolk.tiktok_connections WHERE user_id=$1 AND app_id=$2',[uid,env.TIKTOK_CLIENT_KEY||'']))[0];
  if(previous?.credential_ciphertext&&ready)try{const token=unseal(previous.credential_ciphertext,env,aad(uid,env));await provider('/v2/oauth/revoke/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_key:env.TIKTOK_CLIENT_KEY,client_secret:env.TIKTOK_CLIENT_SECRET,token:token.access_token})},fetcher);}catch{}
  await db.transaction(async tq=>{await tq('DELETE FROM finfolk.tiktok_connections WHERE user_id=$1',[uid]);await tq("DELETE FROM finfolk.media_imports WHERE owner_id=$1 AND platform='tiktok'",[uid]);});return {ok:true};
 }
 if(!ready)fail('TikTok imports are awaiting app approval and configuration.',503);
 if(action==='tiktokConnect'){
  const state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url');
  await q(`INSERT INTO finfolk.tiktok_connections(user_id,app_id,oauth_hash,oauth_nonce_hash,oauth_expires_at)
   VALUES($1,$2,$3,$4,now()+interval '10 minutes') ON CONFLICT(user_id) DO UPDATE SET app_id=excluded.app_id,status='pending',oauth_hash=excluded.oauth_hash,oauth_nonce_hash=excluded.oauth_nonce_hash,oauth_expires_at=excluded.oauth_expires_at,credential_ciphertext=NULL,updated_at=now()`,[uid,env.TIKTOK_CLIENT_KEY,digest(state),digest(nonce)]);
  c.header('Set-Cookie',cookieValue(nonce));
  const url=new URL('https://www.tiktok.com/v2/auth/authorize/');for(const [key,value] of Object.entries({client_key:env.TIKTOK_CLIENT_KEY,response_type:'code',scope:'user.info.basic,video.list',redirect_uri:callback,state}))url.searchParams.set(key,value);
  return {url:url.href};
 }
 if(action==='tiktokSync'){await syncTikTok(uid,env,db,fetcher);return {ok:true};}
}
export async function tiktokCallback(request,env,db,fetcher=fetch){
 const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','Set-Cookie':cookieValue(''),'Content-Security-Policy':"default-src 'none'"};
 try{
  const url=new URL(request.url),state=url.searchParams.get('state'),code=url.searchParams.get('code');
  const nonce=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookie+'='))?.slice(cookie.length+1);
  if(url.origin!==new URL(callback).origin||!state||state.length>200||!nonce||nonce.length>100||!code||code.length>2000||url.searchParams.has('error'))fail('TikTok connection was cancelled. Return to your logbook and try again.');
  const row=(await db.query(`UPDATE finfolk.tiktok_connections SET oauth_hash=NULL,oauth_nonce_hash=NULL,oauth_expires_at=NULL,updated_at=now()
   WHERE oauth_hash=$1 AND oauth_nonce_hash=$2 AND oauth_expires_at>now() AND app_id=$3
   AND EXISTS(SELECT 1 FROM finfolk.members m WHERE m.user_id=tiktok_connections.user_id AND NOT m.deleted) RETURNING user_id`,[digest(state),digest(nonce),env.TIKTOK_CLIENT_KEY]))[0];
  if(!row)fail('This TikTok connection expired. Return to your logbook and try again.');
  const token=checkedToken(await tokens({code,grant_type:'authorization_code',redirect_uri:callback},env,fetcher));
  const info=await provider('/v2/user/info/?fields=open_id,display_name',{headers:{Authorization:'Bearer '+token.access_token}},fetcher);
  if(info.data?.user?.open_id!==token.open_id)fail('TikTok could not verify the account owner.');
  const saved=await db.query(`UPDATE finfolk.tiktok_connections SET open_id=$2,display_name=$3,status='connected',credential_ciphertext=$4,access_expires_at=now()+($5::int*interval '1 second'),refresh_expires_at=now()+($6::int*interval '1 second'),cursor=NULL,next_at=now(),failures=0,updated_at=now() WHERE user_id=$1 AND app_id=$7 AND status='pending' AND oauth_hash IS NULL RETURNING user_id`,[row.user_id,token.open_id,String(info.data.user.display_name||'').slice(0,100),seal(token,env,aad(row.user_id,env)),token.expires_in,token.refresh_expires_in,env.TIKTOK_CLIENT_KEY]);
  if(!saved.length)fail('Your connection changed. Return to the logbook and reconnect.');
  return new Response(null,{status:303,headers:{...headers,Location:'https://finfolk.com.au/?view=logbook&tiktok=connected'}});
 }catch{
  return new Response('TikTok could not be connected. Return to your FinFolk logbook and try again. If the account is already connected elsewhere, disconnect it there first.',{status:400,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
 }
}
export function normalizeTikTok(video){
 if(!/^\d{1,40}$/.test(String(video?.id||''))||!taggedForFinFolk(video.video_description||video.title))return null;
 let url;try{url=new URL(video.share_url);if(url.protocol!=='https:'||url.username||url.password||url.port||!['www.tiktok.com','tiktok.com'].includes(url.hostname)||!new RegExp('^/@[A-Za-z0-9._]+/video/'+video.id+'/?$').test(url.pathname))return null;}catch{return null;}
 const at=Number(video.create_time)*1000;
 if(!Number.isFinite(at)||at<=0||at>Date.now()+86400000)return null;
 return {id:String(video.id),url:'https://www.tiktok.com'+url.pathname.replace(/\/$/,''),postedAt:new Date(at).toISOString(),candidates:matchInstagramBeach(video.video_description||video.title||'')};
}
export async function syncTikTok(uid,env,db,fetcher=fetch){
 if(!tiktokReady(env))return;
 const q=db.query,row=(await q(`UPDATE finfolk.tiktok_connections SET lease_until=now()+interval '3 minutes',next_at=now()+interval '15 minutes' WHERE user_id=$1 AND app_id=$2 AND status='connected' AND next_at<=now() AND (lease_until IS NULL OR lease_until<now()) RETURNING *`,[uid,env.TIKTOK_CLIENT_KEY]))[0];
 if(!row)return;
 let credential=row.credential_ciphertext;
 try{
  if(!row.refresh_expires_at||new Date(row.refresh_expires_at)<=new Date())throw Object.assign(Error(),{providerCode:'access_token_invalid'});
  let token=unseal(credential,env,aad(uid,env));
  if(!row.access_expires_at||new Date(row.access_expires_at).getTime()<Date.now()+300000){
   token=checkedToken(await tokens({grant_type:'refresh_token',refresh_token:token.refresh_token},env,fetcher));
   if(token.open_id!==row.open_id)throw Error('Account changed');
   const encrypted=seal(token,env,aad(uid,env));
   const saved=await q(`UPDATE finfolk.tiktok_connections SET credential_ciphertext=$3,access_expires_at=now()+($4::int*interval '1 second'),refresh_expires_at=now()+($5::int*interval '1 second') WHERE user_id=$1 AND credential_ciphertext=$2 AND status='connected' RETURNING user_id`,[uid,credential,encrypted,token.expires_in,token.refresh_expires_in]);
   if(!saved.length)return;credential=encrypted;
  }
  let cursor=null,nextCursor=null;
  for(let page=0;page<3;page++){
   const data=await provider('/v2/video/list/?fields=id,create_time,share_url,video_description,title',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({max_count:20,...(cursor?{cursor:Number(cursor)}:{})})},fetcher);
   if(!Array.isArray(data.data?.videos))throw Error('Invalid video list');
   for(const video of data.data.videos){
    const item=normalizeTikTok(video);if(!item)continue;
    const beach=item.candidates.length===1?(await q('SELECT id,name,timezone FROM finfolk.beaches WHERE id=$1',[item.candidates[0].id]))[0]:null;
    await q(`INSERT INTO finfolk.media_imports(owner_id,platform,provider_id,url,kind,posted_at,day,beach_id,location_name,candidates)
     SELECT $1,'tiktok',$2,$3,'video',$4::timestamptz,($4::timestamptz AT TIME ZONE $5)::date,$6,$7,$8::jsonb
     WHERE EXISTS(SELECT 1 FROM finfolk.tiktok_connections c JOIN finfolk.members m ON m.user_id=c.user_id WHERE c.user_id=$1 AND c.credential_ciphertext=$9 AND c.status='connected' AND NOT m.deleted)
     ON CONFLICT(owner_id,platform,provider_id) DO NOTHING`,[uid,item.id,item.url,item.postedAt,beach?.timezone||'UTC',beach?.id||null,beach?.name||'',JSON.stringify(item.candidates),credential]);
   }
   nextCursor=data.data.has_more?String(data.data.cursor):null;
   if(nextCursor&&!/^\d{1,17}$/.test(nextCursor))throw Error('Invalid cursor');
   // Re-scan the newest page on every sync; continue older history separately.
   cursor=page===0?(row.cursor||nextCursor):nextCursor;
   if(!cursor)break;
  }
  // Explicitly query older imported videos too: absence from the newest list
  // alone never means a video was removed. Rotate checks across saved links.
  const existing=await q("SELECT provider_id FROM finfolk.media_imports WHERE owner_id=$1 AND platform='tiktok' ORDER BY updated_at,id LIMIT 20",[uid]);
  if(existing.length){
   const ids=existing.map(r=>r.provider_id),data=await provider('/v2/video/query/?fields=id',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({filters:{video_ids:ids}})},fetcher);
   if(!Array.isArray(data.data?.videos))throw Error('Invalid video query');
   const returned=data.data.videos.map(v=>String(v.id));
   await q("DELETE FROM finfolk.media_imports WHERE owner_id=$1 AND platform='tiktok' AND provider_id=ANY($2::text[]) AND NOT(provider_id=ANY($3::text[]))",[uid,ids,returned]);
   await q("UPDATE finfolk.media_imports SET updated_at=now() WHERE owner_id=$1 AND platform='tiktok' AND provider_id=ANY($2::text[])",[uid,returned]);
  }
  await q(`UPDATE finfolk.tiktok_connections SET cursor=$3,last_success=now(),lease_until=NULL,failures=0 WHERE user_id=$1 AND credential_ciphertext=$2`,[uid,credential,nextCursor]);
 }catch(error){
  const reconnect=['access_token_invalid','refresh_token_invalid','invalid_grant'].includes(error.providerCode);
  await q(`UPDATE finfolk.tiktok_connections SET lease_until=NULL,failures=failures+1,next_at=now()+interval '30 minutes',status=CASE WHEN $3 THEN 'reconnect' ELSE status END WHERE user_id=$1 AND credential_ciphertext=$2`,[uid,credential,reconnect]);
  if(reconnect)await q("DELETE FROM finfolk.media_imports WHERE owner_id=$1 AND platform='tiktok'",[uid]);
  // Do not expose provider responses, authorization codes or tokens.
  fail(reconnect?'Reconnect TikTok to resume imports.':'TikTok is temporarily unavailable. Your saved logbook is unchanged.',503);
 }
}
export async function scheduleTikTok(env,db,fetcher=fetch){
 if(!tiktokReady(env))return;
 const rows=await db.query("SELECT user_id FROM finfolk.tiktok_connections WHERE app_id=$1 AND status='connected' AND next_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_at LIMIT 10",[env.TIKTOK_CLIENT_KEY]);
 for(const row of rows)try{await syncTikTok(row.user_id,env,db,fetcher);}catch{}
}
