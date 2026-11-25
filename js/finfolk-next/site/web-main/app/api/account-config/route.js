import {publicAccountConfig} from '../../../lib/public-account-config.js';
export const dynamic='force-dynamic';
export function GET(request){
 if(process.env.NODE_ENV==='development'&&process.env.FINFOLK_MOCK_PREVIEW==='1')return Response.json({enabled:true,authProvider:'preview',backbone:true,cacheBackend:'memory',authUrl:'preview',cacheApiUrl:'preview',apiUrl:new URL('/',request.url).href,instagram:{enabled:false}},{headers:{'Cache-Control':'no-store'}});
 const config=publicAccountConfig(process.env);
 return Response.json(config?{...config,apiUrl:new URL('/',request.url).href,authUrl:config.supabaseUrl,backbone:true,cacheBackend:'memory'}:{enabled:false},{status:config?200:503,headers:{'Cache-Control':'no-store'}});
}
