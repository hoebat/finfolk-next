import {reconcileAccountDeletions} from './native-account-deletion.mjs';
import { serve } from '@hono/node-server';
import { createAPI, managedVerifier } from './api.mjs';
import { database } from './db.mjs';
let legacyVerifier;
const verify=token=>(legacyVerifier ||= managedVerifier(process.env))(token);
const db = database(process.env.DATABASE_URL),
  siteNotesDb=process.env.SITE_NOTES_DATABASE_URL?database(process.env.SITE_NOTES_DATABASE_URL):null,
  app = createAPI({ db, siteNotesDb, verify,...(process.env.FINFOLK_ALLOWED_ORIGINS?{origins:process.env.FINFOLK_ALLOWED_ORIGINS.split(',').map(x=>x.trim()).filter(Boolean)}:{}) });
serve(
  {
    fetch: (request) => app.fetch(request, process.env),
    port: Number(process.env.PORT || 8787),
    hostname: '127.0.0.1',
  },
  (info) =>
    console.log(`FinFolk API listening on http://127.0.0.1:${info.port}`),
);

if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.FINFOLK_ACCOUNT_CLEANUP_ENABLED!=='false'){
 const cleanup=()=>reconcileAccountDeletions({query:db.query,supabaseUrl:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY}).catch(()=>console.error('Native account cleanup retry failed'));
 const timer=setInterval(cleanup,60000);timer.unref();
}
