import {sessionInput} from '../js/finfolk-next/site/web-main/src/logbook-model.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export const taggedForFinFolk=text=>/(?:^|[^a-z0-9_@.])@finfolk\.com\.au(?![a-z0-9_.])/i.test(String(text||''));
// The collector establishes ownership using Meta's author id. A matching handle
// or a comment written by a different account never establishes ownership.
export async function importInstagramInbox(q,uid){
 await q(`INSERT INTO finfolk.media_imports(owner_id,platform,provider_id,url,kind,posted_at,day,beach_id,location_name,candidates)
 SELECT d.owner_id,'instagram',d.media_id,d.url,CASE WHEN d.url LIKE '%/reel/%' THEN 'video' ELSE 'post' END,d.posted_at,
 (d.posted_at AT TIME ZONE coalesce(b.timezone,'UTC'))::date,d.beach_id,coalesce(b.name,''),d.candidates
 FROM finfolk.instagram_discoveries d
 JOIN finfolk.instagram_connections c ON c.user_id=d.owner_id AND c.media_owner_id=d.author_id AND c.status='connected'
 JOIN finfolk.members m ON m.user_id=d.owner_id AND NOT m.deleted
 LEFT JOIN finfolk.beaches b ON b.id=d.beach_id
 WHERE d.owner_id=$1 AND d.media_id IS NOT NULL AND d.state IN ('pending','published')
 AND NOT EXISTS(SELECT 1 FROM finfolk.instagram_suppressed_sources s WHERE s.author_id=d.author_id)
 AND (d.sources ? 'tags' OR d.caption ~* '(^|[^a-z0-9_@.])@finfolk[.]com[.]au([^a-z0-9_.]|$)')
 ON CONFLICT(owner_id,platform,provider_id) DO NOTHING`,[uid]);
}
const available=`((i.platform='tiktok' AND EXISTS(SELECT 1 FROM finfolk.tiktok_connections t WHERE t.user_id=i.owner_id AND t.status='connected')) OR (i.platform='instagram' AND EXISTS(SELECT 1 FROM finfolk.instagram_discoveries d JOIN finfolk.instagram_connections c ON c.user_id=d.owner_id AND c.media_owner_id=d.author_id AND c.status='connected' WHERE d.owner_id=i.owner_id AND d.media_id=i.provider_id AND d.state IN ('pending','published') AND NOT EXISTS(SELECT 1 FROM finfolk.instagram_suppressed_sources s WHERE s.author_id=d.author_id))))`;
const dto=r=>({id:r.id,platform:r.platform,url:r.url,kind:r.kind,postedAt:r.posted_at,day:r.import_day??r.day,beachId:r.beach_id,locationName:r.location_name,candidates:r.candidates,notes:r.notes,sessionId:r.session_id});
export async function sessionMedia(q,sessionId,ownerId){
 const rows=await q(`SELECT i.* FROM finfolk.media_imports i WHERE i.session_id=$1 AND i.owner_id=$2 AND i.state='active' AND ${available} ORDER BY i.posted_at,i.id`,[sessionId,ownerId]);
 // Inbox notes are private; publication only exposes the original post link.
 return rows.map(r=>({id:r.id,platform:r.platform,url:r.url,kind:r.kind}));
}
export const mediaActions=new Set(['mediaInbox','updateImportedMedia','assignImportedMedia','hideImportedMedia']);
export async function mediaAction({action,v,uid,db,env}){
 const q=db.query;
 if(action==='mediaInbox'){
  await importInstagramInbox(q,uid);
  const items=await q(`SELECT i.*,i.day::text AS import_day FROM finfolk.media_imports i WHERE i.owner_id=$1 AND i.session_id IS NULL AND i.state='active' AND ${available} ORDER BY i.created_at DESC,i.id DESC LIMIT 100`,[uid]);
  const instagram=(await q("SELECT status,media_owner_id IS NOT NULL AS owner_verified FROM finfolk.instagram_connections WHERE user_id=$1",[uid]))[0];
  return {items:items.map(dto),instagram:{connected:instagram?.status==='connected',ownerVerified:!!instagram?.owner_verified,collecting:env.INSTAGRAM_DISCOVERY_ENABLED==='true'},limit:100};
 }
 if(!uuid(v.id))fail('Choose an imported post.');
 return db.transaction(async tq=>{
  const row=(await tq(`SELECT i.* FROM finfolk.media_imports i WHERE i.id=$1 AND i.owner_id=$2 AND i.state='active' AND ${available} FOR UPDATE`,[v.id,uid]))[0];
  if(!row)fail('Imported post unavailable.',404);
  if(action==='hideImportedMedia'){
   await tq("UPDATE finfolk.media_imports SET state='hidden',session_id=NULL,assignment_key=NULL,updated_at=now() WHERE id=$1",[row.id]);return {ok:true};
  }
  if(action==='updateImportedMedia'){
   const values=v.values||{};
   let day=values.day||null;
   if(day){try{if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)fail('Choose a valid day.');}catch{fail('Choose a valid day.');}}
   const location=String(values.locationName||'').trim(),notes=String(values.notes||'');
   if(location.length>160||notes.length>10000)fail('Use up to 160 characters for a location and 10,000 for notes.');
   const beachId=values.beachId||null;
   if(beachId&&!(await tq('SELECT id FROM finfolk.beaches WHERE id=$1',[beachId])).length)fail('Choose a location from the directory.');
   await tq('UPDATE finfolk.media_imports SET day=$2,beach_id=$3,location_name=$4,notes=$5,edited=true,updated_at=now() WHERE id=$1',[row.id,day,beachId,location,notes]);return {ok:true};
  }
  if(action==='assignImportedMedia'){
   if(!uuid(v.key))fail('Use a new assignment key.');
   if(row.assignment_key===v.key&&row.session_id)return {id:row.session_id};
   if(row.session_id&&v.sessionId!==null)fail('This post already belongs to a session. Return it to the inbox first.',409);
   let sessionId=v.sessionId;
   if(v.values){
    let data;try{data=sessionInput(v.values);}catch(e){fail(e.message);}
    data.visibility='private';data.photos=[];
    if(data.beachId&&!(await tq('SELECT id FROM finfolk.beaches WHERE id=$1',[data.beachId])).length)fail('Choose a location from the directory.');
    sessionId=(await tq('INSERT INTO finfolk.sessions(owner_id,beach_id,data) VALUES($1,$2,$3::jsonb) RETURNING id',[uid,data.beachId||null,JSON.stringify(data)]))[0].id;
   }else if(sessionId!==null){
    if(!uuid(sessionId))fail('Choose one of your sessions.');
    const session=(await tq('SELECT data FROM finfolk.sessions WHERE id=$1 AND owner_id=$2 FOR UPDATE',[sessionId,uid]))[0];
    if(!session)fail('Session unavailable.',404);
    if(session.data.visibility==='public'&&v.publicConsent!==true)fail('Confirm that this post link will be visible on the published session.',409);
   }
   await tq('UPDATE finfolk.media_imports SET session_id=$2,assignment_key=$3,updated_at=now() WHERE id=$1',[row.id,sessionId,v.key]);
   return {id:sessionId};
  }
  fail('Unknown media action.');
 });
}
