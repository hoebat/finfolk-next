import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {nativeSQLFixture} from './fixtures/native-sql.mjs';
import {socialIdentity} from '../backend/directory.mjs';
assert.equal(socialIdentity('https://www.instagram.com/School.AU/?utm=x'),'instagram:school.au');
assert.equal(socialIdentity('https://instagram.com/p/abc'),null);assert.equal(socialIdentity('https://evil.com/@school'),null);
const {db,query,rpc}=await nativeSQLFixture(),owner=randomUUID(),other=randomUUID();
const call=(name,actor,values={})=>rpc('native_directory_'+name,[actor,true,values]);
const document={name:'Native group',category:'Group',state:'VIC',country:'Australia',locality:'Melbourne',description:'Generated SQL fixture',website:'https://example.test',image:'',sources:['https://example.test/'],socials:[]};
try{
 for(const actor of [owner,other])await rpc('sync_account_identity',[actor,true]);
 assert.deepEqual(await call('public_list',null),{listings:[],next:null});
 const requestId=randomUUID(),created=await call('owner_create',owner,{requestId,document});
 assert.equal(created.status,'candidate');assert.deepEqual(await call('owner_create',owner,{requestId,document}),created);
 await assert.rejects(call('owner_create',other,{requestId,document}),error=>error.code==='23505'||error.code==='40001');
 await assert.rejects(call('owner_save',other,{id:created.id,revision:1,document}),error=>error.code==='42501');
 await assert.rejects(call('admin',owner),error=>error.code==='42501');
 await query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,$2)',[owner,'admin']);
 await call('admin_save',owner,{id:created.id,revision:1,document,status:'published',notes:'Private moderation detail'});
 const row=await call('public_detail',null,{id:created.id});assert.equal(row.name,document.name);assert.equal(row.managed,true);
 assert(!JSON.stringify(row).includes('Private moderation detail'));assert.equal(Object.hasOwn(row,'owner_id'),false);
 await assert.rejects(call('owner_save',owner,{id:created.id,revision:1,document}),error=>error.code==='40001'||error.code==='23505');
 await call('report',other,{id:created.id,message:'Please correct the location.'});
 assert.equal((await call('admin',owner)).reports.length,1);
 await call('admin_save',owner,{id:created.id,revision:2,document,status:'archived',notes:''});
 assert.deepEqual(await call('public_list',null),{listings:[],next:null});
 console.log('DIRECTORY_NATIVE_SQL_PASS: generated publication, UUID identities, idempotency, owner/admin permissions, stale revisions, public privacy, reports and archival.');
}finally{await db.close();}
