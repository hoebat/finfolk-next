// TikTok Accounts/Mentions contracts; no domain SQL or public/private command policy.
import {createHash} from 'node:crypto';
import {readLimited} from './messaging-http.mjs';
import {createTikTokMessagingAuthorization} from './messaging-tiktok-authorization.mjs';
const host='https://business-api.tiktok.com/open_api/v1.3';
export const tiktokCommentScopes=Object.freeze(['comment.list','comment.list.manage','biz.brand.insights','user.account.type']);
export const tiktokID=value=>typeof value==='string'&&/^[0-9]{1,40}$/.test(value);
const identity=value=>typeof value==='string'&&value.length>0&&value.length<=500;
export const tiktokCommentHash=text=>createHash('sha256').update(text).digest('hex');

// comment.update serializes 64-bit IDs as JSON numbers. Preserve integer tokens
// before JSON.parse rounds them; strings (including escaped text) remain untouched.
export function parseTikTokJSON(source){
 if(typeof source!=='string')throw Error('Serialized TikTok JSON required');
 let output='',quoted=false,escaped=false;
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(quoted){output+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
  if(c==='"'){quoted=true;output+=c;continue;}
  if(c==='-'||/[0-9]/.test(c)){
   const token=source.slice(i).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/)?.[0];
   if(token){output+=/^-?[0-9]+$/.test(token)&&!Number.isSafeInteger(Number(token))?JSON.stringify(token):token;i+=token.length-1;continue;}
  }
  output+=c;
 }
 return JSON.parse(output);
}
export function tiktokCommentTime(value){
 let milliseconds;
 if(typeof value==='string'&&/^\d{1,13}$/.test(value)||typeof value==='number'&&Number.isSafeInteger(value)){
  const n=Number(value);milliseconds=n<1e12?n*1000:n;
 }else if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \+0000 UTC$/.test(value))
  milliseconds=Date.parse(value.slice(0,10)+'T'+value.slice(11,19)+'Z');
 if(!Number.isSafeInteger(milliseconds)||milliseconds<=0)throw Error('Invalid TikTok comment time');
 return milliseconds;
}
export function createTikTokCommentsProvider({accountId,loadAccessToken,fetcher=fetch,now=()=>Date.now()}){
 if(!identity(accountId)||typeof loadAccessToken!=='function')throw Error('Scoped TikTok comment credentials required');
 async function request(path,{token,params,body}={}){
  const url=new URL(host+path);for(const [key,value]of Object.entries(params||{}))url.searchParams.set(key,value);
  let response,data;
  try{
   response=await fetcher(url,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{...(token?{'Access-Token':token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
   data=parseTikTokJSON(new TextDecoder('utf-8',{fatal:true}).decode(await readLimited(response,524288)));
  }catch{throw Object.assign(Error('TikTok comment request was not confirmed'),{transient:true});}
  if(!response.ok||data.code!==0||!data.data||typeof data.data!=='object')throw Object.assign(Error('TikTok comment access unavailable'),{providerRejected:true,transient:response.status===429||response.status>=500});
  return data.data;
 }
 async function comment(target,{token}={}){
  if(!tiktokID(target.mediaId)||!tiktokID(target.commentId)||!identity(target.senderId))throw Error('Verified TikTok comment target required');
  token??=await loadAccessToken({generation:target.generation});
  let owned;
  if(target.origin!=='mention'){
   try{owned=await request('/business/comment/list/',{token,params:{business_id:accountId,video_id:target.mediaId,
     comment_ids:JSON.stringify([target.commentId]),status:'ALL',max_count:'1',include_replies:'false'}});}
   catch(error){if(error.transient||target.origin==='owned')throw error;}
  }
  if(owned){
   if(!Array.isArray(owned.comments))throw Error('TikTok owned-comment response invalid');
   const found=owned.comments.filter(row=>row.comment_id===target.commentId);
   if(found.length>1)throw Error('Ambiguous TikTok comment identity');
   if(found.length===1){
    const row=found[0];
    if(row.video_id!==target.mediaId||row.unique_identifier!==target.senderId||row.owner!==false||row.status!=='PUBLIC')return null;
    if(typeof row.text!=='string'||row.text.length>2000)throw Error('TikTok comment text invalid');
    return {text:row.text,sentAt:tiktokCommentTime(row.create_time),origin:'owned'};
   }
  }
  // A known owned comment disappearing must not fall back to a cached mention.
  if(target.origin==='owned')return null;
  const mention=await request('/business/mention/comment/get/',{token,params:{business_id:accountId,item_id:target.mediaId,comment_id:target.commentId,
    fields:JSON.stringify(['item_id','comment_id','comment_text','comment_create_time','commenter_handle_name','comment_type'])}});
  const row=mention.comment;
  if(!row)return null;
  if(row.item_id!==target.mediaId||row.comment_id!==target.commentId||!['COMMENT','REPLY'].includes(row.comment_type)||
    typeof row.commenter_handle_name!=='string'||row.commenter_handle_name.toLowerCase()==='finfolk.com.au')return null;
  if(typeof row.comment_text!=='string'||row.comment_text.length>2000)throw Error('TikTok mention text invalid');
  return {text:row.comment_text,sentAt:tiktokCommentTime(row.comment_create_time),origin:'mention'};
 }
 return {request,comment,
  async reply(message){
   const {destination:d}=message;
   if(!d||d.channel!=='mention'||!['owned','mention'].includes(d.commentOrigin)||!tiktokID(d.mediaId)||!tiktokID(d.commentId)||!identity(d.recipientId)||
    !/^[a-f0-9]{64}$/.test(d.bodyHash||'')||typeof message.body!=='string'||!message.body||Buffer.byteLength(message.body,'utf8')>1200||
    message.provider!=='tiktok'||message.accountId!==accountId)return {status:'failed'};
   let token,current;
   try{token=await loadAccessToken({generation:message.generation});current=await comment({mediaId:d.mediaId,commentId:d.commentId,senderId:d.recipientId,generation:message.generation,origin:d.commentOrigin},{token});}
   catch(error){return error.providerRejected&&!error.transient?{status:'failed'}:{status:'retry',retryAfter:60};}
   if(!current||tiktokCommentHash(current.text)!==d.bodyHash||!Number.isSafeInteger(message.deadline)||message.deadline<=now()*1000)return {status:'failed'};
   let response,data;
   try{
    response=await fetcher(host+'/business/comment/reply/create/',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
     headers:{'Access-Token':token,'Content-Type':'application/json'},body:JSON.stringify({business_id:accountId,video_id:d.mediaId,comment_id:d.commentId,text:message.body})});
   }catch{return {status:'uncertain'};}
   if(response.status===429)return {status:'retry',retryAfter:120};
   if(response.status>=500)return {status:'uncertain'};
   try{data=parseTikTokJSON(new TextDecoder('utf-8',{fatal:true}).decode(await readLimited(response,65536)));}catch{return {status:'uncertain'};}
   if(response.ok&&data.code===0&&tiktokID(data.data?.comment_id)&&data.data.parent_comment_id===d.commentId&&data.data.video_id===d.mediaId)
    return {status:'accepted',messageId:data.data.comment_id};
   if(Number.isInteger(data.code)&&data.code!==0||response.status===401||response.status===403)return {status:'failed'};
   return {status:'uncertain'};
  },
 };
}

export function createTikTokCommentsAuthorization(config){
 const grant=createTikTokMessagingAuthorization({...config,requiredScopes:tiktokCommentScopes});
 const provider=createTikTokCommentsProvider({...config,loadAccessToken:async()=>{throw Error('Explicit verification token required');}});
 return {...grant,async verify(credential,{subscribe=false}={}){
  if(credential.authMethod!=='tiktok-business'||!identity(credential.token)||!tiktokID(config.pilotVideoId))throw Error('TikTok comment grant and owned pilot post required');
  const request=provider.request,token=credential.token;
  const info=await request('/tt_user/token_info/get/',{body:{app_id:config.appId,access_token:token}});
  const scopes=new Set(typeof info.scope==='string'?info.scope.split(',').map(s=>s.trim()):[]);
  if(info.app_id!==config.appId||info.creator_id!==config.accountId||!tiktokCommentScopes.every(s=>scopes.has(s)))throw Error('TikTok Accounts/Mentions scopes or identity do not match');
  const profile=await request('/business/get/',{token,params:{business_id:config.accountId,fields:JSON.stringify(['has_advanced_access'])}});
  if(profile.has_advanced_access!==true)throw Error('TikTok Advanced Access required');
  const owned=await request('/business/comment/list/',{token,params:{business_id:config.accountId,video_id:config.pilotVideoId,status:'PUBLIC',max_count:'1'}});
  const mentions=await request('/business/mention/comment/list/',{token,params:{business_id:config.accountId,number_of_days:'1',max_count:'1',fields:JSON.stringify(['comment_id'])}});
  if(!Array.isArray(owned.comments)||!Array.isArray(mentions.comments))throw Error('TikTok comment access readback required');
  for(const event_type of ['COMMENT','BRAND_MENTION']){
   if(subscribe)await request('/business/webhook/update/',{body:{app_id:config.appId,secret:config.appSecret,event_type,callback_url:config.callbackURL}});
   const subscription=await request('/business/webhook/list/',{params:{app_id:config.appId,secret:config.appSecret,event_type}});
   if(subscription.app_id!==config.appId||subscription.event_type!==event_type||subscription.callback_url!==config.callbackURL||
     event_type==='COMMENT'&&subscription.item_list!=null&&(!Array.isArray(subscription.item_list)||subscription.item_list.length&&!subscription.item_list.includes(config.pilotVideoId)))throw Error('TikTok comment webhook readback mismatch');
  }
  return {provider:'tiktok',appId:config.appId,accountId:config.accountId,authorized:true,subscribed:true,nonExpiring:false};
 }};
}
