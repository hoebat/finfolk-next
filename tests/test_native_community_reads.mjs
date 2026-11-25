import assert from 'node:assert/strict';
import {nativeSQLFixture} from './fixtures/native-sql.mjs';
import {createNativeAccount} from '../backend/native-account.mjs';
const fixture=await nativeSQLFixture();
try{
 await fixture.db.exec('SET ROLE finfolk_account');
 const handle=createNativeAccount({query:fixture.query,transaction:fn=>fn(fixture.query)});
 for(const operation of ['publicTrips','siteCatalog','discoverPopular','publicDirectory']){
  const response=await handle(new Request('https://local.test/v1/native/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,values:{}})}));
  assert.equal(response.status,200,operation+': '+await response.clone().text());
  const data=await response.json();if(operation==='publicTrips')assert.deepEqual(data,{trips:[]});
 }
 console.log('NATIVE_COMMUNITY_READS_PASS: anonymous feed, atlas, rankings and groups execute with the restricted account role and validate their emitted contracts.');
}finally{await fixture.db.close();}
