import {randomUUID} from 'node:crypto';
import {quote,schema} from './harness.mjs';
export const overrides={
 events:{starts_at:"2027-01-01T10:00:00Z",ends_at:"2027-01-01T12:00:00Z"},event_rsvps:{state:"going"},
 site_profiles:{waterbody:'unknown',access_mode:'unknown',status:'published'},site_revisions:{status:'draft'},site_imports:{status:'draft'},site_access_points:{mode:'shore'},site_depth_evidence:{kind:'reported'},
 members:{user_id:'alice',profile:{displayName:'Alice',open:true}},beaches:{id:'bondi',timezone:'Australia/Sydney'},
 blocks:{owner_id:'alice',target_id:'bob'},connections:{a:'alice',b:'bob',requested_by:'alice',status:'pending'},
 invitation_joins:{invitee_id:'alice',inviter_id:'bob'},community_referrals:{platform:'instagram'},
 instagram_actions:{kind:'reply'},instagram_commands:{context:'mention',command:'/ping'},
 instagram_sources:{kind:'tags'},instagram_post_reports:{reason:'other'},messaging_accounts:{id:'instagram'},
 trip_imports:{expected_rows:1},trip_import_batches:{batch_index:0,rows:[]},trip_dives:{ordinal:0},
 instagram_discoveries:{media_id:'123'},
};
export const valueFor=(type,name)=>type==='uuid'?randomUUID():type==='boolean'?false:type==='jsonb'?{}:type==='date'?'2026-11-01':type==='timestamptz'?'2026-11-01T00:00:00Z':['integer','bigint'].includes(type)?1:'fixture-'+name;
export async function seed(db,constraints){
 const seeds=new Map(),seeding=new Set();
 await db.query(`INSERT INTO neon_auth."user" VALUES('alice','Alice',true,false),('bob','Bob',true,false),('carol','Carol',false,false),('banned','Banned',true,true)`);
 async function table(name){
  if(seeds.has(name))return seeds.get(name);
  if(seeding.has(name))throw Error('Required FK fixture cycle: '+name);seeding.add(name);
  const spec=schema[name],row={};
  const keys=new Set(constraints.filter(c=>c.table===name&&['p','u'].includes(c.type)).flatMap(c=>c.columns));
  for(const col of spec.columns)if((!col.nullable&&!col.default&&!col.identity)||keys.has(col.name))row[col.name]=valueFor(col.type,col.name);
  Object.assign(row,overrides[name]);
  for(const fk of constraints.filter(c=>c.table===name&&c.type==='f')){
   if(fk.columns.every(c=>spec.columns.find(s=>s.name===c).nullable))continue;
   const parent=await table(fk.parent);
   fk.columns.forEach((c,i)=>{if(!Object.hasOwn(overrides[name]||{},c))row[c]=parent[fk.parentColumns[i]];});
  }
  const existing=await db.query(`SELECT * FROM finfolk.${quote(name)} LIMIT 1`);
  let result=existing.rows[0];
  if(!result){const cols=Object.keys(row);result=(await db.query(`INSERT INTO finfolk.${quote(name)} (${cols.map(quote)}) OVERRIDING SYSTEM VALUE VALUES(${cols.map((_,i)=>'$'+(i+1))}) RETURNING *`,cols.map(c=>typeof row[c]==='object'&&row[c]!==null?JSON.stringify(row[c]):row[c]))).rows[0];}
  seeds.set(name,result);seeding.delete(name);
  if(name==='members')await db.query(`INSERT INTO finfolk.members(user_id) VALUES('bob'),('carol'),('banned')`);
  return result;
 }
 for(const name of Object.keys(schema))await table(name);
 return seeds;
}
