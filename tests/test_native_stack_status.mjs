import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inventory,summarizePublicConfiguration} from '../scripts/native_stack_status.mjs';

test('separates immutable migrations from live scaffolding and never reports secret values',async()=>{
 const root=await mkdtemp(join(tmpdir(),'finfolk-native-audit-'));
 try{
  const files={'backend/migrations/old.sql':'CREATE SCHEMA legacy_auth;','backend/runtime.mjs':"import {client} from '@legacy/driver';",'backend/.env':'LEGACY_SECRET=private-fixture','backend/config.json':'{"LEGACY_AUTH_BASE_URL":"private-fixture"}','scripts/a.mjs':'fetch("/legacy-account-config.json")','package.json':'{"dependencies":{"@legacy/auth":"0.6.0-beta"}}'};
  for(const [file,body]of Object.entries(files)){await mkdir(join(root,file,'..'),{recursive:true});await writeFile(join(root,file),body);}
  const report=await inventory(root);assert(report.references.some(r=>r.file==='backend/runtime.mjs'&&r.signals.includes('sdk')));
  assert(report.references.some(r=>r.file==='backend/migrations/old.sql'&&r.category==='immutable-history'));
  assert(report.references.some(r=>r.file==='backend/config.json'));assert(!report.references.some(r=>r.file.endsWith('.env')));
  assert.deepEqual(report.dependencies,[{name:'@legacy/auth',scope:'dependencies'}]);assert(!JSON.stringify(report).includes('private-fixture'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('detects a frontend using a retired provider and rejects mixed-provider configuration',()=>{
 const response={status:200,ok:true,redirected:true};
 assert.equal(summarizePublicConfiguration(response,{enabled:true,authUrl:'https://auth.example.test'}).native,false);
 assert.equal(summarizePublicConfiguration(response,{enabled:true,authProvider:'supabase',supabaseUrl:'https://supabase.finfolk.com.au'}).native,true);
 assert.equal(summarizePublicConfiguration(response,{enabled:true,authProvider:'supabase',supabaseUrl:'https://supabase.finfolk.com.au',authUrl:'https://auth.example.test'}).native,false);
});
