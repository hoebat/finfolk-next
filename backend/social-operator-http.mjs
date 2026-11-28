import {createNativeRPC} from './native-rpc.mjs';
import {readLimited} from './messaging-http.mjs';
import {MessagingAuthorizationChanged} from './messaging-authorization-store.mjs';
import {MessagingOAuthError} from './messaging-oauth.mjs';

export function createSocialOperatorHTTP({db,config,authorization,oauth,authenticate,allowedOrigins,administrators,pageInstagram}) {
  const call=createNativeRPC((...args)=>db.query(...args)),origins=new Set(allowedOrigins),admins=new Set(administrators);
  const provider=config.provider??'instagram';
  if(!['instagram','tiktok'].includes(provider))throw Error('Unsupported operator provider');
  const comments=provider==='tiktok'&&config.capability==='comments';
  const prefix='/v1/messaging/connections/finfolk-'+provider+(comments?'-comments':'')+'/';
  const callbackPath='/v1/integrations/'+provider+(comments?'/comments':'')+'/oauth/callback';
  const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store',...headers}});
  const allowed=async id=>admins.has(id)&&await call('is_messaging_member',[id])===true;
  async function input(request,keys){
    let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readLimited(request,16384)));}
    catch(error){throw Object.assign(Error('Invalid request'),{status:error.status===413?413:400});}
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))
      throw Object.assign(Error('Invalid request'),{status:400});
    return value;
  }
  return async request=>{
    try {
      const path=new URL(request.url).pathname;
      const callback=path===callbackPath||path===prefix+'oauth/callback';
      if(callback){
        if(request.method!=='GET')return json({error:'Method not allowed'},405);
        const url=new URL(request.url);url.pathname=callbackPath;
        const completed=await oauth.complete(new Request(url,request),id=>allowed(id));
        return new Response(null,{status:303,headers:{Location:completed.returnURL,'Set-Cookie':completed.cookie,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
      }
      const event=path.startsWith(prefix)?path.slice(prefix.length).match(/^events\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i):null;
      const action=event?'event':path.startsWith(prefix)?path.slice(prefix.length):null;
      if(!['status','event','page-collection','page-collection-save','page-collection-pause','authorization','activation','pause','disconnect','acceptance'].includes(action))return json({error:'Not found'},404);
      if(request.method!==(['status','event','page-collection'].includes(action)?'GET':'POST'))return json({error:'Method not allowed'},405);
      const identity=await authenticate(request);
      if(!identity?.id||identity.verified!==true||!await allowed(identity.id))return json({error:'Operator access required'},403);
      if(action==='page-collection')return pageInstagram?json(await pageInstagram.status()):json({error:'Page collection is not configured'},503);
      if(action==='event'){const detail=await call('ret_social_operator_event',[config.application,config.inbox,event[1]]);return detail?json(detail):json({error:'Not found'},404);}
      if(action==='status')return json({connection:await authorization.connection(),health:await call('ret_social_operator_health',[config.application,config.inbox])});
      if(!origins.has(request.headers.get('Origin')))return json({error:'Origin not allowed'},403);
      if(action==='page-collection-save'||action==='page-collection-pause'){
        if(!pageInstagram)return json({error:'Page collection is not configured'},503);
        const value=await input(request,action==='page-collection-save'?['token','expected']:['expected']);
        if(!Number.isInteger(value.expected)||value.expected<0)return json({error:'Current generation required'},400);
        const result=action==='page-collection-save'?await pageInstagram.configure(value):await pageInstagram.pause(value.expected);return json(result);
      }
      if(action==='authorization'){
        await input(request,[]);const intent=await oauth.begin(identity.id);
        return json({authorizationURL:intent.authorizationURL,expiresAt:intent.expiresAt},200,{'Set-Cookie':intent.cookie});
      }
      const keys=action==='activation'?['generation','mode','senders']:action==='acceptance'?
        comments?['generation','ownedHelp','mentionHelp','nonFollowerHelp','privateGuidance','confirmations']:
        ['generation','ping','help','nonFollowerHelp','linked','denied','confirmations']:['generation'];
      const value=await input(request,keys);
      if(!Number.isInteger(value.generation)||value.generation<1)return json({error:'Current generation required'},400);
      let result;
      if(action==='activation'){
        if(!['pilot','live'].includes(value.mode)||!Array.isArray(value.senders)||
          value.senders.length>100||!value.senders.every(id=>typeof id==='string'&&id.length>0&&id.length<=500)||
          value.mode==='pilot'&&!value.senders.length)return json({error:'Invalid activation'},400);
        await authorization.accessToken({authMethod:provider==='tiktok'?'tiktok-business':'instagram-facebook',appId:config.appId,generation:value.generation});
        result=await call(comments?'activate_social_comments':'activate_social_inbox',[config.application,config.inbox,value.generation,value.mode,value.senders]);
      }else if(action==='acceptance'){
        const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
        const fields=comments?['ownedHelp','mentionHelp','nonFollowerHelp','privateGuidance']:['ping','help','nonFollowerHelp','linked','denied'];
        if(!fields.every(key=>uuid.test(value[key]||'')))return json({error:'Acceptance event IDs required'},400);
        const op=await call('new_social_operation',[identity.id]);
        result=await call(comments?'record_social_comment_acceptance':'record_social_acceptance',
          [config.application,config.inbox,value.generation,...fields.map(key=>value[key]),value.confirmations,op]);
      }else result=await authorization[action]({generation:value.generation});
      return result?json(result):json({error:'Connection changed. Reload first.'},409);
    }catch(error){
      const status=[400,401,403,409,413,429].includes(error.status)?error.status:
        error instanceof MessagingAuthorizationChanged||['P0001','connection_changed'].includes(error.code)?409:error.auth||['invalid_token','invalid_account'].includes(error.code)?400:503;
      const callback=new URL(request.url).pathname.endsWith('/oauth/callback');
      const diagnostic=error instanceof MessagingOAuthError&&['exchange','install','provider_verification','store'].includes(error.stage)&&/^(?:[A-Z0-9]{5}|[a-z_]{1,64})$/.test(error.code||'')?{stage:error.stage,code:error.code}:{};
      return json({...diagnostic,error:error instanceof MessagingOAuthError?error.message:status===401?'Sign in first':status===409?'Connection changed. Reload first.':'Messaging operation unavailable'},status,
        callback?{'Set-Cookie':oauth.clearCookie(),'Referrer-Policy':'no-referrer'}:{});
    }
  };
}
