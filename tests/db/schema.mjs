import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {connect,migrate,schema,quote,savepoint} from './harness.mjs';
import {seed,valueFor} from './fixtures.mjs';
const db=await connect(),covered=[];
const norm=s=>String(s).replaceAll('"','').replaceAll(',','').replace(/\s+/g,'').toLowerCase();
const specIdentity=(t,c)=>schema[t].columns.find(col=>col.name===c).identity;
const types={timestamptz:'timestamp with time zone',integer:'integer',bigint:'bigint',text:'text',boolean:'boolean',jsonb:'jsonb',uuid:'uuid',date:'date'};
try{
 await migrate(db);
 const tables=(await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='finfolk' ORDER BY tablename`)).rows.map(r=>r.tablename);
 assert.deepEqual(tables,Object.keys(schema));
 const constraints=(await db.query(`SELECT t.relname AS "table",c.conname AS name,c.contype AS type,pg_get_constraintdef(c.oid) AS definition,
 ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum,n) JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum ORDER BY k.n) AS columns,
 p.relname AS parent,ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum,n) JOIN pg_attribute a ON a.attrelid=p.oid AND a.attnum=k.attnum ORDER BY k.n) AS "parentColumns"
 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace LEFT JOIN pg_class p ON p.oid=c.confrelid WHERE n.nspname='finfolk' ORDER BY t.relname,c.conname`)).rows;
 for(const [table,spec] of Object.entries(schema)){
  const columns=(await db.query(`SELECT a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,NOT a.attnotnull AS nullable,pg_get_expr(d.adbin,d.adrelid) AS "default",a.attidentity AS identity FROM pg_attribute a JOIN pg_class t ON t.oid=a.attrelid JOIN pg_namespace n ON n.oid=t.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=t.oid AND d.adnum=a.attnum WHERE n.nspname='finfolk' AND t.relname=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,[table])).rows;
  assert.equal(columns.length,spec.columns.length,table+' columns');
  for(const [i,col] of spec.columns.entries())assert.deepEqual({...columns[i],default:norm(columns[i].default)}, {...col,type:types[col.type],default:norm(col.default)},table+'.'+col.name);
  assert.deepEqual(constraints.filter(c=>c.table===table).map(c=>norm(c.definition)).sort(),spec.constraints.map(norm).sort(),table+' constraints');
  covered.push({table,checks:['columns','types','nullability','defaults','identity','constraints']});
 }
 await db.query('BEGIN');
 const seeds=await seed(db,constraints);
 for(const table of tables){
  await db.query(`CREATE TEMP TABLE fixture (LIKE finfolk.${quote(table)} INCLUDING ALL)`);
  await db.query(`INSERT INTO fixture OVERRIDING SYSTEM VALUE SELECT * FROM finfolk.${quote(table)} LIMIT 1`);
  for(const c of constraints.filter(c=>c.table===table)){
   await savepoint(db,async()=>{
    if(c.type==='n'){
     if(specIdentity(table,c.columns[0])){
      const row={...seeds.get(table),[c.columns[0]]:null},cols=Object.keys(row);
      await assert.rejects(db.query(`INSERT INTO fixture (${cols.map(quote)}) OVERRIDING SYSTEM VALUE VALUES(${cols.map((_,i)=>'$'+(i+1))})`,cols.map(k=>typeof row[k]==='object'&&row[k]!==null&&!(row[k] instanceof Date)?JSON.stringify(row[k]):row[k])),e=>e.code==='23502');
     }else await assert.rejects(db.query(`UPDATE fixture SET ${quote(c.columns[0])}=NULL`),e=>e.code==='23502');
    }
    else if(c.type==='c'){
     let changes;
     if(c.definition.includes('ANY (ARRAY[')){changes={[c.columns[0]]:'invalid-enum'};}
     else if(table==='checkins'&&c.definition.includes('checked_out_at'))changes={checked_in_at:null,checked_out_at:'2026-11-02T10:00:00Z'};
     else if(table==='events'&&c.definition.includes('capacity'))changes={capacity:0};
     else if(table==='events'&&c.definition.includes('ends_at'))changes={ends_at:'2026-01-01T00:00:00Z'};
     else if(c.definition.includes('media_id'))changes={media_id:'not-a-media-id'};
     else if(c.definition.includes('length(reason)'))changes={reason:''};
     else if(c.definition.includes('length(body)'))changes={body:'x'.repeat(2001)};
     else if(table==='site_catalog'&&c.definition.includes('id = 1'))changes={id:2};
     else if(table==='site_catalog'&&c.definition.includes('revision'))changes={revision:-1};
     else if(c.definition.includes('expected_rows'))changes={expected_rows:0};
     else if(c.definition.includes('batch_index'))changes={batch_index:-1};
     else if(c.definition.includes('points'))changes={points:0};
     else if(c.definition.includes("id = 'instagram'"))changes={id:'other'};
     else if(c.definition.includes('owner_id <> target_id'))changes={target_id:seeds.get(table).owner_id};
     else if(c.definition.includes('invitee_id <> inviter_id'))changes={inviter_id:seeds.get(table).invitee_id};
     else if(c.definition.includes('a < b'))changes={a:'z',b:'a',requested_by:'z'};
     else if(c.definition.includes('requested_by'))changes={requested_by:'not-a-party'};
     else throw Error('Missing CHECK scenario '+c.name+': '+c.definition);
     await assert.rejects(db.query(`UPDATE fixture SET ${Object.keys(changes).map((k,i)=>quote(k)+'=$'+(i+1)).join(',')}`,Object.values(changes)),e=>e.code==='23514'&&e.constraint===c.name,c.name);
    }else if(['p','u'].includes(c.type)){
     const row={...seeds.get(table)};
     if(c.type==='u')for(const key of constraints.find(k=>k.table===table&&k.type==='p').columns)if(!c.columns.includes(key))row[key]=valueFor(schema[table].columns.find(col=>col.name===key).type,'duplicate-'+key);
     const cols=Object.keys(row);
     await assert.rejects(db.query(`INSERT INTO fixture (${cols.map(quote)}) OVERRIDING SYSTEM VALUE VALUES(${cols.map((_,i)=>'$'+(i+1))})`,cols.map(k=>typeof row[k]==='object'&&row[k]!==null&&!(row[k] instanceof Date)?JSON.stringify(row[k]):row[k])),e=>e.code==='23505',c.name);
    }else if(c.type==='f'){
     const changes=Object.fromEntries(c.columns.map(k=>[k,valueFor(schema[table].columns.find(col=>col.name===k).type,'missing-parent')]));
     if(table==='connections'&&c.columns.includes('a'))Object.assign(changes,{a:'0missing',requested_by:'bob'});
     if(table==='connections'&&c.columns.includes('b'))Object.assign(changes,{b:'zmissing',requested_by:'alice'});
     await assert.rejects(db.query(`UPDATE finfolk.${quote(table)} SET ${Object.keys(changes).map((k,i)=>quote(k)+'=$'+(i+1)).join(',')}`,Object.values(changes)),e=>e.code==='23503',c.name);
    }else throw Error('Untested constraint type '+c.type);
   });
   covered.push({table,constraint:c.name,type:c.type,behavior:true});
  }
  await db.query('DROP TABLE fixture');
 }
 // Real FK deletion effects across the social, logbook, trip and provider domains.
 await savepoint(db,async()=>{await db.query(`DELETE FROM finfolk.members WHERE user_id='alice'`);for(const table of ['sessions','checkins','posts','trips','instagram_connections','invitations'])assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk.${quote(table)}`)).rows[0].n,0,table+' cascades');});
 const indexes=(await db.query(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='finfolk'`)).rows;
 const explicit=(await db.query(`SELECT i.relname AS name,pg_get_indexdef(i.oid) AS definition FROM pg_index x JOIN pg_class t ON t.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='finfolk' AND NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conindid=i.oid) ORDER BY i.relname`)).rows;
 assert.deepEqual(explicit,JSON.parse(await readFile('tests/db/indexes.json','utf8')),'index columns, uniqueness and partial predicates');
 for(const required of ['checkins_beach_recent','sessions_owner_beach','trips_owner','trips_public_beach','instagram_commands_recent','instagram_connect_sender'])assert.ok(indexes.some(i=>i.indexname===required),required);
 await db.query('ROLLBACK');
 assert.equal(new Set(covered.map(c=>c.table)).size,Object.keys(schema).length);assert.equal(covered.filter(c=>c.constraint).length,constraints.length);
 await mkdir('.cache/test-results',{recursive:true});await writeFile('.cache/test-results/finfolkdb-coverage.json',JSON.stringify({tables:Object.keys(schema).length,constraints:constraints.length,scenarios:covered},null,2));
 console.log(`FINFOLKDB_SCHEMA_PASS: ${Object.keys(schema).length} tables, ${constraints.length} constraints, defaults, identities, indexes and FK deletion behavior.`);
}finally{await db.end();}
