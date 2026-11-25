// Archived integration scenarios may only run against a disposable local database.
import {localAdminURL} from './local_supabase.mjs';
export function legacyTestDatabaseURL(value=process.env.FINFOLK_TEST_DATABASE_URL){
 const url=localAdminURL(value);
 if(!/^\/finfolk_test_[a-z0-9_]+$/.test(url.pathname))throw Error('A disposable finfolk_test_* database is required.');
 return url.href;
}
export function legacyTestRuntimeURL(){
 const owner=new URL(legacyTestDatabaseURL());
 const runtime=new URL(legacyTestDatabaseURL(process.env.FINFOLK_TEST_RUNTIME_DATABASE_URL));
 if(runtime.host!==owner.host||runtime.pathname!==owner.pathname||runtime.username!=='finfolk_api')throw Error('Runtime fixture must use finfolk_api on the same disposable database.');
 return runtime.href;
}
