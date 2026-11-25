// External Auth effects only. The native database owns erasure and retry state.
import {createNativeRPC} from './native-rpc.mjs';
export async function verifyDeletionPassword({supabaseUrl,publishableKey},identity,password){
 if(typeof password!=='string'||password.length<1||password.length>1024||!identity.email)throw Object.assign(Error('Reauthenticate first'),{status:401});
 const response=await fetch(new URL('/auth/v1/token?grant_type=password',supabaseUrl),{method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:identity.email,password}),signal:AbortSignal.timeout(10000),redirect:'manual'});
 if(!response.ok)throw Object.assign(Error('Reauthenticate first'),{status:response.status>=500?503:401});
 const data=await response.json();
 try{if(data.user?.id!==identity.id)throw Object.assign(Error('Identity changed'),{status:401});}
 finally{if(data.access_token)await fetch(new URL('/auth/v1/logout?scope=local',supabaseUrl),{method:'POST',headers:{apikey:publishableKey,Authorization:'Bearer '+data.access_token},signal:AbortSignal.timeout(10000),redirect:'manual'});}
}
export async function finishAccountDeletion({query,supabaseUrl,serviceRoleKey,adminFetch=fetch},id){
 if(!serviceRoleKey)throw Error('Auth administrator credentials required');
 const response=await adminFetch(new URL('/auth/v1/admin/users/'+encodeURIComponent(id),supabaseUrl),{method:'DELETE',headers:{apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey},signal:AbortSignal.timeout(10000),redirect:'manual'});
 if(!response.ok&&response.status!==404)throw Error('Auth account cleanup failed');
 return createNativeRPC(query)('complete_account_deletion',[id]);
}
export async function reconcileAccountDeletions(config){
 if(!config.serviceRoleKey)return {completed:0,pending:0};
 const rows=await createNativeRPC(config.query)('pending_account_deletions',[]);let completed=0,pending=0;
 for(const row of rows){try{await finishAccountDeletion(config,row.id);completed++;}catch{pending++;await createNativeRPC(config.query)('record_account_deletion_failure',[row.id]).catch(()=>{});}}
 return {completed,pending};
}
