import {ids,nativeTime} from './fixtures/ids.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {connect,quote} from './harness.mjs';
import {installEntities,user,diveSession,operation} from './fixtures/entities.mjs';

const db=await connect();
const catalog=JSON.parse(await readFile('resources/finfolkdb/entity-catalog.json','utf8'));
const modules=JSON.parse(await readFile('resources/finfolkdb/type-namespaces.json','utf8'));
const domainModules=new Set(['import-base','environment-base','site-base','social-account','social-workflow','messaging-base','messaging-delivery','user-reward','shop-base'].map(name=>'finfolkdb.common.type-'+name));
const table=name=>'finfolk.'+quote(name);
try{
 await installEntities(db);
 const live=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='finfolk' ORDER BY tablename")).rows.map(row=>row.tablename);
 assert.deepEqual(live,Object.keys(catalog).sort(),'Every active type must be reachable from the SQL entrypoint');
 assert.deepEqual([...new Set(Object.values(catalog).map(spec=>spec.module))].filter(module=>!modules[module]),[]);
 const alice=await user(db,ids.alice),bob=await user(db,ids.bob);
 await db.query(`INSERT INTO finfolk."Site"(id,name,timezone) VALUES('${ids.bondi}','Bondi','Australia/Sydney')`);
 const session=await diveSession(db);
 const rows=new Map([['User',alice],['Site',{id:ids.bondi}],['DiveSession',session]]);
 const enums=new Map();
 for(const row of (await db.query(`SELECT t.typname,e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' ORDER BY e.enumsortorder`)).rows){
  if(!enums.has(row.typname))enums.set(row.typname,row.enumlabel);
 }
 const overrides={
  SocialConnectionProof:{token_hash:"a".repeat(64),kind:"manual"},
  EnvironmentSnapshot:{valid_from:nativeTime('2026-11-04T00:00:00Z'),valid_to:nativeTime('2026-11-05T00:00:00Z'),fresh_until:nativeTime('2026-11-05T00:00:00Z'),delete_after:nativeTime('2099-01-01T00:00:00Z')},
  MessagingMessage:{external_id:'fixture-message',sent_at:nativeTime('2026-11-04T00:00:00Z')},MessagingReceipt:{deadline:nativeTime('2099-01-01T00:00:00Z')},MessagingOutbox:{deadline:nativeTime('2099-01-01T00:00:00Z')},UserInvitationJoin:{inviter_id:bob.id}
 };
 async function insert(name){
  if(rows.has(name))return rows.get(name);
  const spec=catalog[name];assert.ok(spec,'Known target '+name);
  const values={...overrides[name]};
  if(spec.entity.addons.includes('audit')){
   values.id=randomUUID();
   values.audit_id=(await db.query('SELECT finfolk_rpc.create_social_audit($1,$2,$3::jsonb) AS id',[name,values.id,JSON.stringify(await operation(db,'type-fixture'))])).rows[0].id;
  }
  for(const column of spec.columns){
   const key=column['sql-name'];
   if(key in values||!column.required||column.spec.sql?.default!==undefined||column.spec.sql?.raw?.includes('identity'))continue;
   if(column.reference){
    const target=await insert(column.reference.table);
    const primary=catalog[column.reference.table].columns.filter(c=>c.primary);
    assert.equal(primary.length,1,'These external data references target simple keys');
    values[key]=target[primary[0]['sql-name']];
   }else if(column.type==='enum'){
    values[key]=enums.get(column.spec.enum.ns.split('/').at(-1));
    assert.ok(values[key],'A real enum must exist for '+name+'.'+key);
   }else{
    values[key]=({time:1,long:1,map:'{}',array:'[]',text:name+'-'+key,uuid:randomUUID(),integer:1,bigint:1,boolean:false,jsonb:'{}',date:'2026-11-04',timestamptz:'2026-11-04T00:00:00Z'})[column.type];
    assert.notEqual(values[key],undefined,'Fixture supports '+name+'.'+key);
   }
  }
  const keys=Object.keys(values),args=Object.values(values);
  const sql=keys.length?`INSERT INTO ${table(name)} (${keys.map(quote)}) VALUES (${args.map((_,i)=>'$'+(i+1))}) RETURNING *`:`INSERT INTO ${table(name)} DEFAULT VALUES RETURNING *`;
  let result;
  try{result=await db.query(sql,args);}catch(error){error.message=name+': '+error.message;throw error;}
  rows.set(name,result.rows[0]);return result.rows[0];
 }
 const newTables=Object.entries(catalog).filter(([,spec])=>domainModules.has(spec.module)).map(([name])=>name);
 assert.ok(newTables.length>0,'Domain modules must publish live tables');
 for(const name of newTables)await insert(name);
 // Exercise every authored reference and enum on every new table, including
 // nullable links. PostgreSQL must reject missing parents and unknown labels.
 let referenceChecks=0,enumChecks=0;
 for(const name of newTables){
  for(const column of catalog[name].columns){
   if(column.reference){
    const primary=catalog[column.reference.table].columns.find(c=>c.primary);
    const missing=primary.type==='uuid'?randomUUID():'missing-parent';
    await assert.rejects(db.query(`UPDATE ${table(name)} SET ${quote(column['sql-name'])}=$1`,[missing]),error=>error.code==='23503',name+'.'+column.name+' enforces its reference');
    referenceChecks++;
   }else if(column.type==='enum'){
    await assert.rejects(db.query(`UPDATE ${table(name)} SET ${quote(column['sql-name'])}='not-an-enum-label'`),error=>error.code==='22P02',name+'.'+column.name+' enforces its enum');
    enumChecks++;
   }
  }
 }
 const businessChecks=[
  ['EnvironmentJob','attempts=-1'],['EnvironmentJob',"lease_token='"+randomUUID()+"'"],
  ['EnvironmentSnapshot','valid_to=valid_from'],['EnvironmentSnapshot',"delete_after=1"],['EnvironmentSnapshot','schema_version=0'],
  ['SocialAccount',"external_id=''"],['SocialDiscovery',"candidates='{}'"],['UserInvitationJoin',"inviter_id=invitee_id"],
  ['MessagingAccount',"generation=0"],['MessagingOutbox',"body=repeat('x',2001)",{code:'P0001',message:/bounds/}],
  ['UserPointsEntry','points=2'],['SiteCatalog','singleton=false'],['SiteCatalog','revision=-1'],
  ['FinnieItem','cost=0'],['FinnieItem','stock=-1'],['FinnieItem','revision=0'],
  ['FinnieItem',"title=''"],['FinnieItem',"outlet=repeat('x',161)"],
  ['FinnieEntry','amount=0'],['FinnieRedemption','cost=0']
 ];
 for(const [name]of businessChecks)assert.ok(rows.has(name),'Constraint fixture exists for '+name);
 for(const [name,assignment,expected={code:'23514'}]of businessChecks)await assert.rejects(db.query(`UPDATE ${table(name)} SET ${assignment}`),expected,name+' enforces '+assignment);
 for(const name of newTables)assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table(name)}`)).rows[0].n,1,name+' has a valid live row');
 console.log(`TYPE_NAMESPACES_PASS: ${Object.keys(modules).length} modules; ${live.length} live tables; all ${newTables.length} domain tables accept rows; ${referenceChecks} FK checks, ${enumChecks} enum checks and ${businessChecks.length} business checks.`);
}finally{await db.end();}
