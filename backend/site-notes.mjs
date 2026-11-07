import {readLimited} from './messaging-http.mjs';
import {isInstagramAdmin} from './instagram-actions.mjs';
const fail=(status,message,code='site_notes_error')=>{throw Object.assign(Error(message),{status,code});};
const site=value=>{if(typeof value!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(value))fail(400,'Choose a valid dive site.');return value;};
const note=value=>{if(typeof value!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value))fail(400,'Choose a valid note.');return value;};
const bool=value=>{if(typeof value!=='boolean')fail(400,'Provide an explicit true or false value.');return value;};
const rev=value=>{if(!Number.isSafeInteger(value)||value<1||value>2147483647)fail(400,'Reload the latest note before trying again.');return value;};
const TOPICS=['all','access','facilities','wildlife','conditions'];
const rows=result=>Array.isArray(result)?result:result.rows;
export function siteNotesService(db){
 async function call(name,args,{uid='',admin=false}={}){
  if(!db?.transaction)fail(503,'Community notes are being prepared.','site_notes_unavailable');
  try{return await db.transaction(async query=>{
   await query("SELECT set_config('finfolk.actor_id',$1,true),set_config('finfolk.directory_admin',$2,true)",[uid,admin?'true':'false']);
   return rows(await query(`SELECT finfolk_rpc.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS value`,args))[0].value;
  });}catch(error){
   if(error.status)throw error;
   if(['42P01','42883'].includes(error.code))fail(503,'Community notes are being prepared.','site_notes_unavailable');
   if(error.code==='P0001'){
    const message=error.message||'';
    if(/Verified|Administrator/.test(message))fail(403,'Verified member or administrator access required.');
    if(/unavailable/.test(message))fail(404,'That note is unavailable.');
    if(/changed|already used/.test(message))fail(409,'This note changed. Reload it before trying again.');
    fail(400,'Check the site, note topic, text and observation date.');
   }
   if(['22007','22008','22P02','23514'].includes(error.code))fail(400,'Check the note details and observation date.');
   throw error;
  }
 }
 return {
  async list(id,values={},identity){const key=site(id),sort=values.sort||'helpful',topic=values.topic||'all',offset=Number(values.offset||0);if(!['helpful','newest'].includes(sort)||!TOPICS.includes(topic)||!Number.isSafeInteger(offset)||offset<0||offset>10000)fail(400,'Choose valid note filters.');if(!db)return {enabled:false,notes:[],next:null};return {enabled:true,...await call('ret_site_notes',[key,sort,topic,offset,!!identity],identity)};},
  save(id,value,identity){const body=typeof value.text==='string'?value.text.trim():'';if(body.length<10||body.length>1000||!TOPICS.slice(1).includes(value.topic))fail(400,'Write 10–1,000 characters and choose a topic.');const observed=value.observedOn||null;if(observed&&(typeof observed!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(observed)||!Number.isFinite(Date.parse(observed))||new Date(observed+'T12:00:00Z').toISOString().slice(0,10)!==observed))fail(400,'Use a valid observation date.');if(value.topic==='conditions'&&!observed)fail(400,'Add the date you observed these conditions.');return call('save_site_note',[site(id),note(value.id),value.topic,body,observed],identity);},
  vote:(id,value,identity)=>call('set_site_note_vote',[site(id),note(value.id),bool(value.upvoted)],identity),
  withdraw:(id,value,identity)=>call('set_site_note_withdrawn',[site(id),note(value.id),rev(value.revision),bool(value.withdrawn)],identity),
  report(id,value,identity){const reason=typeof value.reason==='string'?value.reason.trim():'';if(!reason||reason.length>1000)fail(400,'Provide a report reason of up to 1,000 characters.');return call('report_site_note',[site(id),note(value.id),reason],identity);},
  moderate:(id,value,identity)=>call('moderate_site_note',[site(id),note(value.id),bool(value.hidden)],identity),
 };
}
async function body(c){let value;try{value=JSON.parse(new TextDecoder().decode(await readLimited(c.req.raw,8000)));}catch(error){if(error.status)throw error;fail(400,'Send a valid note request.');}if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Send a valid note request.');return value;}
export function registerSiteNotesPublic(app,{db}){const service=siteNotesService(db);app.get('/v1/sites/:site/notes',async c=>{c.header('Cache-Control','no-store');return c.json(await service.list(c.req.param('site'),c.req.query()));});}
export function registerSiteNotesPrivate(app,{db}){const service=siteNotesService(db),identity=c=>{const user=c.get('messagingIdentity');if(!user?.uid||!user.verified)fail(403,'Verify your email to contribute notes.');return {uid:user.uid,admin:isInstagramAdmin(user.uid,c.env||{})};};
 app.get('/v1/me/sites/:site/notes',async c=>{c.header('Cache-Control','private, no-store');return c.json({data:await service.list(c.req.param('site'),c.req.query(),identity(c))});});
 for(const action of ['save','vote','withdraw','report'])app.post('/v1/me/sites/:site/notes/'+action,async c=>{const who=identity(c),value=await body(c);c.header('Cache-Control','private, no-store');return c.json({data:await service[action](c.req.param('site'),value,who)});});
 app.post('/v1/admin/sites/:site/notes/moderate',async c=>{const who=identity(c);if(!who.admin)fail(403,'Administrator access required.');return c.json({data:await service.moderate(c.req.param('site'),await body(c),who)});});
}
