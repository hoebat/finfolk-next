import {ids} from './fixtures/ids.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {connect} from './harness.mjs';
const db=await connect();
try{
 const sql=await readFile('resources/finfolkdb/entity-schema.sql','utf8'),catalog=JSON.parse(await readFile('resources/finfolkdb/entity-catalog.json','utf8'));
 assert.ok(!/DROP TABLE/i.test(sql),'A fresh schema must never drop application tables');
 await db.query(sql);
 const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='finfolk' ORDER BY tablename")).rows.map(row=>row.tablename);
 assert.deepEqual(tables,Object.keys(catalog).sort());
 assert.equal(catalog.User.entity.class,'0d/entry');assert.equal(catalog.Activity.entity.class,'1d/base');assert.equal(catalog.Rev.entity.class,'2d/base');
 assert.ok(catalog.User.columns.some(column=>column.name==='audit'&&column.reference.table==='Audit'));
 assert.ok(catalog.User.columns.some(column=>column.name==='activity'&&column.reference.table==='Activity'));
 assert.equal(catalog.UserCheckin.columns.find(column=>column.name==='user').reference.table,'User');
 for(const [name,spec]of Object.entries(catalog)){
  const columns=(await db.query(`SELECT a.attname AS name,a.attnotnull AS required FROM pg_attribute a JOIN pg_class t ON t.oid=a.attrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='finfolk' AND t.relname=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,[name])).rows;
  assert.deepEqual(columns,spec.columns.map(column=>({name:column['sql-name'],required:column.required})),name+' must match hydrated entity fields');
 }
 for(const id of [ids.alice,ids.bob,ids.carol]){
  const op=(await db.query(`SELECT finfolk.op_fn('create-user',$1,'{}') AS op`,[id])).rows[0].op;
  const user=(await db.query(`SELECT finfolk_rpc.insert_user($1,'{}',$2::jsonb) AS value`,[id,JSON.stringify(op)])).rows[0].value;
  assert.equal(user.id,id);assert.ok(user.rev_id);assert.ok(user.audit_id);assert.ok(user.activity_id);
 }
 await db.query(`INSERT INTO finfolk."Site"(id,name,timezone) VALUES('${ids.bondi}','Bondi','Australia/Sydney');`);
 await db.query(`INSERT INTO finfolk."UserBlock"(owner_id,target_id) VALUES('${ids.alice}','${ids.bob}'); INSERT INTO finfolk."UserCheckin"(user_id,site_id,visit_day) VALUES('${ids.alice}','${ids.bondi}','2026-11-04'); INSERT INTO finfolk."UserConnection"(user_id,target_id,requested_by_id,status) VALUES('${ids.alice}','${ids.bob}','${ids.alice}','pending');`);
 await assert.rejects(db.query(`INSERT INTO finfolk."UserBlock"(owner_id,target_id) VALUES('${ids.alice}','${ids.missing}')`),error=>error.code==='23503');
 await assert.rejects(db.query(`INSERT INTO finfolk."UserCheckin"(user_id,site_id,visit_day) VALUES('${ids.alice}','${ids.missing}','2026-11-04')`),error=>error.code==='23503');
 await assert.rejects(db.query(`UPDATE finfolk."UserConnection" SET status='${ids.invalid}'`),error=>error.code==='22P02');
 await assert.rejects(db.query(`INSERT INTO finfolk."UserBlock"(owner_id,target_id) VALUES('${ids.alice}','${ids.alice}')`),error=>error.code==='23514');
 await assert.rejects(db.query(`INSERT INTO finfolk."UserConnection"(user_id,target_id,requested_by_id,status) VALUES('${ids.bob}','${ids.alice}','${ids.bob}','pending')`),error=>error.code==='23514');
 await assert.rejects(db.query(`INSERT INTO finfolk."UserConnection"(user_id,target_id,requested_by_id,status) VALUES('${ids.bob}','${ids.carol}','${ids.alice}','pending')`),error=>error.code==='23514');
 await assert.rejects(db.query(`UPDATE finfolk."UserCheckin" SET checked_in_at=2000000,checked_out_at=1000000`),error=>error.code==='23514');
 const alice=(await db.query(`SELECT * FROM finfolk."User" WHERE id='${ids.alice}'`)).rows[0];
 const rev=(await db.query(`SELECT finfolk.ret_rev_default('User','Global','${ids.alice}') AS value`)).rows[0].value;assert.equal(rev.id,alice.rev_id);
 assert.equal((await db.query(`SELECT finfolk.ret_rev_default('User','Event','${ids.alice}') AS value`)).rows[0].value,null);
 const foreignRev=randomUUID();await db.query(`INSERT INTO finfolk."Rev"(id,class_table,class_context,class_ref) VALUES($1,'Event','Global','${ids.foreign}')`,[foreignRev]);
 await assert.rejects(db.query(`UPDATE finfolk."User" SET rev_id=$1 WHERE id='${ids.bob}'`,[foreignRev]),error=>error.code==='23503');
 const foreignAudit=randomUUID();await db.query(`INSERT INTO finfolk."Audit"(id,class_table,class_context,class_ref) VALUES($1,'User','Event','${ids.foreign}')`,[foreignAudit]);
 await assert.rejects(db.query(`INSERT INTO finfolk."AuditLog"(class_table,class_context,audit_id,op_created) VALUES('User','Global',$1,$2)`,[foreignAudit,randomUUID()]),error=>error.code==='23503');
 await assert.rejects(db.query(`INSERT INTO finfolk."ActivityLog"(class_table,activity_id,action,actor_id) VALUES('Trip',$1,'create','${ids.alice}')`,[alice.activity_id]),error=>error.code==='23503');
 await db.query(`INSERT INTO finfolk."RevLog"(class_table,class_context,rev_id,version,deltas) VALUES('User','Global',$1,1,'{"displayName":"Alice"}')`,[alice.rev_id]);
 await assert.rejects(db.query(`INSERT INTO finfolk."RevLog"(class_table,class_context,rev_id,version) VALUES('User','Global',$1,1)`,[alice.rev_id]),error=>error.code==='23505');
 await assert.rejects(db.query(`INSERT INTO finfolk."RevLog"(class_table,class_context,rev_id,version) VALUES('User','Event',$1,2)`,[alice.rev_id]),error=>error.code==='23503');
 await db.query('BEGIN');
 const rollbackOp=(await db.query(`SELECT finfolk.op_fn('create-user','${ids.rollback}','{}') AS value`)).rows[0].value;
 await db.query(`SELECT finfolk_rpc.insert_user('${ids.rollback}','{}',$1::jsonb)`,[JSON.stringify(rollbackOp)]);await db.query('ROLLBACK');
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk."User" WHERE id='${ids.rollback}'`)).rows[0].n,0);
 for(const name of ['Rev','Audit','Activity'])assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk."${name}" WHERE class_ref='${ids.rollback}'`)).rows[0].n,0,name+' must roll back with user creation');
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk."Op" WHERE id=$1`,[rollbackOp.id])).rows[0].n,0);
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk."ActivityLog" WHERE actor_id='${ids.alice}' AND action='create'`)).rows[0].n,1);
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk."AuditLog" WHERE audit_id=$1`,[alice.audit_id])).rows[0].n,1);
 await assert.rejects(db.query(`SELECT finfolk_rpc.insert_user('${ids.invalid}','[]','{}')`),/Expected a JSON object/);
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk."Rev" WHERE class_ref='${ids.invalid}'`)).rows[0].n,0);
 assert.deepEqual((await db.query(`SELECT finfolk.as_jsonb(NULL) AS object,finfolk.as_jsonb_array(NULL) AS array`)).rows[0],{object:{},array:[]});
 await assert.rejects(db.query(`SELECT finfolk.as_jsonb_array('{}')`),/Expected a JSON array/);
 await db.query('BEGIN');await db.query(`SELECT set_config('finfolk.actor_id','${ids.alice}',true)`);assert.equal((await db.query('SELECT finfolk.auth_uid() AS id')).rows[0].id,ids.alice);await db.query('ROLLBACK');assert.equal((await db.query('SELECT finfolk.auth_uid() AS id')).rows[0].id,null);
 const privateFns=(await db.query(`SELECT has_function_privilege('finfolk_api','finfolk_rpc.insert_user(uuid,jsonb,jsonb)','EXECUTE') AS can_create,has_function_privilege('finfolk_api','finfolk.ret_rev_default(text,text,uuid)','EXECUTE') AS can_read`)).rows[0];assert.deepEqual(privateFns,{can_create:false,can_read:false});
 await assert.rejects(db.query(sql),/requires empty application schemas/);await db.query('ROLLBACK');assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."User"')).rows[0].n,3);
 // Remove the actor-owned log explicitly before physical fixture deletion. Real
 // account removal is a soft delete; historical audit entries retain their actor.
 await db.query(`DELETE FROM finfolk."ActivityLog" WHERE actor_id='${ids.alice}'; DELETE FROM finfolk."User" WHERE id='${ids.alice}'`);
 for(const table of ['UserBlock','UserCheckin','UserConnection'])assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk."${table}"`)).rows[0].n,0,table+' must cascade');
 console.log('FRESH_ENTITIES_PASS: hydrated catalog matches live columns; linked entities, scoped 1D/2D addons, atomic user/audit/activity creation, enum and business checks, context isolation, actor rollback, private helpers and non-destructive fresh install.');
}finally{await db.end();}
