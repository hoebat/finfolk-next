import {createHash} from 'node:crypto';
export function fixtureUUID(kind,key){
 const value=String(key);if(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))return value;
 const h=createHash('sha256').update('finfolk:test:'+kind+':'+value).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
export const applicationId=key=>fixtureUUID('messaging-application',key);
export const accountId=key=>fixtureUUID('messaging-account',key);
export const userId=key=>fixtureUUID('user',key);
export async function seedMessaging(db,applications,accounts){
 for(const key of applications)await db.query('INSERT INTO finfolk."MessagingApplication"(id,key,name) VALUES($1,$2,$3)',[applicationId(key),key,key]);
 for(const [key,application,provider,external,mode='disabled',credential=null]of accounts)
  await db.query('INSERT INTO finfolk."MessagingAccount"(id,key,application_id,provider,account_id,mode,credential_ciphertext) VALUES($1,$2,$3,$4,$5,$6,$7)',[accountId(key),key,applicationId(application),provider,external,mode,credential]);
}
