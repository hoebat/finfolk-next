import {pageRoutes} from './page-routes.generated.js';
// Shared compatibility routes for Next routing and Netlify edge routing.
export function homeDestination(input,supplied){
 const url=new URL(input),params=supplied??Object.fromEntries([...new Set(url.searchParams.keys())].map(key=>{const values=url.searchParams.getAll(key);return [key,values.length===1?values[0]:values];}));
 if(params.view==='trip')return new URL('/reports/'+encodeURIComponent(typeof params.trip==='string'&&params.trip?params.trip:'invalid'),url);
 const query=new URLSearchParams(params);
 if(params.view==='account'&&typeof params.reportTrip==='string'){query.delete('view');query.delete('tab');return new URL('/account/posts?'+query,url);}
 if(params.view==='logbook'){query.delete('view');return new URL('/logbook'+(query.size?'?'+query:''),url);}
 if(params.view==='account'&&!params.tab){query.delete('view');return new URL('/account'+(query.size?'?'+query:''),url);}
 if(Object.keys(params).some(key=>!/^utm_/i.test(key)&&!['fbclid','gclid','msclkid','v'].includes(key)))return new URL('/app?'+query,url);
 return null;
}
export const legacyRedirects=pageRoutes.legacyRedirects;
// Netlify's prerendered route cache can serve /app before Next's redirects.
// Run these same rules at the edge, retaining destination/query precedence.
export function legacyDestination(input){
 const url=new URL(input),path=url.pathname.replace(/\/$/,'')||'/';
 for(const rule of legacyRedirects){
  if(rule.source!==path)continue;
  const params={};let matches=true;
  for(const condition of rule.has||[]){const value=url.searchParams.get(condition.key);if(!value){matches=false;break;}if(condition.value!==undefined){const match=value.match(new RegExp('^(?:'+condition.value+')$'));if(!match){matches=false;break;}Object.assign(params,match.groups);}}
  if(!matches)continue;
  const destination=rule.destination.replace(/:([a-zA-Z]+)/g,(_,name)=>encodeURIComponent(params[name]));
  const target=new URL(destination,url),preset=new Set(target.searchParams.keys());
  for(const [key,value]of url.searchParams)if(!preset.has(key))target.searchParams.append(key,value);
  return target;
 }
 return null;
}

export function profileDestination(inputURL,supplied){
 const url=new URL(inputURL),input=supplied??Object.fromEntries([...new Set(url.searchParams.keys())].map(key=>{const values=url.searchParams.getAll(key);return [key,values.length===1?values[0]:values];}));
 const screen=typeof input.screen==='string'&&input.screen?input.screen:'people';
 const query=new URLSearchParams(),keep=keys=>{for(const key of keys)if(typeof input[key]==='string'&&input[key])query.set(key,input[key]);};
 let path;
 if(screen==='directory'){path='/directory';keep(['q','category','state','locality','offset']);}
 else if(screen==='listing')path=typeof input.id==='string'&&input.id?'/directory/'+encodeURIComponent(input.id):'/directory';
 else if(screen==='my-listings')path='/pages';
 else if(screen==='superadmin')path='/pages/review';
 else if(screen==='page-invite'){path='/pages/invitation';keep(['token']);}
 else if(screen==='events'){
  path=input.eventMode==='mine'?'/events/my':input.eventMode==='edit'?'/events/new':input.eventMode==='invitation'?'/events/invitation':input.eventMode==='detail'&&typeof input.id==='string'&&input.id?'/events/'+encodeURIComponent(input.id):'/events';
  keep(input.eventMode==='edit'?['id','duplicate','page']:input.eventMode==='invitation'?['token']:['q','location','category','from','offset','page']);
 }else{
  keep(['location','availability','experience']);if(!query.has('location')&&typeof input.site==='string'&&input.site)query.set('location',input.site);
  path=screen==='people'?'/people':screen==='edit'?'/profile/edit':screen==='member'?('/members'+(typeof input.id==='string'&&input.id?'/'+encodeURIComponent(input.id):'')):'/profile';
 }
 return new URL(path+(query.size?'?'+query:''),url);
}
