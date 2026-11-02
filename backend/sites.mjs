import {randomUUID} from 'node:crypto';
import {isInstagramAdmin} from './instagram-actions.mjs';
import {WATERBODIES,ACCESS_MODES,SITE_FEATURES,siteAreaID,isInland} from '../js/finfolk-next/site/web-main/src/site-model.js';
const fail=(status,message,code='site_error')=>{throw Object.assign(Error(message),{status,code});};
const text=(v,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
const url=v=>{try{const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password)throw Error();return u.href;}catch{fail(400,'A valid HTTPS source URL is required.','invalid_source');}};
const point=v=>{if(!Array.isArray(v)||v.length!==2||v.some(n=>typeof n!=='number'||!Number.isFinite(n))||Math.abs(v[0])>180||Math.abs(v[1])>90)fail(400,'Use a valid longitude and latitude.','invalid_coordinates');return v;};
const uuid=v=>{if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v||''))fail(400,'Invalid draft identifier.');return v;};
const version=v=>{if(!Number.isSafeInteger(v)||v<0)fail(400,'A valid revision is required.');return v;};
export function siteDocument(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Enter site details.');
 const id=text(input.id,128),name=text(input.name,160),state=text(input.state_id,8),area=text(input.area_name,120),timezone=text(input.timezone,100);
 if(!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(id)||!name||!area||!['VIC','NSW','JBT','QLD','SA','WA','NT','TAS','ACT','EXT'].includes(state))fail(400,'Site ID, name, state and region are required.');
 try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{fail(400,'Choose a valid timezone.');}
 const waterbody=input.waterbody||'unknown',access_mode=input.access_mode||'unknown';
 if(!WATERBODIES.includes(waterbody)||!ACCESS_MODES.includes(access_mode))fail(400,'Choose a valid waterbody and access method.');
 for(const key of ['access_points','depth_evidence','facts','restrictions','features','aliases'])if(input[key]!==undefined&&!Array.isArray(input[key]))fail(400,'Site '+key.replaceAll('_',' ')+' must be a list.');
 const access_points=(input.access_points||[]).map(a=>{if(!['shore','departure'].includes(a.mode)||!text(a.name,160))fail(400,'Access points need a name and type.');return {name:text(a.name,160),mode:a.mode,point:point(a.point),source_url:url(a.source_url),booking_url:a.booking_url?url(a.booking_url):'',notes:text(a.notes),verified:a.verified===true};});
 const depth_evidence=(input.depth_evidence||[]).map(d=>{if(!['surveyed','reported'].includes(d.kind)||!Number.isFinite(d.depth_m)||d.depth_m<=0||d.depth_m>1500||!text(d.reference,160))fail(400,'Depth evidence needs metres, a reference and source.');return {kind:d.kind,depth_m:d.depth_m,reference:text(d.reference,160),source_url:url(d.source_url),reviewed_at:text(d.reviewed_at,10)};});
 if(access_points.length>20||depth_evidence.length>20)fail(400,'Use up to 20 access points and depth records.');
 if(access_mode==='boat_only'&&access_points.some(a=>a.mode==='shore'))fail(400,'A boat-only site cannot list a shore entry.');
 const facts=(input.facts||[]).map(f=>({label:text(f.label,80),text:text(f.text),source_url:url(f.source_url),reviewed_at:text(f.reviewed_at,10)}));
 const restrictions=(input.restrictions||[]).map(r=>({activity:text(r.activity,60),status:['restricted','closed','unknown'].includes(r.status)?r.status:'unknown',text:text(r.text),source_url:url(r.source_url),reviewed_at:text(r.reviewed_at,10)}));
 if(facts.length>40||restrictions.length>20)fail(400,'Too many site facts.');
 const doc={id,name,state_id:state,state:text(input.state,100)||state,area_name:area,area_id:text(input.area_id,128)||siteAreaID(state,area),timezone,point:point(input.point),waterbody,access_mode,
  features:[...new Set((input.features||[]).filter(f=>SITE_FEATURES.includes(f)))],aliases:[...new Set((input.aliases||[]).map(v=>text(v,160)))].slice(0,20),
  source_url:url(input.source_url),source_id:text(input.source_id,128)||'finfolk-reviewed-sites',reference_label:text(input.reference_label,200)||name,
  detail_file:/^data\/areas\/[a-z0-9_-]+\.json$/.test(input.detail_file||'')?input.detail_file:undefined,nearby_checked_stays:Number.isSafeInteger(input.nearby_checked_stays)?input.nearby_checked_stays:0,nearest_checked_stay_km:Number.isFinite(input.nearest_checked_stay_km)?input.nearest_checked_stay_km:undefined,reviewed_at:text(input.reviewed_at,10),requirements:text(input.requirements),booking_url:input.booking_url?url(input.booking_url):'',activity_status:['documented','unknown'].includes(input.activity_status)?input.activity_status:'unknown',
  access_points,depth_evidence,facts,restrictions,archived:input.archived===true,region:text(input.region,128),group:area};
 doc.has_access_facts=facts.some(f=>['Access','Entry'].includes(f.label));doc.fact_categories=facts.filter(f=>f.label==='Habitat').map(f=>f.text);doc.restricted_activities=restrictions.filter(r=>['restricted','closed'].includes(r.status)).map(r=>r.activity);
 doc.entry_documented=access_points.some(a=>a.mode==='shore'&&a.verified);const entry=access_points.find(a=>a.mode==='shore'&&a.verified);
 if(entry)doc.entry={point:entry.point,verified:true,label:entry.name};
 if(isInland(doc))doc.region='site-'+id;
 return doc;
}
export function parseSiteImport(raw,format){
 if(format==='json'){let rows;try{rows=JSON.parse(raw);}catch{fail(400,'The JSON file could not be read.');}return Array.isArray(rows)?rows:rows.sites;}
 if(format!=='csv')fail(400,'Choose a CSV or JSON file.');
 // RFC 4180 fields, quoted commas/newlines and escaped quotes.
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<=raw.length;i++){const c=raw[i];if(c==='"'){if(quoted&&raw[i+1]==='"'){cell+='"';i++;}else if(quoted)quoted=false;else if(!cell)quoted=true;else fail(400,'Invalid CSV quoting.');}
 else if((c===','||c==='\n'||c===undefined)&&!quoted){row.push(cell.replace(/\r$/,''));cell='';if(c!==','){if(row.some(Boolean))rows.push(row);row=[];}}else if(c!==undefined)cell+=c;}
 if(quoted)fail(400,'The CSV has an unclosed quote.');
 const keys=rows.shift()||[];return rows.map(values=>{const r=Object.fromEntries(keys.map((k,i)=>[k.trim(),values[i]||'']));return {...r,point:[Number(r.longitude),Number(r.latitude)],features:r.features?r.features.split('|'):[],aliases:r.aliases?r.aliases.split('|'):[]};});
}
export async function publicSiteCatalog(q){const value=(await q('SELECT finfolk_rpc.site_catalog_read() AS value'))[0]?.value;if(!value)fail(503,'The site directory is being prepared.');return value;}
const mapError=e=>{if(e.code==='40001')fail(409,'This site changed. Reload the latest record before publishing or editing.','site_revision_conflict');if(e.code==='42501')fail(403,'Verified member access is required.');if(e.code==='22023')fail(400,'Site details could not be validated.');throw e;};
export function registerSitesPublic(app,{db}){
 app.get('/v1/discover/popular',async c=>c.json((await db.query('SELECT finfolk_rpc.discover_popular() AS data'))[0].data));
 app.get('/v1/sites/catalog',async c=>c.json(await publicSiteCatalog(db.query)));
 app.get('/v1/sites/:id',async c=>{const row=(await db.query("SELECT payload,revision FROM finfolk.site_profiles WHERE id=$1 AND status='published'",[c.req.param('id')]))[0];if(!row)fail(404,'Dive site not found.');return c.json({...row.payload,revision:row.revision});});
}
export function registerSitesPrivate(app,{db}){
 const reply=(c,value)=>c.json({data:value});
 const identity=c=>{const v=c.get('messagingIdentity');if(!v?.verified)fail(403,'Verify your email before submitting sites.');return {...v,admin:isInstagramAdmin(v.uid,c.env||{})};};
 const admin=c=>{const v=identity(c);if(!v.admin)fail(403,'Administrator access required.');return v;};
 const body=async c=>{const raw=await c.req.text();if(raw.length>2*1024*1024)fail(413,'The import is too large.');try{return JSON.parse(raw);}catch{fail(400,'The request could not be read.');}};
 const save=async(q,who,v,importID=null)=>{try{return (await q('SELECT finfolk_rpc.site_draft_save($1,$2,$3::jsonb,$4,$5,$6) AS value',[who.uid,who.admin,JSON.stringify(siteDocument(v.site)),v.id?uuid(v.id):randomUUID(),version(v.version??0),importID]))[0].value;}catch(e){mapError(e);}};
 app.get('/v1/me/site-submissions',async c=>{const who=identity(c);return reply(c,{submissions:await db.query('SELECT * FROM finfolk.site_revisions WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 100',[who.uid]),admin:who.admin});});
 app.post('/v1/me/site-submissions',async c=>{const who=identity(c),v=await body(c);return reply(c,await save(db.query,{...who,admin:false},v));});
 app.post('/v1/me/site-submissions/:id/withdraw',async c=>{const who=identity(c),v=await body(c);const row=(await db.query("UPDATE finfolk.site_revisions SET status='withdrawn',version=version+1,updated_at=now() WHERE id=$1 AND owner_id=$2 AND status='submitted' AND version=$3 RETURNING id",[uuid(c.req.param('id')),who.uid,version(v.version)]))[0];if(!row)fail(409,'Submission changed or is no longer pending.');return reply(c,{ok:true});});
 app.get('/v1/admin/sites',async c=>{admin(c);return reply(c,{drafts:await db.query('SELECT * FROM finfolk.site_revisions ORDER BY updated_at DESC LIMIT 200'),imports:await db.query('SELECT * FROM finfolk.site_imports ORDER BY created_at DESC LIMIT 50')});});
 app.post('/v1/admin/sites/drafts',async c=>{const who=admin(c),v=await body(c);const row=v.id?(await db.query('SELECT import_id FROM finfolk.site_revisions WHERE id=$1',[uuid(v.id)]))[0]:null;return reply(c,await save(db.query,who,v,row?.import_id||null));});
 app.post('/v1/admin/sites/drafts/:id/publish',async c=>{const who=admin(c),v=await body(c);try{return reply(c,await db.transaction(async q=>{const r=(await q('SELECT import_id FROM finfolk.site_revisions WHERE id=$1',[uuid(c.req.param('id'))]))[0];if(r?.import_id)fail(409,'Publish this record from its import batch.');return (await q('SELECT finfolk_rpc.site_publish($1,$2,$3) AS value',[who.uid,c.req.param('id'),version(v.version)]))[0].value;}));}catch(e){mapError(e);}});
 app.post('/v1/admin/sites/drafts/:id/reject',async c=>{const who=admin(c),v=await body(c);if(!text(v.reason))fail(400,'Enter a review reason.');const row=(await db.query("UPDATE finfolk.site_revisions SET status='rejected',reason=$2,reviewed_by=$3,version=version+1,updated_at=now() WHERE id=$1 AND status IN ('draft','submitted') AND version=$4 RETURNING id",[uuid(c.req.param('id')),text(v.reason),who.uid,version(v.version)]))[0];if(!row)fail(409,'The draft changed. Reload before reviewing.');return reply(c,{ok:true});});
 app.get('/v1/admin/sites/imports/:id',async c=>{admin(c);const batch=(await db.query('SELECT * FROM finfolk.site_imports WHERE id=$1',[uuid(c.req.param('id'))]))[0];if(!batch)fail(404,'Import not found.');return reply(c,{...batch,drafts:await db.query('SELECT * FROM finfolk.site_revisions WHERE import_id=$1 ORDER BY site_id',[batch.id])});});
 app.post('/v1/admin/sites/imports',async c=>{const who=admin(c),v=await body(c),rows=parseSiteImport(String(v.content||''),v.format);if(!Array.isArray(rows)||!rows.length||rows.length>500)fail(400,'Import between 1 and 500 sites.');const errors=[],documents=[],seen=new Set();for(const [i,row] of rows.entries()){try{const doc=siteDocument(row);if(seen.has(doc.id))throw Error('Duplicate site ID in file.');seen.add(doc.id);documents.push(doc);}catch(e){errors.push({row:i+1,message:e.message});}}if(errors.length)return c.json({error:{message:'Fix the import rows before continuing.',details:errors}},400);
  const existing=(await db.query('SELECT id,payload FROM finfolk.site_profiles')).map(r=>r.payload);
  const candidates=documents.flatMap(d=>existing.filter(e=>e.id!==d.id&&(e.name.toLowerCase()===d.name.toLowerCase()||(Math.abs(e.point[0]-d.point[0])<.005&&Math.abs(e.point[1]-d.point[1])<.005))).map(e=>({id:d.id,possibleDuplicate:e.id,name:e.name})));
  return reply(c,await db.transaction(async q=>{const id=randomUUID();await q('INSERT INTO finfolk.site_imports(id,owner_id) VALUES($1,$2)',[id,who.uid]);await q('UPDATE finfolk.site_imports SET preview=$2::jsonb WHERE id=$1',[id,JSON.stringify({candidates,updates:documents.filter(d=>existing.some(e=>e.id===d.id)).map(d=>d.id)})]);const drafts=[];for(const doc of documents)drafts.push(await save(q,who,{site:doc},id));return {id,drafts,candidates,updates:documents.filter(d=>existing.some(e=>e.id===d.id)).map(d=>d.id)};}));
 });
 app.post('/v1/admin/sites/imports/:id/publish',async c=>{const who=admin(c),v=await body(c);if(v.confirmed!==true)fail(400,'Review and confirm the import before publishing.');try{return reply(c,await db.transaction(async q=>{const batch=(await q('SELECT * FROM finfolk.site_imports WHERE id=$1 FOR UPDATE',[uuid(c.req.param('id'))]))[0];if(!batch)fail(404,'Import not found.');if(batch.status==='published')return {ok:true};const drafts=await q("SELECT id,version FROM finfolk.site_revisions WHERE import_id=$1 AND status='draft' ORDER BY site_id",[batch.id]);if(!drafts.length)fail(409,'No publishable drafts in this import.');if(!Array.isArray(v.versions)||JSON.stringify(v.versions)!==JSON.stringify(drafts.map(r=>({id:r.id,version:String(r.version)}))))fail(409,'The import changed. Preview it again.');for(const d of drafts)await q('SELECT finfolk_rpc.site_publish($1,$2,$3)',[who.uid,d.id,d.version]);await q("UPDATE finfolk.site_imports SET status='published' WHERE id=$1",[batch.id]);return {ok:true,count:drafts.length};}));}catch(e){mapError(e);}});
}
