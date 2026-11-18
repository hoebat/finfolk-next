// Transport only. Operation signatures and payloads come from finfolkdb declarations.
import {deliverEventInvitation} from './event-delivery.mjs';
import {runDirectorySearch} from './directory-discovery.mjs';
import {verifiedIdentity} from '../js/finfolk-next/packages/edge/supabase-auth.js';
import {operations,validate} from '../js/finfolk-next/packages/edge/native-account-contracts.js';
import {verifyDeletionPassword,finishAccountDeletion} from './native-account-deletion.mjs';
import {createNativeRPC} from './native-rpc.mjs';
async function readInput(request){
 const reader=request.body?.getReader();if(!reader)throw Object.assign(Error('Request body required'),{status:400});
 const decoder=new TextDecoder();let size=0,text='';
 try {for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>98304){await reader.cancel();throw Object.assign(Error('Request too large'),{status:413});}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
 finally {reader.releaseLock();}
 try{return JSON.parse(text);}catch{throw Object.assign(Error('Invalid request'),{status:400});}
}
export function createNativeAccount({query, transaction, supabaseUrl, publishableKey, serviceRoleKey, adminFetch, directorySearch, eventDelivery, deliveryKey, invitationOrigin}) {
 if(typeof transaction!=='function')throw Error('Native accounts require a transaction-capable database');
 return async request=>{
  let requestSpec;
  try {
   if(!['GET','POST'].includes(request.method))return Response.json({error:'Method not allowed'},{status:405});
   const input=request.method==='GET'?{operation:'me',values:{}}:await readInput(request);
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['operation','values'].includes(k))||!Object.hasOwn(operations,input.operation))
    throw Object.assign(Error('Unknown account operation'),{status:400});
   const spec=operations[input.operation];requestSpec=spec;const values=input.values??{};
   // Public entrypoints are always anonymous, including when a bearer is sent.
   const identity=spec.public?null:await verifiedIdentity({supabaseUrl,publishableKey},request.headers.get('Authorization'));
   try{validate(spec.request,values);}catch(error){throw Object.assign(error,{status:400});}
   const args=spec.arguments.map(key=>key==='$values'?values:key==='$actor'?(identity?.id??null):key==='$verified'?(identity?.verified??false):key==='$email'?(identity?.email??null):key==='$true'?true:key==='$false'?false:values[key]);
   const sending=(spec.effect==='event-invitation'&&values.send===true)||spec.effect==='event-invitation-retry';
   if(sending&&(!deliveryKey||deliveryKey.length<32))throw Object.assign(Error('Email delivery is not configured'),{status:503});
   if(spec.effect==='delete-auth-user'){
    if(!serviceRoleKey)throw Object.assign(Error('Auth account cleanup is not configured'),{status:503});
    await verifyDeletionPassword({supabaseUrl,publishableKey},identity,values.password);
   }
   let result=await transaction(async query=>{
    const call=createNativeRPC(query);
    // Provisioning holds the actor lock until this operation commits.
    if(identity&&spec.effect!=='delete-auth-user')await call('sync_account_identity',[identity.id,identity.verified]);
    const value=await call(spec.rpc,args);
    if(spec.effect==='event-invitation'&&sending&&value.token)await call('event_delivery_enqueue',[identity.id,values.id,value.id,value.token,deliveryKey]);
    return value;
   });
   if(sending)result={...result,delivery:await deliverEventInvitation({transaction,actor:identity.id,event:values.id,invite:result.id,key:deliveryKey,provider:eventDelivery,origin:invitationOrigin,signal:request.signal})};
   if(spec.effect==='directory-discovery'){
    let candidates=[],state='complete';
    try{candidates=await runDirectorySearch(directorySearch,values,request.signal);}catch{state='failed';}
    result=await transaction(async query=>{
     const call=createNativeRPC(query);await call('sync_account_identity',[identity.id,identity.verified]);
     return call(spec.completion_rpc,[identity.id,identity.verified,{id:result.id,state,candidates}]);
    });
   }
   if(spec.effect==='delete-auth-user'){
    try{await finishAccountDeletion({query,supabaseUrl,serviceRoleKey,adminFetch},identity.id);}
    catch{await createNativeRPC(query)('record_account_deletion_failure',[identity.id]).catch(()=>{});return Response.json({error:'Your FinFolk data was removed; sign-in cleanup is pending.',code:'account_deletion_pending',dataDeleted:true},{status:503,headers:{'Cache-Control':'no-store'}});}
   }
   if(input.operation==='me')result={...result,verified:identity.verified};
   validate(spec.result,result,'result');
   return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
   const status=[400,401,413].includes(error.status)?error.status:
    ['40001','23505'].includes(error.code)?409:
    ['22003','22023','22007','22008','22P02','23503'].includes(error.code)?400:error.code==='P0002'?404:
    ['P0001','42501'].includes(error.code)?403:503;
   const message=status===400?'Invalid account request.':status===401?'Sign in first.':status===413?'Request too large.':status===404?(requestSpec?.not_found||'Profile unavailable.'):status===403?'Account operation unavailable.':status===409?'Record changed. Reload before saving.':'Account service unavailable.';
   return Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
  }
 };
}

export async function nativeAccountSites(query){
 try{return Response.json(await createNativeRPC(query)('ret_account_sites',[]),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Dive sites unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
