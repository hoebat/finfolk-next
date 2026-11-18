import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readSiteDirectory} from '../js/finfolk-next/site/web-main/src/site-catalog.js';
export async function nativeSites({db,users,publicOperation}){
 const ids=Array.from({length:4},randomUUID),members=Array.from({length:3},randomUUID);
 for(const [index,id] of ids.entries()){
  await db.query('INSERT INTO finfolk."Site"(id,name,timezone,state,area_name) VALUES($1,$2,\'Australia/Sydney\',\'VIC\',\'Example Area\')',[id,'Atlas fixture '+index]);
  await db.query('INSERT INTO finfolk."SiteProfile"(site_id,revision,waterbody,access_mode,status,payload) VALUES($1,1,\'ocean\',\'shore\',$2,$3)',[id,index===1?'archived':'published',{point:index===2?[999,-38]:index===3?null:[145,-38],area_id:'example-area',region:'example-bay',description:'A published fixture location.',source_url:'https://example.test/reference',attribution:'Synthetic publisher',licence:'CC BY 4.0',privateNote:'NEVER_PUBLIC',owner:users[0].id}]);
 }
 async function read(name,values={},token){const response=await publicOperation(name,values,token);assert.equal(response.status,200,await response.clone().text());return response.json();}
 try{
  const catalog=await read('siteCatalog');assert.equal(catalog.beaches.length,1);assert.equal(catalog.beaches[0].id,ids[0]);assert.deepEqual(catalog.beaches[0].point,[145,-38]);assert.equal(catalog.beaches[0].attribution,'Synthetic publisher');assert.equal(catalog.beaches[0].licence,'CC BY 4.0');assert.equal(catalog.states[0].id,'VIC');assert.equal(catalog.areas[0].id,'example-area');
  const untouched=structuredClone(catalog),adapted=await readSiteDirectory({application:{authProvider:'supabase',public:{call:async()=>catalog}},atlas:{regions:[]}});
  assert.equal(adapted.beaches[0].region_name,'Example Area');assert.deepEqual(catalog,untouched,'Map adaptation cannot mutate backbone cache objects');
  let legacyRead=false;await assert.rejects(readSiteDirectory({application:{authProvider:'supabase',public:{call:async()=>{throw Error('Native failure');}}},data:{json:async()=>{legacyRead=true;return catalog;}},atlas:{regions:[]}}),/Native failure/);assert.equal(legacyRead,false,'Native errors cannot silently substitute a legacy site catalogue');
  assert.equal(JSON.stringify(catalog).includes('NEVER_PUBLIC'),false);assert.equal(JSON.stringify(catalog).includes(users[0].id),false);
  assert.deepEqual(await read('siteDetail',{id:ids[0]},users[0].access_token),catalog.beaches[0],'Public atlas DTO is independent of bearer identity');
  for(const id of ids.slice(1))assert.equal((await publicOperation('siteDetail',{id})).status,404);
  assert.deepEqual(await read('discoverPopular'),{places:[]});
  for(const id of members){await db.query('SELECT finfolk_rpc.ensure_account($1)',[id]);await db.query('UPDATE finfolk."User" SET email_verified=true,profile=\'{"open":true}\' WHERE id=$1',[id]);await db.query('INSERT INTO finfolk."UserCheckin"(user_id,site_id,visit_day) VALUES($1,$2,(now() AT TIME ZONE \'Australia/Sydney\')::date)',[id,ids[0]]);}
  assert.deepEqual(await read('discoverPopular'),{places:[ids[0]]});
  await db.query('UPDATE finfolk."User" SET email_verified=false WHERE id=$1',[members[0]]);assert.deepEqual(await read('discoverPopular'),{places:[]},'Popular spots require three active verified open members');
  await db.query('UPDATE finfolk."User" SET email_verified=true,profile=\'{"open":false}\' WHERE id=$1',[members[0]]);assert.deepEqual(await read('discoverPopular'),{places:[]});
  await db.query('UPDATE finfolk."SiteProfile" SET status=\'archived\' WHERE site_id=$1',[ids[0]]);assert.deepEqual((await read('siteCatalog')).beaches,[]);
 }finally{
  for(const id of members){await db.query('SELECT finfolk_rpc.erase_account($1)',[id]);await db.query('SELECT finfolk_rpc.complete_account_deletion($1)',[id]);}
  await db.query('DELETE FROM finfolk."SiteProfile" WHERE site_id=ANY($1::uuid[])',[ids]);await db.query('DELETE FROM finfolk."Site" WHERE id=ANY($1::uuid[])',[ids]);
 }
}
