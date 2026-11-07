import {isInstagramAdmin} from './instagram-actions.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status,code:'directory_error'});};
const text=(s,n=2000)=>typeof s==='string'?s.trim().slice(0,n):'';
export const CATEGORIES=['School','Instructor','Business','Club','Group','Freediver'];
export function socialIdentity(value){
 let u;try{u=new URL(value);}catch{return null;}
 if(u.protocol!=='https:'||u.username||u.password)return null;
 const host=u.hostname.toLowerCase().replace(/^www\./,'');
 const match=host==='instagram.com'?u.pathname.match(/^\/([a-z0-9._]+)\/?$/i):host==='tiktok.com'?u.pathname.match(/^\/@([a-z0-9._]+)\/?$/i):null;
 if(!match||['p','reel','explore','stories','accounts'].includes(match[1].toLowerCase()))return null;
 return (host==='instagram.com'?'instagram:':'tiktok:')+match[1].toLowerCase();
}
function link(s){if(!s)return '';if(typeof s!=='string'||s.length>2048)fail(400,'Link is too long.');let u;try{u=new URL(s);}catch{fail(400,'Enter a valid HTTPS link.');}if(u.protocol!=='https:'||u.username||u.password)fail(400,'Enter a valid HTTPS link.');return u.href;}
export async function directoryRPC(db,uid,admin,op,value={}){
 try{return await db.transaction(async q=>{
 if(op==='owner-create'&&!(await q("SELECT to_regclass('finfolk.\"DirectoryListing\"') IS NOT NULL AS native"))[0].native)fail(503,'Page creation is being prepared. Please try again later.');
 await q("SELECT set_config('finfolk.actor_id',$1,true),set_config('finfolk.directory_admin',$2,true)",[uid||'',admin?'true':'false']);
 return (await q('SELECT finfolk_rpc.directory_operation($1,$2::jsonb) AS value',[op,JSON.stringify(value)]))[0].value;
 });}catch(e){if(['42P01','42883'].includes(e.code))fail(503,'Page creation is being prepared. Please try again later.');const status=({'23505':409,'42501':403,'40001':409,'22023':400,'22P02':400,'P0002':404})[e.code];if(status)fail(status,e.message);throw e;}
}
export function registerDirectoryPublic(app,{db}){
 app.get('/v1/directory',async c=>c.json(await directoryRPC(db,null,false,'public-list',c.req.query())));
 app.get('/v1/directory/:id',async c=>c.json(await directoryRPC(db,null,false,'public-detail',{id:c.req.param('id')})));
}
export function registerDirectoryPrivate(app,{db,fetcher=fetch}){
 const who=c=>{const w=c.get('messagingIdentity');if(!w?.verified)fail(403,'Verify your email first.');return {...w,admin:isInstagramAdmin(w.uid,c.env||{})};};
 const body=async c=>{const raw=await c.req.text();if(raw.length>100000)fail(413,'Request too large.');let value;try{value=JSON.parse(raw);}catch{fail(400,'Invalid request.');}if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Invalid request.');return value;};
 for(const [path,op,method]of [['me/directory','mine','get'],['admin/directory','admin','get'],['me/directory/create','owner-create','post'],['me/directory/save','owner-save','post'],['admin/directory/save','admin-save','post'],['me/directory/claim','claim','post'],['admin/directory/claim-review','claim-review','post'],['me/directory/report','report','post'],['admin/directory/report-resolve','report-resolve','post'],['admin/directory/merge','merge','post'],['me/directory/access','page-access','post'],['me/directory/invite','invite-create','post'],['me/directory/invite-redeem','invite-redeem','post'],['me/directory/invite-revoke','invite-revoke','post'],['me/directory/admin-remove','admin-remove','post']]){
 app[method]('/v1/'+path,async c=>{const w=who(c);return c.json({data:await directoryRPC(db,w.uid,w.admin,op,method==='get'?{}:await body(c))});});}
 app.post('/v1/admin/directory/discover',async c=>{
 const w=who(c);if(!w.admin)fail(403,'Administrator required.');const v=await body(c),region=text(v.region,100),category=CATEGORIES.includes(v.category)?v.category:'School';if(!region)fail(400,'Enter a region or country.');if(!c.env.BRAVE_SEARCH_API_KEY)fail(503,'Configure BRAVE_SEARCH_API_KEY to enable discovery.');
 const rpc=(op,value)=>directoryRPC(db,w.uid,w.admin,op,value),term=`freediving ${category} ${region} ${category==='Freediver'?text(v.country,100):'Australia'} ${text(v.seed,100)}`,run=await rpc('run-start',{query:term});let count=0;
 let state='complete',error='';
 try{for(const filter of ['','site:instagram.com','site:tiktok.com']){
 const url=new URL('https://api.search.brave.com/res/v1/web/search');url.search=new URLSearchParams({q:term+' '+filter,country:'AU',count:'20'});
 const response=await fetcher(url,{headers:{'X-Subscription-Token':c.env.BRAVE_SEARCH_API_KEY},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Search failed');const data=await response.json();
 for(const result of data.web?.results||[]){let source;try{source=link(result.url);}catch{continue;}const social=socialIdentity(source);if(!social&&/instagram\.com|tiktok\.com/.test(new URL(source).hostname))continue;
 const saved=await rpc('candidate',{identity:social||'website:'+source.replace(/\/$/,''),document:{name:text(result.title,160),category,state:'',locality:region,description:'',socials:social?[social]:[],sources:[source],website:social?'':source},notes:text(result.description)});count+=saved.inserted;
 }}}catch{state='failed';error='Search failed; saved candidates retained. Retry discovery.';}
 await rpc('run-finish',{id:run.id,state,error});return c.json({data:{id:run.id,count}});
 });
}
