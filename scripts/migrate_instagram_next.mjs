// Operator-only handover. Input and snapshots contain secrets: keep them in
// ignored storage with mode 0600. No tokens, codes or message bodies are logged.
import {readFile,writeFile} from 'node:fs/promises';
import {database} from '../backend/db.mjs';
import {messagingConfig,seal} from '../backend/messaging-config.mjs';
import {InstagramProvider} from '../backend/instagram-provider.mjs';
const [action,inputPath]=process.argv.slice(2);
if(!['inspect','stage','pause-legacy','activate','rollback'].includes(action) || !inputPath)throw Error('Use inspect|stage|pause-legacy|activate|rollback with a private input file.');
const input=JSON.parse(await readFile(inputPath,'utf8'));
const oldURL=new URL(input.legacyDatabase),nextURL=new URL(input.nextDatabase);
if(!oldURL.hostname.startsWith('ep-crimson-queen-') || !nextURL.hostname.startsWith('ep-spring-recipe-') || nextURL.pathname!=='/finfolk_next')throw Error('Unexpected migration database.');
const old=database(input.legacyDatabase),next=database(input.nextDatabase);
try {
 const release=(await next.query('SELECT sql_sha,current_database() AS database FROM finfolk.backbone_release WHERE id=1'))[0];
 if(release?.sql_sha!==input.nextEnv.DB_SQL_SHA || release.database!=='finfolk_next')throw Error('Next release is not ready.');
 const legacy=await messagingConfig(old.query,input.legacyEnv,{credentials:true});
 const provider=new InstagramProvider(legacy);
 const account=await provider.validate();
 const subscribed=await provider.subscriptions();
 if(account.id!==legacy.accountId || !subscribed || legacy.provider!=='instagram-facebook')throw Error('Meta binding/subscription verification failed.');
 const pending=(await old.query("SELECT count(*)::integer AS count FROM finfolk.messaging_outbox WHERE state IN ('pending','sending','uncertain')"))[0].count;
 if(action==='inspect')console.log(JSON.stringify({brandVerified:true,subscriptionVerified:subscribed,legacyMode:legacy.mode,pilotCount:legacy.pilot_sender_ids.length,pending}));
 if(action==='stage'){
  if(!input.snapshot){input.snapshot=(await old.query("SELECT * FROM finfolk.messaging_accounts WHERE id='instagram'"))[0];await writeFile(inputPath,JSON.stringify(input),{mode:0o600});}
  const current=(await next.query("SELECT * FROM finfolk.messaging_accounts WHERE id='instagram'"))[0];
  if(current.mode!=='disabled')throw Error('Pause Next before staging authorization.');
  for(const sender of legacy.pilot_sender_ids)await provider.profile(sender);
  const scope=legacy.scope;
  await next.query(`UPDATE finfolk.messaging_accounts SET account_id=$1,username='finfolk.com.au',credential_ciphertext=$2,token_expires_at=$3,
   mode='disabled',enabled_commands=$4::jsonb,pilot_sender_ids=$5::jsonb,provider_scope=$6,generation=generation+1,checks=$7::jsonb,updated_at=now() WHERE id='instagram'`,
   [legacy.accountId,seal({accessToken:legacy.token,provider:'instagram-facebook',tokenKind:'page',issuedAt:new Date().toISOString()},input.nextEnv,scope),legacy.token_expires_at,
    JSON.stringify(legacy.enabled_commands),JSON.stringify(legacy.pilot_sender_ids),scope,JSON.stringify({authorization:true,subscription:true,followLookup:true,liveDelivery:false,productionAccess:false,nonFollowerTest:false})]);
  console.log('Next brand authorization staged and verified; processing remains disabled.');
 }
 if(action==='pause-legacy'){
  if(!input.snapshot || pending!==0)throw Error('A saved snapshot and fully drained legacy outbox are required.');
  await old.transaction(async q=>{
   await q("SELECT id FROM finfolk.messaging_accounts WHERE id='instagram' FOR UPDATE");
   if((await q("SELECT 1 FROM finfolk.messaging_outbox WHERE state IN ('pending','sending','uncertain') LIMIT 1")).length)throw Error('Legacy delivery changed; reconcile before handover.');
   await q("UPDATE finfolk.messaging_accounts SET mode='disabled',generation=generation+1,updated_at=now() WHERE id='instagram'");
   await q('UPDATE finfolk.instagram_connect_codes SET invalidated=true WHERE consumed_by IS NULL');
  });
  input.cutoverAt=new Date().toISOString();await writeFile(inputPath,JSON.stringify(input),{mode:0o600});
  console.log('Legacy processing paused. Handover timestamp recorded in private state.');
 }
 if(action==='activate'){
  if(legacy.mode!=='disabled' || !input.cutoverAt)throw Error('Legacy must be paused first.');
  const active=await messagingConfig(next.query,input.nextEnv,{credentials:true});
  await new InstagramProvider(active).validate();
  await next.query("UPDATE finfolk.messaging_accounts SET mode='pilot',generation=generation+1,updated_at=now() WHERE id='instagram' AND checks->>'authorization'='true' AND checks->>'subscription'='true'");
  console.log('Next pilot activated. Live delivery acceptance must still be recorded from real Next events.');
 }
 if(action==='rollback'){
  if(!input.snapshot)throw Error('A saved snapshot is required.');
  const work=(await next.query("SELECT 1 FROM finfolk.messaging_outbox WHERE state IN ('pending','sending','uncertain') LIMIT 1")).length;
  if(work)throw Error('Reconcile Next delivery before rollback.');
  await next.query("UPDATE finfolk.messaging_accounts SET mode='disabled',generation=generation+1 WHERE id='instagram'");
  console.log('Next paused. Restore API routing before explicitly restoring the legacy pilot; never replay historical events.');
 }
}catch(error){console.error(JSON.stringify({code:error.code || error.cause?.code || 'migration_failed',message:error.query?'Database operation failed; retry from private saved state.':error.message}));process.exitCode=1;}finally{await old.pool.end();await next.pool.end();}
