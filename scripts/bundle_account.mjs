import {build} from 'esbuild';
import {resolve} from 'node:path';
const root=resolve('.');
const result=await build({stdin:{contents:`
import {AuthClient} from '@supabase/auth-js';
import {createAccountClient} from './js/finfolk-next/packages/edge/supabase-client.js';
let ready;
export function createLogbookClient(config){
 if(!ready)ready=(async()=>{
  if(config.authProvider!=='supabase'||!config.supabaseUrl||!config.publishableKey)throw Error('Supabase account configuration is incomplete.');
  const base=new URL(config.supabaseUrl);
  if(base.origin!=='https://supabase.finfolk.com.au'&&!(['127.0.0.1','localhost'].includes(base.hostname)&&base.protocol==='http:'))throw Error('Unexpected account service');

  const path='/app-backbone.js';const {applicationBackbone}=await import(/* webpackIgnore: true */path);
  const scoped={...config,backbone:true,authUrl:base.origin,cacheBackend:'sqlite',apiUrl:location.origin+'/',authRedirectTo:location.origin+'/account'};
  const app=await applicationBackbone(scoped);
  const callbackCode=new URL(location.href).searchParams.get('code');
  const auth=new AuthClient({url:new URL('/auth/v1',base).href,headers:{apikey:config.publishableKey},storageKey:'finfolk:auth:'+base.origin,persistSession:true,autoRefreshToken:true,detectSessionInUrl:!callbackCode,flowType:'pkce'});
  // v2.79 drops redirectType in automatic PKCE initialization. Preserve it only
  // from the SDK's successful, verifier-bound exchange, never a URL/UI flag.
  let passwordRecovery=false;
  if(callbackCode){
   const response=await auth.exchangeCodeForSession(callbackCode);if(response.error)throw response.error;
   passwordRecovery=response.data.redirectType==='PASSWORD_RECOVERY';
   const clean=new URL(location.href);clean.searchParams.delete('code');history.replaceState(history.state,'',clean.href);
  }
  const client=createAccountClient(auth,{...scoped,passwordRecovery},app);await client.ready;return client;
 })().catch(error=>{ready=null;throw error;});
 return ready;
}`,resolveDir:root,sourcefile:'account-client-entry.js'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'inline',plugins:[{name:'generated-workspaces',setup(b){b.onResolve({filter:/^@xtalk\//},args=>{const [,family,...path]=args.path.split('/');return {path:resolve(root,'js/finfolk-next/packages/libs/xt-'+family,...path)};});}}]});
process.stdout.write(result.outputFiles[0].contents);
