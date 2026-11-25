import {readFileSync} from 'node:fs';
// Local preview adapter for app.manage's environment control plane.
export function environmentFeatureFlags({env=process.env}={}){
 const endpoint=env.APP_MANAGE_FEATURE_FLAGS_URL;if(!endpoint)return null;
 const url=new URL(endpoint);
 if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/features'||!url.searchParams.get('id'))throw Error('Preview flags require a loopback environment controller');
 return async()=>{
  const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw Error('Environment flags unavailable');const value=await response.json();
  if(value.environment!==url.searchParams.get('id')||!value.flags||Object.values(value.flags).some(v=>typeof v!=='boolean'))throw Error('Invalid environment flag response');
  return {...value,preview:true};
 };
}

// Direct dev launches must use the same environment decisions as workbench launches.
export function localPreviewFeatureFlags({env=process.env,configFile=new URL('../../config/environments.json',import.meta.url)}={}){
 if(env.APP_MANAGE_FEATURE_FLAGS_URL)return environmentFeatureFlags({env});
 const disabled=()=>({flags:{},revision:0,preview:true});
 let config;try{config=JSON.parse(readFileSync(configFile,'utf8'));}catch(error){if(error.code==='ENOENT')return async()=>disabled();throw error;}
 const selected=config.environments?.find(item=>item.id===config.default_environment);
 if(selected?.kind!=='local'||!selected.feature_flags)return async()=>disabled();
 if(!Number.isInteger(config.port)||config.port<1024||config.port>65535)throw Error('Invalid local environment controller port');
 const provider=environmentFeatureFlags({env:{APP_MANAGE_FEATURE_FLAGS_URL:'http://127.0.0.1:'+config.port+'/features?id='+encodeURIComponent(selected.id)}});
 return async()=>{try{return await provider();}catch{return disabled();}};
}
