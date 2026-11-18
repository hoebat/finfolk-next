// Real native RPC/DB semantics; no profile or statistics model substitutes.
import assert from 'node:assert/strict';
export async function nativeProfile({db,users,operation,siteId,today}){
 const ids=users.map(user=>user.id),sessions=[],posts=[];
 const original=(await db.query('SELECT id,profile FROM finfolk."User" WHERE id=ANY($1::uuid[])',[ids])).rows;
 const visits=(await db.query('SELECT user_id,site_id,visit_day::text AS visit_day FROM finfolk."UserCheckin" WHERE user_id=ANY($1::uuid[])',[ids])).rows;
 async function call(user,name,values={}){const response=await operation(user,name,values);assert.equal(response.status,200,await response.clone().text());return response.json();}
 try{
  await db.query('DELETE FROM finfolk."UserCheckin" WHERE user_id=ANY($1::uuid[])',[ids]);
  for(const user of users)await call(user,'preferences',{profile:{open:true,sharing:{visits:true,months:true,dives:true,time:true,depth:true}}});
  const request={target:users[0].id,beachId:siteId};
  assert.deepEqual((await call(users[1],'stats',request)).stats,{});
  for(const [durationMinutes,maxDepthMetres] of [[10,5],[20,15]]){
   const saved=await call(users[0],'saveSession',{values:{date:today,locationName:'Profile native proof',beachId:siteId,durationMinutes,maxDepthMetres,notes:'Private stats input'}});sessions.push(saved.id);
  }
  assert.equal((await operation(users[0],'preferences',{profile:{featuredLogs:[sessions[0]]}})).status,400,'Private sessions cannot be featured');
  await call(users[0],'visibility',{id:sessions[0],visibility:'public'});
  await call(users[0],'preferences',{profile:{featuredLogs:[sessions[0]]}});
  assert.equal((await operation(users[1],'preferences',{profile:{featuredLogs:[sessions[0]]}})).status,400,'A published session still belongs to its owner');
  const jpeg=Buffer.alloc(20);jpeg[0]=255;jpeg[1]=216;jpeg[2]=255;jpeg[18]=255;jpeg[19]=217;
  const portrait='data:image/jpeg;base64,'+jpeg.toString('base64');
  assert.equal((await call(users[0],'preferences',{profile:{portrait}})).portrait,portrait);
  const largeJPEG=Buffer.alloc(49100);largeJPEG[0]=255;largeJPEG[1]=216;largeJPEG[2]=255;largeJPEG[49098]=255;largeJPEG[49099]=217;
  const largePortrait='data:image/jpeg;base64,'+largeJPEG.toString('base64');
  assert.equal((await call(users[0],'preferences',{profile:{portrait:largePortrait}})).portrait,largePortrait,'A portrait within the DB size limit must fit the transport envelope');
  assert.equal((await operation(users[0],'preferences',{profile:{portrait:'x'.repeat(100000)}})).status,413);
  await call(users[0],'preferences',{profile:{portrait}});
  assert.equal((await operation(users[0],'preferences',{profile:{portrait:'data:image/svg+xml;base64,PHN2Zz4='}})).status,400);
  assert.equal((await operation(users[0],'preferences',{profile:{portrait:'data:image/jpeg;base64,'+Buffer.alloc(20).toString('base64')}})).status,400);
  await db.query('INSERT INTO finfolk."UserCheckin"(user_id,site_id,visit_day) SELECT u,$2::uuid,$3::date-d FROM unnest($1::uuid[]) u CROSS JOIN generate_series(0,7) d',[ids,siteId,today]);
  await db.query('INSERT INTO finfolk."UserCheckin"(user_id,site_id,visit_day) VALUES($1,$2,$3::date+1),($1,$2,$3::date-60)',[users[0].id,siteId,today]);
  const regular=await call(users[1],'stats',request);
  assert.equal(regular.level,2);assert.equal(regular.progress,8);assert.equal(regular.expiresWithActivity,true);
  assert.deepEqual(regular.stats,{visits:8,months:2,dives:2,minutes:30,typicalDepth:15});
  assert.equal(Object.hasOwn(regular.profile,'sharing'),false,'Member stats projection excludes private preferences');
  assert.deepEqual(regular.profile.featuredLogs,[sessions[0]]);
  await call(users[0],'preferences',{profile:{sharing:{visits:true}}});
  assert.deepEqual((await call(users[1],'stats',request)).stats,{visits:8},'Sharing flags apply independently of eligibility');
  await call(users[0],'preferences',{profile:{open:false}});
  const closed=await call(users[1],'stats',request);assert.equal(closed.level,0);assert.deepEqual(closed.stats,{});assert.equal(closed.profile.restricted,true);
  await call(users[0],'connection',{target:users[1].id,mode:'request'});await call(users[1],'connection',{target:users[0].id,mode:'accept'});
  await db.query('DELETE FROM finfolk."UserCheckin" WHERE user_id=ANY($1::uuid[])',[ids]);
  const buddy=await call(users[1],'stats',request);assert.equal(buddy.level,2);assert.equal(buddy.expiresWithActivity,false);assert.deepEqual(buddy.stats,{visits:0});assert.equal(buddy.profile.restricted,false);
  await call(users[0],'block',{target:users[1].id});assert.equal((await operation(users[1],'stats',request)).status,404);await call(users[0],'unblock',{target:users[1].id});
  for(const user of users){
   const result=await db.query("SELECT finfolk_rpc.insert_social_post($1,$2,$3,'instagram','preview',true,finfolk.op_fn('profile-fixture',$1,'{}'::jsonb)) value",[user.id,siteId,'https://www.instagram.com/p/'+(user===users[0]?'NativeAlice':'NativeBob')+'/']);
   const value=result.rows[0].value,id=Array.isArray(value)?value[0]?.id:value.id;assert.ok(id);posts.push(id);
  }
  assert.equal((await call(users[0],'myPosts')).length,1,'Owner post listing must not include another owner');
  assert.equal((await operation(users[0],'preferences',{profile:{featuredPosts:[posts[0]]}})).status,400,'Pending posts cannot be featured');
  await db.query('UPDATE finfolk."SocialPost" SET status=\'approved\' WHERE id=ANY($1::uuid[])',[posts]);
  await call(users[0],'preferences',{profile:{open:true,featuredPosts:[posts[0]]}});
  assert.equal((await operation(users[0],'preferences',{profile:{featuredPosts:[posts[1]]}})).status,400,'Approved posts still require ownership');
  const visible=await call(users[1],'profile',{target:users[0].id});assert.deepEqual(visible.posts.map(post=>post.id),[posts[0]]);
  await db.query('UPDATE finfolk."SocialPost" SET public_consent=false WHERE id=$1',[posts[0]]);
  assert.deepEqual((await call(users[1],'profile',{target:users[0].id})).posts,[],'Withdrawing consent immediately removes featured content');
 }finally{
  for(const id of sessions)await operation(users[0],'deleteSession',{id});
  const streams=(await db.query('DELETE FROM finfolk."SocialPost" WHERE id=ANY($1::uuid[]) RETURNING rev_id,audit_id',[posts])).rows;
  for(const row of streams){await db.query('DELETE FROM finfolk."Rev" WHERE id=$1',[row.rev_id]);await db.query('DELETE FROM finfolk."Audit" WHERE id=$1',[row.audit_id]);}
  await db.query('DELETE FROM finfolk."UserCheckin" WHERE user_id=ANY($1::uuid[])',[ids]);
  for(const row of visits)await db.query('INSERT INTO finfolk."UserCheckin"(user_id,site_id,visit_day) VALUES($1,$2,$3)',[row.user_id,row.site_id,row.visit_day]);
  for(const row of original)await db.query('UPDATE finfolk."User" SET profile=$2::jsonb WHERE id=$1',[row.id,JSON.stringify(row.profile)]);
  await db.query('DELETE FROM finfolk."UserConnection" WHERE user_id=least($1::uuid,$2::uuid) AND target_id=greatest($1::uuid,$2::uuid)',ids);
 }
}
