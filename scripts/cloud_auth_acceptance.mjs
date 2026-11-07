// Managed SDK acceptance on the recorded isolated branch. Never invents auth tables.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createAuthClient} from '@neondatabase/auth';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {connectCloudDatabase} from './lib/cloud_database.mjs';
const p=JSON.parse(await readFile('.cache/cloud-rebuild/provision.json','utf8')),auth=JSON.parse(await readFile('.cache/cloud-rebuild/auth-status.json','utf8'));
if(p.name!=='finfolk-native-cloud'||p.parent!=='br-sparkling-sun-a7dpot05'||auth.branch_id!==p.branch||auth.db_name!==p.database)throw Error('Refusing non-candidate auth acceptance');
const origin='http://localhost:18787',cookies=new Map(),client=createAuthClient(auth.base_url);
function options(){return {headers:{Origin:origin,'X-Force-Fetch':'true',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')},onResponse({response}){for(const line of response.headers.getSetCookie()){const pair=line.split(';')[0],i=pair.indexOf('=');if(i>0){const k=pair.slice(0,i),v=pair.slice(i+1);if(v)cookies.set(k,v);else cookies.delete(k);}}}};}
const unwrap=result=>{if(result.error)throw Error('Managed SDK operation failed ('+(result.error.status||'unknown')+')');return result.data;};
let user;
try{
 const email='finfolk-cloud-'+randomBytes(8).toString('hex')+'@example.test',password=randomBytes(24).toString('base64url');
 const signup=unwrap(await client.signUp.email({email,password,name:'Cloud acceptance fixture'},options()));user=signup.user?.id;assert.ok(user);
 unwrap(await client.signOut({fetchOptions:options()}));cookies.clear();
 unwrap(await client.signIn.email({email,password},options()));
 const session=unwrap(await client.getSession({fetchOptions:options(),query:{disableCookieCache:true}}));assert.equal(session.user.id,user);
 const jwt=unwrap(await client.token({fetchOptions:options()}));assert.ok(jwt.token);
 const verified=await jwtVerify(jwt.token,createRemoteJWKSet(new URL(auth.jwks_url)),{issuer:new URL(auth.base_url).origin,algorithms:['EdDSA']});assert.equal(verified.payload.sub,user);
 // Exercise the Clojure-authored native mutation with a real managed subject.
 // All application rows are rolled back; provider identity is cleaned up below.
 const admin=JSON.parse(await readFile('.cache/cloud-rebuild/admin.json','utf8'));
 const db=await connectCloudDatabase(admin.url);
 try{
  await db.query('BEGIN');
  const row=(await db.query(`SELECT finfolk_rpc.insert_user($1,'{"displayName":"Acceptance fixture"}'::jsonb,finfolk.op_fn('cloud-auth-acceptance',$1,'{}'::jsonb)) AS value`,[verified.payload.sub])).rows[0].value;
  assert.equal(row.id,user);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."User" u JOIN neon_auth."user" a ON a.id::text=u.id WHERE u.id=$1',[user])).rows[0].n,1);
 }finally{await db.query('ROLLBACK');await db.end();}
 const restored=createAuthClient(auth.base_url);const state=unwrap(await restored.getSession({fetchOptions:options(),query:{disableCookieCache:true}}));assert.equal(state.user.id,user);
 unwrap(await client.signOut({fetchOptions:options()}));cookies.clear();
 const signedOut=unwrap(await client.getSession({fetchOptions:options(),query:{disableCookieCache:true}}));assert.ok(!signedOut?.user);
 await writeFile('.cache/cloud-rebuild/auth-acceptance.json',JSON.stringify({branch:p.branch,authUrl:auth.base_url,verifiedAt:new Date().toISOString(),signup:true,signin:true,sessionRestoration:true,jwksVerifiedJWT:true,nativeClojureUserAndAuthJoin:true,applicationWritesRolledBack:true,signout:true})+'\n',{mode:0o600});
 console.log('CLOUD_AUTH_PASS: managed SDK signup, signin, restored session, JWKS-verified JWT, native Clojure user/auth join, rollback and signout.');
}finally{
 if(user){let last;for(let attempt=0;attempt<3;attempt++){try{execFileSync('neon',['api',`/projects/${p.project}/branches/${p.branch}/auth/users/${encodeURIComponent(user)}`,'-X','DELETE'],{stdio:['ignore','pipe','pipe'],timeout:30000});last=null;break;}catch{last=Error('Managed acceptance user cleanup failed');}}if(last)throw last;}
}
