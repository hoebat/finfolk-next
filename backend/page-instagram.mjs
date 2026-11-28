// Page collection uses its own User grant. It never reads/replaces the Page
// credential used by FinFolk messaging and never accepts caller-selected hosts.
import {seal,unseal} from './messaging-config.mjs';
const required=['instagram_basic','instagram_manage_insights','pages_read_engagement'];
const fail=(code,auth=false,rate=false)=>Object.assign(Error('Instagram page collection unavailable'),{code,auth,rate});
async function graph(path,token,params,config,fetcher){
 const url=new URL('https://graph.facebook.com/'+config.graphVersion+'/'+path);
 for(const [k,v]of Object.entries(params||{}))url.searchParams.set(k,String(v));
 try{const r=await fetcher(url,{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(20000)});const reader=r.body.getReader(),chunks=[];let bytes=0;
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2*1024*1024){await reader.cancel();throw fail('response_too_large')}chunks.push(value)}
  const body=JSON.parse(Buffer.concat(chunks).toString());if(!r.ok||body.error){const c=Number(body.error?.code)||0;throw fail('meta_'+c,c===190,[4,17,32,613].includes(c)||r.status===429)}return body;
 }catch(e){throw /^meta_|response_too_large/.test(e.code||'')?e:fail('meta_unavailable')}
}
export function pageInstagramFields(handle,cursor){
 if(!/^[a-z0-9._]{1,30}$/.test(handle)||cursor&&!/^[A-Za-z0-9_+=/-]{1,2000}$/.test(cursor))throw fail('invalid_account');
 return `id,username,business_discovery.username(${handle}){id,username,media.limit(25)${cursor?`.after(${cursor})`:''}{id,caption,permalink,timestamp,media_type}}`;
}
export function pageInstagramPost(p){
 if(!/^\d+$/.test(p?.id||'')||!/^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?$/.test(p.permalink||'')||!Number.isFinite(Date.parse(p.timestamp))||!['IMAGE','VIDEO','CAROUSEL_ALBUM'].includes(p.media_type)||typeof p.caption==='string'&&p.caption.length>20000)throw fail('invalid_post');
 return {id:p.id,caption:p.caption||'',permalink:p.permalink,timestamp:new Date(p.timestamp).toISOString(),media_type:p.media_type};
}
const binding=c=>JSON.stringify(['finfolk-page-instagram',1,c.appId,c.accountId]);
export function createPageInstagram({db,config,env,fetcher=fetch,now=()=>Date.now()}){
 if(config.appId!=='1667613151655339'||config.accountId!=='17841461601419539')throw fail('wrong_finfolk_app');
 const q=(sql,args=[])=>db.query(sql,args),row=async()=> (await q('SELECT * FROM finfolk."PageInstagramConnection" WHERE key=\'instagram\''))[0];
 const meta=(c)=>({generation:c?.generation||0,status:c?.status||'not_connected',enabled:c?.enabled===true,expiresAt:c?.expires_at?new Date(Number(c.expires_at)/1000).toISOString():null,checkedAt:c?.checked_at?new Date(Number(c.checked_at)/1000).toISOString():null,lastError:c?.last_error||'',caller:'finfolk.com.au'});
 const identify=async token=>{const value=await graph(config.accountId,token,{fields:'id,username'},config,fetcher);if(value.id!==config.accountId||value.username!=='finfolk.com.au')throw fail('wrong_finfolk_account',true);};
 async function inspect(token){
  const body=await graph('debug_token',config.appId+'|'+env.INSTAGRAM_MESSAGING_META_APP_SECRET,{input_token:token},config,fetcher),d=body.data;
  if(!d?.is_valid||d.type!=='USER'||d.app_id!==config.appId||!Number.isFinite(d.expires_at)||d.expires_at*1000<=now()+300000||required.some(s=>!d.scopes?.includes(s)))throw fail('user_grant_required',true);
  if(d.data_access_expires_at&&d.data_access_expires_at*1000<=now()+300000)throw fail('user_grant_expired',true);
  await identify(token);return Math.min(d.expires_at*1000,d.data_access_expires_at?d.data_access_expires_at*1000:Infinity);
 }
 return {
  async status(){return meta(await row())},
  async configure({token,expected}){
   const old=await row();if((old?.generation||0)!==expected)throw fail('connection_changed');
   if(typeof token!=='string'||token.length<50||token.length>4096)throw fail('invalid_token');
   let expiry=await inspect(token);
   if(expiry-now()<2*86400000){const value=await graph('oauth/access_token',token,{grant_type:'fb_exchange_token',client_id:config.appId,client_secret:env.INSTAGRAM_MESSAGING_META_APP_SECRET,fb_exchange_token:token},config,fetcher);if(typeof value.access_token!=='string')throw fail('exchange_failed');token=value.access_token;expiry=await inspect(token);}
   if(expiry-now()<86400000)throw fail('long_lived_token_required');
   const ciphertext=seal({v:1,token,expiresAt:expiry},env,binding(config));token='';
   const saved=await q(`INSERT INTO finfolk."PageInstagramConnection"(key,app_id,caller_id,credential_ciphertext,expires_at,enabled,status,checked_at) SELECT 'instagram',$1,$2,$3,$4,true,'active',$5 WHERE $6=0
    ON CONFLICT(key) DO NOTHING RETURNING *`,[config.appId,config.accountId,ciphertext,expiry*1000,now()*1000,expected]);
   if(!saved.length){const updated=await q(`UPDATE finfolk."PageInstagramConnection" SET credential_ciphertext=$1,expires_at=$2,enabled=true,status='active',checked_at=$3,last_error='',generation=generation+1 WHERE key='instagram' AND generation=$4 RETURNING *`,[ciphertext,expiry*1000,now()*1000,expected]);if(!updated.length)throw fail('connection_changed');return meta(updated[0])}
   return meta(saved[0]);
  },
  async pause(expected){const saved=await q(`UPDATE finfolk."PageInstagramConnection" SET enabled=false,status='paused',generation=generation+1 WHERE key='instagram' AND generation=$1 RETURNING *`,[expected]);if(!saved.length)throw fail('connection_changed');return meta(saved[0]);},
  async collect(){
   const c=await row();if(c?.enabled&&Number(c.expires_at)<=now()*1000)await q(`UPDATE finfolk."PageInstagramConnection" SET enabled=false,status='reconnect',last_error='Authorization expired. Reconnect page collection.' WHERE key='instagram' AND generation=$1`,[c.generation]);if(!c?.enabled||c.status!=='active'||Number(c.expires_at)<=now()*1000){await q(`UPDATE finfolk."PageInstagramSource" SET status='connection_required',last_error='Ask a site administrator to connect page collection.' WHERE enabled AND (lease_until IS NULL OR lease_until<$1)`,[now()*1000]);return {collected:0};}
   let token;try{const opened=unseal(c.credential_ciphertext,env,binding(config));if(opened.v!==1||opened.expiresAt*1000!==Number(c.expires_at)||c.app_id!==config.appId||c.caller_id!==config.accountId)throw Error();token=opened.token;}catch{throw fail('credential_unavailable')}
   const sources=(await q('SELECT finfolk_rpc.claim_page_instagram_sources() AS value'))[0].value;let collected=0;
   for(const s of sources){
    try{
     if(!(await q(`SELECT 1 FROM finfolk."PageInstagramConnection" WHERE key='instagram' AND generation=$1 AND enabled AND status='active'`,[c.generation])).length)break;
     const raw=await graph(config.accountId,token,{fields:pageInstagramFields(s.handle,s.cursor)},config,fetcher);
     if(raw.id!==config.accountId||raw.username!=='finfolk.com.au')throw fail('caller_changed',true);
     const account=raw.business_discovery;if(!/^\d+$/.test(account?.id||'')||account.username?.toLowerCase()!==s.handle||!Array.isArray(account.media?.data))throw fail('account_unavailable');
     if(s.instagram_id&&s.instagram_id!==account.id)throw fail('account_identity_changed');
     let seen=Number(s.seen)||0,tooOld=false;
     for(const item of account.media.data){if(++seen>100)break;const p=pageInstagramPost(item);if(Date.parse(p.timestamp)<now()-30*86400000){tooOld=true;continue;}
      const saved=(await q('SELECT finfolk_rpc.ingest_page_instagram_post($1,$2,$3,$4,$5::jsonb) AS value',[s.id,s.lease,c.generation,account.id,JSON.stringify(p)]))[0].value;if(!saved)throw fail('collection_changed');collected++;
     }
     const next=account.media.paging?.cursors?.after,more=!tooOld&&seen<100&&account.media.data.length>0&&typeof next==='string'&&/^[A-Za-z0-9_+=/-]{1,2000}$/.test(next);
     await q(`UPDATE finfolk."PageInstagramSource" SET instagram_id=$3,status=$4,last_success=$5,last_error='',next_at=$6,cursor=$7,seen=$8,lease=NULL,lease_until=NULL WHERE id=$1 AND lease=$2`,[s.id,s.lease,account.id,more?'backfilling':'active',now()*1000,(now()+(more?60000:3600000))*1000,more?next:null,more?seen:0]);
    }catch(e){
     const status=e.auth?'connection_required':e.rate?'rate_limited':e.code==='account_identity_changed'?'identity_changed':'unavailable';
     await q(`UPDATE finfolk."PageInstagramSource" SET status=$3,last_error=$4,next_at=$5,lease=NULL,lease_until=NULL WHERE id=$1 AND lease=$2`,[s.id,s.lease,status,e.auth?'Reconnect page collection.':e.rate?'Meta rate limit; retry scheduled.':e.code==='account_identity_changed'?'The Instagram identity changed. Ask an administrator to review the page link.':'Instagram could not return this account. It may be private or not a Business/Creator account.',(now()+(e.rate?3600000:900000))*1000]);
     if(e.auth){await q(`UPDATE finfolk."PageInstagramConnection" SET status='reconnect',enabled=false,last_error='Credential invalid or expired. Reconnect page collection.' WHERE key='instagram' AND generation=$1`,[c.generation]);break}
     if(e.rate)break;
    }
   }
   token='';return {collected};
  }
 };
}
