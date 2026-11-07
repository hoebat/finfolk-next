import {seal,unseal,encryptionKey} from './messaging-config.mjs';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const methods=new Set(['instagram-login','instagram-facebook','instagram-unified','tiktok-business']);
const validToken=value=>typeof value==='string'&&value.length>0;
const binding=(application,account)=>JSON.stringify(['messaging-credential',1,application,account.id,account.provider,account.account_id,account.checks?.appId??null]);
export class MessagingAuthorizationChanged extends Error {}

// Private trusted-server interface. None of these methods are browser RPCs.
export function createMessagingAuthorizationStore({db,application,account,encryptionEnv,now=()=>Date.now()}){
 if(!db?.query||typeof application!=='string'||!application||typeof account!=='string'||!account)
  throw Error('A scoped messaging database is required.');
 async function call(name,args=[]){
  const values=[application,account,...args];
  const output=await db.query(`SELECT finfolk_rpc.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) AS value`,values);
  return (Array.isArray(output)?output:output.rows)[0].value;
 }
 const read=()=>call('ret_messaging_account');
 function decode(row,{allowExpired=false}={}){
  if(!row.credential_ciphertext)throw Error('Messaging authorization is missing.');
  if(!allowExpired&&row.token_expires_at&&Date.parse(row.token_expires_at)<=now())throw Error('Messaging authorization has expired.');
  const value=unseal(row.credential_ciphertext,encryptionEnv,binding(application,row));
  if(!object(value)||value.version!==1||!object(value.credential)||!validToken(value.credential.token)||
     !methods.has(value.credential.authMethod)||value.expiresAt!==(row.token_expires_at?new Date(row.token_expires_at).toISOString():null))
   throw Error('Messaging authorization does not match its connection.');
  const expected=row.provider==='tiktok'?'tiktok-business':'instagram-';
  if(row.provider==='tiktok'?value.credential.authMethod!==expected:!value.credential.authMethod.startsWith(expected))
   throw Error('Messaging credential provider mismatch.');
  return value.credential;
 }
 function prepare(credential,expiresAt){
  if(!object(credential)||!validToken(credential.token)||!methods.has(credential.authMethod)||
     !(credential.refreshToken==null||validToken(credential.refreshToken)))throw Error('Invalid messaging credential.');
  const expires=expiresAt==null?null:new Date(expiresAt).toISOString();
  if(expires&&Date.parse(expires)<=now())throw Error('Messaging authorization has expired.');
  return {credential:{token:credential.token,authMethod:credential.authMethod,
   ...(credential.refreshToken?{refreshToken:credential.refreshToken}:{}),
   ...(credential.refreshExpiresAt?{refreshExpiresAt:new Date(credential.refreshExpiresAt).toISOString()}:{}),
   ...(credential.issuedAt?{issuedAt:new Date(credential.issuedAt).toISOString()}:{})},expiresAt:expires};
 }
 async function verifyProof(row,prepared,verify){
  if(!['instagram','tiktok'].includes(row.provider))throw Error('App chat does not use provider credentials.');
  if(typeof verify!=='function')throw Error('A trusted provider authorization verifier is required.');
  const proof=await verify({...prepared.credential},{application,account:row.id,provider:row.provider,accountId:row.account_id});
  if(proof?.expiresAt){
   const verifiedExpiry=new Date(proof.expiresAt).toISOString();
   if(Date.parse(verifiedExpiry)<=now())throw Error('Provider authorization has expired.');
   if(!prepared.expiresAt||Date.parse(verifiedExpiry)<Date.parse(prepared.expiresAt))prepared.expiresAt=verifiedExpiry;
  }
  if(!object(proof)||proof.authorized!==true||proof.subscribed!==true||proof.provider!==row.provider||proof.accountId!==row.account_id||
     !prepared.expiresAt&&proof.nonExpiring!==true)throw Error('Provider authorization and subscription were not verified.');
  if(row.provider==='tiktok'?prepared.credential.authMethod!=='tiktok-business':!prepared.credential.authMethod.startsWith('instagram-'))
   throw Error('Messaging credential provider mismatch.');
  return {provider:row.provider,accountId:row.account_id,authorized:true,subscribed:true,
   nonExpiring:proof.nonExpiring===true,...(typeof proof.appId==='string'?{appId:proof.appId}:{}),authMethod:prepared.credential.authMethod,
   ...(typeof proof.username==='string'?{username:proof.username}:{}),verifiedAt:new Date(now()).toISOString()};
 }
 const encrypt=(row,value,proof)=>seal({version:1,...value},encryptionEnv,binding(application,{...row,checks:proof}));
 return {
  async connection(){
   const row=await read();
   return {application,account:row.id,provider:row.provider,accountId:row.account_id,generation:row.generation,mode:row.mode,
    expiresAt:row.token_expires_at,refreshInProgress:Boolean(row.credential_lease_until&&Date.parse(row.credential_lease_until)>now()),checks:{authorized:row.checks?.authorized===true,subscribed:row.checks?.subscribed===true,
     nonExpiring:row.checks?.nonExpiring===true,...(typeof row.checks?.appId==='string'?{appId:row.checks.appId}:{}),authMethod:methods.has(row.checks?.authMethod)?row.checks.authMethod:null,
     ...(typeof row.checks?.username==='string'?{username:row.checks.username}:{})}};
  },
  async accessToken({authMethod,appId,generation}={}){
   const row=await read();
   if(generation!==undefined&&row.generation!==generation)
    throw Object.assign(new MessagingAuthorizationChanged('Messaging account generation changed.'),{code:'messaging_generation_changed',definiteRejection:true,retryAfter:1});
   if(row.credential_lease_until&&Date.parse(row.credential_lease_until)>now())
    throw Object.assign(Error('Messaging token refresh is in progress.'),{code:'messaging_refresh_busy',definiteRejection:true,retryAfter:2});
   const credential=decode(row);
   if(appId&&row.checks?.appId!==appId)throw Error('Messaging authorization app changed.');
   if(authMethod&&credential.authMethod!==authMethod)throw Error('Messaging authorization method changed.');
   return credential.token;
  },
  async install({credential,expiresAt,verify,expectedGeneration}){
   const row=await read();
   if(expectedGeneration!==undefined&&expectedGeneration!==row.generation)throw new MessagingAuthorizationChanged('Messaging account changed.');
   encryptionKey(encryptionEnv); // Fail before provider calls if encrypted storage is unavailable.
   const prepared=prepare(credential,expiresAt),proof=await verifyProof(row,prepared,verify);
   const saved=await call('set_messaging_authorization',[row.generation,encrypt(row,prepared,proof),prepared.expiresAt,JSON.stringify(proof)]);
   if(!saved)throw new MessagingAuthorizationChanged('Messaging account changed during verification.');
   return saved;
  },
  async activate({generation,mode='pilot',senders=[]}){
   if(!['pilot','live'].includes(mode)||!Array.isArray(senders)||!senders.every(id=>typeof id==='string'&&id.length>0&&id.length<=500))throw Error('Invalid messaging activation.');
   const row=await read();if(row.provider!=='app')decode(row);
   const value=await call('activate_messaging_account',[generation,mode,JSON.stringify(senders)]);
   if(!value)throw new MessagingAuthorizationChanged('Messaging account changed.');
   return value;
  },
  async pause({generation}){
   const value=await call('disable_messaging_account',[generation,false]);
   if(!value)throw new MessagingAuthorizationChanged('Messaging account changed.');
   return value;
  },
  async disconnect({generation,revoke}={}){
   const row=await read();
   if(generation!==row.generation)throw new MessagingAuthorizationChanged('Messaging account changed.');
   const credential=revoke&&row.credential_ciphertext?decode(row,{allowExpired:true}):null;
   const value=await call('disable_messaging_account',[generation,true]);
   if(!value)throw new MessagingAuthorizationChanged('Messaging account changed.');
   let remoteRevoked=null;
   if(credential){try{await revoke(credential);remoteRevoked=true;}catch{remoteRevoked=false;}}
   return {...value,remoteRevoked};
  },
  async refresh({exchange,verify}){
   if(typeof exchange!=='function')throw Error('A trusted token refresher is required.');
   const row=await read(),claim=await call('claim_messaging_refresh',[row.generation]);
   if(!claim)return {status:'busy'};
   const lease=claim.credential_lease;
   try{
    const previous=decode(claim,{allowExpired:true});
    if(previous.refreshExpiresAt&&Date.parse(previous.refreshExpiresAt)<=now())throw Error('Messaging refresh authorization has expired.');
    const previousMethod=previous.authMethod;
    const updated=await exchange({...previous});
    const prepared=prepare(updated.credential,updated.expiresAt);
    if(prepared.credential.authMethod!==previousMethod)throw Error('Refresh cannot change the authorization method.');
    const proof=await verifyProof(claim,prepared,verify);
    if((claim.checks?.appId??null)!==(proof.appId??null))throw new MessagingAuthorizationChanged('Refresh cannot change the provider app.');
    const saved=await call('save_messaging_refresh',[claim.generation,lease,encrypt(claim,prepared,proof),prepared.expiresAt,JSON.stringify(proof)]);
    if(!saved)throw new MessagingAuthorizationChanged('Messaging account changed during refresh.');
    return {status:'refreshed',...saved};
   }finally{try{await call('release_messaging_refresh',[claim.generation,lease]);}catch{/* Expiring claims recover if release is unavailable. */}}
  },
 };
}
