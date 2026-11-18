import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
export const siteDocument=id=>({id,name:'Native review lake',state_id:'VIC',area_name:'Example Area',timezone:'Australia/Melbourne',point:[145,-38],waterbody:'lake',access_mode:'shore',source_url:'https://example.test/site-reference',attribution:'Synthetic reference publisher',licence:'CC BY 4.0',features:['training'],aliases:[],access_points:[{mode:'shore',name:'Documented entry',point:[145,-38],source_url:'https://example.test/access',verified:true}],depth_evidence:[{kind:'reported',depth_m:12,reference:'Below water surface',source_url:'https://example.test/depth'}],facts:[{label:'Access',text:'Follow the marked public access.',source_url:'https://example.test/access'}],restrictions:[]});
export async function nativeSiteReview({db,accountDatabase,users,operation,publicOperation}){
 const drafts=[],sites=[],extraUsers=[],initial=(await db.query('SELECT * FROM finfolk."SiteCatalog" WHERE singleton')).rows[0];
 async function call(user,name,values={}){const response=await operation(user,name,values);assert.equal(response.status,200,await response.clone().text());return response.json();}
 async function guest(name,values={}){const response=await publicOperation(name,values);assert.equal(response.status,200,await response.clone().text());return response.json();}
 const doc=siteDocument('review-'+randomUUID()),requestId=randomUUID();
 try{
  const first=await call(users[0],'siteSubmissionSave',{requestId,site:doc});drafts.push(first.id);assert.equal(first.status,'submitted');assert.equal(first.site_id,null);assert.equal(first.version,1);
  assert.deepEqual(await call(users[0],'siteSubmissionSave',{requestId,site:doc}),first,'Creation request replay is idempotent');
  assert.equal((await db.query('SELECT count(*)::int n FROM finfolk."Site" WHERE key=$1',[doc.id])).rows[0].n,0,'Unreviewed sites do not create public catalogue/selector rows');
  assert.deepEqual((await guest('siteCatalog')).beaches,[]);
  assert.equal((await operation(users[1],'siteSubmissionSave',{id:first.id,version:1,site:doc})).status,403);
  assert.equal((await operation(users[0],'siteDraftPublish',{id:first.id,version:1})).status,403,'Auth metadata cannot grant review rights');
  assert.equal((await operation(users[0],'siteSubmissionSave',{site:{...doc,owner_id:users[1].id}})).status,400);
  await assert.rejects(accountDatabase.pool.query('SELECT finfolk_rpc.call_native_site_review($1,false,\'submit\',$2)',[users[0].id,{site:doc}]),error=>error.code==='42501');
  await assert.rejects(accountDatabase.pool.query('SELECT finfolk_rpc.native_site_document($1)',[{...doc,access_points:[{...doc.access_points[0],privateNote:'Reject unknown nested fields'}]}]),error=>error.code==='22023');
  const edited=await call(users[0],'siteSubmissionSave',{id:first.id,version:1,site:{...doc,name:'Reviewed native lake'}});assert.equal(edited.version,2);
  assert.equal((await operation(users[0],'siteSubmissionSave',{id:first.id,version:1,site:doc})).status,409);
  await db.query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,\'admin\')',[users[1].id]);
  assert.ok((await call(users[1],'siteAdmin')).drafts.some(row=>row.id===first.id));
  assert.equal((await operation(users[1],'siteDraftPublish',{id:first.id,version:1})).status,409);
  const published=await call(users[1],'siteDraftPublish',{id:first.id,version:2});sites.push(published.site);assert.equal(published.revision,1);
  const catalogVersion=(await guest('siteCatalog')).revision;assert.deepEqual(await call(users[1],'siteDraftPublish',{id:first.id,version:2}),published);assert.equal((await guest('siteCatalog')).revision,catalogVersion);
  const row=await guest('siteDetail',{id:published.site});assert.equal(row.name,'Reviewed native lake');assert.equal(row.access_points[0].name,'Documented entry');assert.equal(row.facts[0].source_url,doc.facts[0].source_url);assert.equal(row.licence,'CC BY 4.0');
  const current={...edited.payload,id:published.site};
  const a=await call(users[1],'siteDraftSave',{requestId:randomUUID(),site:{...current,name:'Concurrent A'}}),b=await call(users[1],'siteDraftSave',{requestId:randomUUID(),site:{...current,name:'Concurrent B'}});drafts.push(a.id,b.id);
  const race=await Promise.all([operation(users[1],'siteDraftPublish',{id:a.id,version:1}),operation(users[1],'siteDraftPublish',{id:b.id,version:1})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409],'Publication compares the current native site revision atomically');
  const withdrawn=await call(users[0],'siteSubmissionSave',{requestId:randomUUID(),site:siteDocument('withdraw-'+randomUUID())});drafts.push(withdrawn.id);
  assert.equal((await operation(users[1],'siteSubmissionWithdraw',{id:withdrawn.id,version:1})).status,403);await call(users[0],'siteSubmissionWithdraw',{id:withdrawn.id,version:1});
  const rejected=await call(users[0],'siteSubmissionSave',{requestId:randomUUID(),site:siteDocument('reject-'+randomUUID())});drafts.push(rejected.id);
  assert.equal((await operation(users[1],'siteDraftReject',{id:rejected.id,version:1,reason:''})).status,400);await call(users[1],'siteDraftReject',{id:rejected.id,version:1,reason:'More source evidence needed.'});
  assert.ok((await call(users[0],'mySiteSubmissions')).submissions.some(row=>row.id===rejected.id&&row.reason==='More source evidence needed.'));
  const archive=await call(users[1],'siteDraftSave',{requestId:randomUUID(),site:{...current,archived:true}});drafts.push(archive.id);await call(users[1],'siteDraftPublish',{id:archive.id,version:1});assert.equal((await publicOperation('siteDetail',{id:published.site})).status,404);
  const eraseId=randomUUID();extraUsers.push(eraseId);await db.query('SELECT finfolk_rpc.ensure_account($1)',[eraseId]);
  const secret=(await accountDatabase.pool.query('SELECT finfolk_rpc.call_native_site_review($1,true,\'submit\',$2) value',[eraseId,{requestId:randomUUID(),site:siteDocument('erase-'+randomUUID())}])).rows[0].value;
  await accountDatabase.pool.query('SELECT finfolk_rpc.erase_account($1)',[eraseId]);assert.equal((await db.query('SELECT count(*)::int n FROM finfolk."SiteRevision" WHERE id=$1',[secret.id])).rows[0].n,0,'Account erasure removes private site work and its child records');
 }finally{
  await db.query('DELETE FROM finfolk."UserRole" WHERE user_id=$1 AND role=\'admin\'',[users[1].id]);
  await db.query('DELETE FROM finfolk."SiteRevision" WHERE id=ANY($1::uuid[])',[drafts]);await db.query('DELETE FROM finfolk."SiteProfile" WHERE site_id=ANY($1::uuid[])',[sites]);await db.query('DELETE FROM finfolk."Site" WHERE id=ANY($1::uuid[])',[sites]);
  if(initial)await db.query('UPDATE finfolk."SiteCatalog" SET revision=$1,metadata=$2 WHERE singleton',[initial.revision,initial.metadata]);else await db.query('DELETE FROM finfolk."SiteCatalog" WHERE singleton');
  for(const id of extraUsers)await db.query('SELECT finfolk_rpc.complete_account_deletion($1)',[id]);
 }
}
