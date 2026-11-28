import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAccount} from '../backend/native-account.mjs';

const actor='11111111-1111-4111-8111-111111111111';
test('publication errors explain known blockers without exposing other database errors',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({id:actor,email_confirmed_at:'2026-11-28T00:00:00Z'}));
 const cases=[
  ['42501','Verify your email before publishing','Verify your email in Account before publishing.'],
  ['P0001','Finish the session before publishing','Finish the session before publishing.'],
  ['42501','permission denied for private_table','Account operation unavailable.'],
 ];
 for(const [code,message,expected] of cases){
  const query=async sql=>{if(sql.includes('"set_session_visibility"'))throw Object.assign(Error(message),{code});return [{value:{}}];};
  const handler=createNativeAccount({query,transaction:fn=>fn(query),supabaseUrl:'https://auth.invalid',publishableKey:'fixture'});
  const response=await handler(new Request('https://local.test/account',{method:'POST',headers:{Authorization:'Bearer fixture'},body:JSON.stringify({operation:'visibility',values:{id:actor,visibility:'public'}})}));
  assert.equal(response.status,403);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.deepEqual(await response.json(),{error:expected});
 }
});
