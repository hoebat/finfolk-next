export function publicAccountConfig(env){
 const supabaseUrl=env.FINFOLK_SUPABASE_URL||'https://supabase.finfolk.com.au',publishableKey=env.FINFOLK_SUPABASE_PUBLISHABLE_KEY;
 let url;try{url=new URL(supabaseUrl);}catch{return null;}
 const local=env.NODE_ENV==='development'&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname);
 if(!local&&url.origin!=='https://supabase.finfolk.com.au')return null;
 if(url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))return null;
 let publicKey=typeof publishableKey==='string'&&publishableKey.startsWith('sb_publishable_');
 if(publishableKey&&!publicKey)try{publicKey=JSON.parse(Buffer.from(publishableKey.split('.')[1],'base64url').toString()).role==='anon';}catch{}
 if(!publicKey)return null;
 return {enabled:true,authProvider:'supabase',supabaseUrl:url.origin,publishableKey,googleEnabled:env.FINFOLK_GOOGLE_AUTH_ENABLED==='true',githubEnabled:env.FINFOLK_GITHUB_AUTH_ENABLED==='true'};
}
