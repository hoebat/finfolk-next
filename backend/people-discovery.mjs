import {windowFor} from './community-core.mjs';
const fail=message=>{throw Object.assign(Error(message),{status:400});};
export async function discoverPeople({v,uid,q,basic,now}){
 const seed=v.seed,beachId=v.beachId||'',availability=v.availability||'',experience=v.experience||'';
 if(typeof seed!=='string'||!/^[A-Za-z0-9_-]{8,64}$/.test(seed))fail('Refresh the people mix and try again.');
 if(typeof beachId!=='string'||beachId&&!/^[A-Za-z0-9_-]{1,128}$/.test(beachId))fail('Choose a listed location.');
 if(!['','weekday mornings','weekday afternoons','weekend mornings','weekend afternoons'].includes(availability)||!['','new','comfortable','experienced'].includes(experience))fail('Choose listed availability and experience filters.');
 const beach=beachId?(await q('SELECT id,timezone FROM finfolk.beaches WHERE id=$1',[beachId]))[0]:null;
 if(beachId&&!beach)fail('Choose a listed location.');
 const {start,today}=windowFor(now(),beach?.timezone||'UTC');
 let rank='',after='';
 if(v.cursor){
  try{if(typeof v.cursor!=='string'||v.cursor.length>1000)throw Error();const cursor=JSON.parse(Buffer.from(v.cursor,'base64url').toString());if(cursor.length!==5||cursor[0]!==seed||cursor[1]!==JSON.stringify([beachId,availability,experience])||!/^[a-f0-9]{32}$/.test(cursor[2])||typeof cursor[3]!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(cursor[3])||cursor[4]!==uid)throw Error();rank=cursor[2];after=cursor[3];}catch{fail('This people mix changed. Start a new mix.');}
 }
 const rows=await q(`WITH eligible AS (
  SELECT m.user_id,m.profile,md5($1||':'||$2||':'||m.user_id) AS mix_rank,
   CASE WHEN $3::text='' THEN 0 ELSE (SELECT count(*)::int FROM finfolk.checkins c WHERE c.user_id=m.user_id AND c.beach_id=$3 AND c.visit_day BETWEEN $4::date AND $5::date) END AS visits,
   (SELECT status FROM finfolk.connections cn WHERE (cn.a=$1 AND cn.b=m.user_id) OR (cn.b=$1 AND cn.a=m.user_id) LIMIT 1) AS connection
  FROM finfolk.members m WHERE m.user_id<>$1 AND NOT m.deleted AND m.profile->>'open'='true'
   AND ($6::text='' OR coalesce(m.profile->'availability','[]'::jsonb) ? $6)
   AND ($7::text='' OR m.profile->>'experience'=$7)
   AND NOT EXISTS(SELECT 1 FROM finfolk.blocks bl WHERE (bl.owner_id=$1 AND bl.target_id=m.user_id) OR (bl.target_id=$1 AND bl.owner_id=m.user_id))
   AND NOT EXISTS(SELECT 1 FROM finfolk.connections cn WHERE ((cn.a=$1 AND cn.b=m.user_id) OR (cn.b=$1 AND cn.a=m.user_id)) AND cn.status='declined')
 ) SELECT * FROM eligible WHERE ($3::text='' OR visits>0 OR coalesce(profile->'beaches','[]'::jsonb) ? $3)
 AND (mix_rank,user_id)>($8,$9) ORDER BY mix_rank,user_id LIMIT 7`,[uid,seed,beachId,start,today,availability,experience,rank,after]);
 const page=rows.slice(0,6),last=page.at(-1);
 return {people:page.map(m=>({...basic(m),regular:!!beachId&&m.visits>=3,recent:!!beachId&&m.visits>0,connection:m.connection})),cursor:rows.length>6?Buffer.from(JSON.stringify([seed,JSON.stringify([beachId,availability,experience]),last.mix_rank,last.user_id,uid])).toString('base64url'):null};
}
