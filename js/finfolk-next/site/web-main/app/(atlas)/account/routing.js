export function accountURL(tab){const url=new URL(location.href);url.pathname=tab==='checkin'?'/account/checkin':tab==='profile'?'/account/privacy':tab==='settings'?'/account/settings':tab==='posts'?'/account/posts':tab==='instagram'?'/account/instagram':tab==='sites'?'/account/sites':tab==='admin'?'/account/review':'/app';if(['checkin','profile','settings','posts','sites','admin','instagram'].includes(tab)){url.searchParams.delete('view');url.searchParams.delete('tab');}else{url.searchParams.set('view','account');url.searchParams.set('tab',tab);}return url.href;}

export function accountReturnDestination(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x1f]/.test(value))return null;
 const url=new URL(value,'https://finfolk.invalid');
 if(/^\/account\/settings(?:\/|$)/.test(url.pathname))url.pathname=url.pathname.replace(/\/+$/,'');
 if(url.origin!=='https://finfolk.invalid'||!/^\/(?:u\/[a-zA-Z0-9_-]{3,40}|community|map|pages(?:\/invitation)?|directory\/[^/]+|shop|account\/(?:checkin|posts|instagram|privacy|settings(?:\/(?:profile|privacy|appearance|account|messaging))?|sites|review))$/.test(url.pathname))return null;
 url.searchParams.delete('returnTo');
 return url.pathname+url.search+url.hash;
}

export function spotSignInURL(site,notes=false){
 const target=new URL('/map',location.origin);
 if(location.pathname==='/map')target.search=location.search;
 target.searchParams.set('site',site);
 for(const key of ['listing','event','previewActor'])target.searchParams.delete(key);
 if(notes)target.hash='notes-'+site;
 return '/account?returnTo='+encodeURIComponent(target.pathname+target.search+target.hash);
}
