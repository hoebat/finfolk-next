import {createHash} from 'node:crypto';
import {readLimited} from './messaging-http.mjs';

// The host supplies real Supabase getUser verification and a trusted proxy IP.
// Payloads never select application, inbox, actor or provider identity.
export function createSocialMemberHTTP({runtime,adapter,authenticate,allowedOrigins,trustedIP,provider='instagram'}) {
  if(!['instagram','tiktok'].includes(provider))throw Error('Unsupported member connection provider');
  const prefix='/v1/me/'+provider,label=provider==='tiktok'?'TikTok':'Instagram';
  const origins=new Set(allowedOrigins);
  const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  return async request=>{
    try {
      const path=new URL(request.url).pathname;
      if(![prefix,prefix+'/connect',prefix+'/disconnect'].includes(path))return json({error:'Not found'},404);
      const status=path===prefix;
      if(request.method!==(status?'GET':'POST'))return json({error:'Method not allowed'},405);
      if(!status&&!origins.has(request.headers.get('Origin')))return json({error:'Origin not allowed'},403);
      const identity=await authenticate(request);
      if(!identity?.id)return json({error:'Sign in first'},401);
      if(!status&&identity.verified!==true)return json({error:'Verify your FinFolk email first'},403);
      if(status)return json(await runtime.memberStatus(identity.id));
      let input;
      try {input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readLimited(request,4096)));}
      catch(error){return json({error:'Invalid request'},error.status===413?413:400);}
      const fields=path.endsWith('/connect')?['code']:['connectionId','identityVersion'];
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.includes(key))||
        fields.some(key=>typeof input[key]!=='string'||input[key].length>100))return json({error:'Invalid request'},400);
      if(path.endsWith('/connect')){
        const ip=trustedIP(request);
        if(!ip)return json({error:'Client verification unavailable'},503);
        const result=await runtime.redeemVerified(identity.id,input.code,createHash('sha256').update(ip).digest('hex'),adapter);
        if(result?.error==='rate_limited')return json({error:'Too many attempts. Try again in 15 minutes.'},429);
        if(!result)return json({error:provider==='instagram'?'Code unavailable. Follow @finfolk.com.au and send /connect again.':'Code unavailable. Follow FinFolk on TikTok and send /connect again.'},409);
        return json(await runtime.memberStatus(identity.id));
      }
      const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
      if(!uuid.test(input.connectionId)||!uuid.test(input.identityVersion))return json({error:'Invalid request'},400);
      if(!await runtime.disconnect(identity.id,input.connectionId,input.identityVersion))return json({error:'Connection changed. Reload first.'},409);
      return json({connected:false});
    }catch(error){return json({error:error.status===401?'Sign in first':label+' connection unavailable'},error.status===401?401:503);}
  };
}
