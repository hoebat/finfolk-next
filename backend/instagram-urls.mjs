// Server configuration only: never derive private account links from request headers.
export function instagramPublicURL(env={}) {
 const value=env.FINFOLK_PUBLIC_URL || (env.ENVIRONMENT==='next'?'https://next.finfolk.com.au':'https://finfolk.com.au');
 const url=new URL(value);
 if(!['https:','http:'].includes(url.protocol) || url.username || url.password)throw Error('Invalid FinFolk public URL');
 return url.origin;
}
export const instagramAccountURL=env=>instagramPublicURL(env)+'/?view=account&tab=instagram';
export const instagramLinks=(text,env)=>text.replaceAll('https://finfolk.com.au',instagramPublicURL(env));
