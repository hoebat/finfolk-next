// Explicit public allowlist. Administrator credentials never enter this response.
export const dynamic='force-dynamic';
export function GET(request){
 if(process.env.FINFOLK_AUTH_PROVIDER!=='supabase')return new Response(null,{status:307,headers:{Location:new URL('/neon-config.json',request.url).href,'Cache-Control':'no-store'}});
 const supabaseUrl=process.env.FINFOLK_SUPABASE_URL,publishableKey=process.env.FINFOLK_SUPABASE_PUBLISHABLE_KEY;
 let publicKey=publishableKey?.startsWith('sb_publishable_');
 if(publishableKey&&!publicKey){try{publicKey=JSON.parse(Buffer.from(publishableKey.split('.')[1],'base64url').toString()).role==='anon';}catch{publicKey=false;}}
 if(!supabaseUrl||!publicKey)return Response.json({enabled:false},{status:503,headers:{'Cache-Control':'no-store'}});
 return Response.json({enabled:true,authProvider:'supabase',supabaseUrl,publishableKey,googleEnabled:process.env.FINFOLK_GOOGLE_AUTH_ENABLED==='true'},
  {headers:{'Cache-Control':'no-store'}});
}
