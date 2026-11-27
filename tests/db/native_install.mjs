import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {connect} from './harness.mjs';
import {createNativeRPC} from '../../backend/native-rpc.mjs';
const db=await connect(),actor=randomUUID(),schema=await readFile('resources/finfolkdb/entity-schema.sql','utf8');
const catalog=JSON.parse(await readFile('resources/finfolkdb/entity-catalog.json','utf8'));
try{
 await db.query(schema);await db.query(await readFile('resources/finfolkdb/account-grants.sql','utf8'));
 const rpc=createNativeRPC((sql,values)=>db.query(sql,values));
 await rpc('sync_account_identity',[actor,true]);await rpc('save_account_preferences',[actor,{displayName:'Fresh native install'},true]);
 const tables=(await db.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='finfolk' AND c.relkind IN ('r','p')")).rows[0].n;
 const conversationTables=['BuddyConversation','BuddyMembership','BuddyMessage','BuddyRead'];
 assert.equal(tables,Object.keys(catalog).length+conversationTables.length,'Installed tables include generated entities and private conversation storage');
 for(const table of conversationTables)assert.equal((await db.query('SELECT to_regclass($1) IS NOT NULL AS present',['finfolk."'+table+'"'])).rows[0].present,true,'Conversation table exists: '+table);
 assert.equal((await db.query("SELECT has_table_privilege('finfolk_account','finfolk.\"UserRole\"','UPDATE') AS allowed")).rows[0].allowed,false);
 await assert.rejects(db.query(schema),/Fresh entity schema requires empty application schemas/);await db.query('ROLLBACK');
 assert.equal((await rpc('ret_account',[actor])).profile.displayName,'Fresh native install','A refused reinstall preserves existing data');
 console.log('NATIVE_INSTALL_PASS: generated SQL installs without historical snapshots; catalog, UUID RPCs, restricted grants and nonempty-database guards verified.');
}finally{await db.end();}
