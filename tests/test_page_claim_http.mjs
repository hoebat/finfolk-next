import assert from 'node:assert/strict';import {test} from 'node:test';import {createSocialMemberHTTP} from '../backend/social-member-http.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('claim transport binds the authenticated member, page and trusted IP; rejects caller identity and wrong providers',async()=>{
 const calls=[];const runtime={claimPageVerified:async(...args)=>{calls.push(args);return {claimed:true,id}}};
 const handler=createSocialMemberHTTP({runtime,adapter:{},authenticate:async()=>({id:'member',verified:true}),allowedOrigins:['https://finfolk.com.au'],trustedIP:()=> 'trusted-proxy-ip'});
 const request=(body={id,code:'CLAIM123'},origin='https://finfolk.com.au',path='instagram')=>new Request('https://api.finfolk.com.au/v1/me/'+path+'/claim',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await handler(request())).status,200);assert.equal(calls.length,1);assert.deepEqual(calls[0].slice(0,3),['member',id,'CLAIM123']);assert.match(calls[0][3],/^[a-f0-9]{64}$/);
 assert.equal((await handler(request({id,code:'CLAIM123',userId:'attacker'}))).status,400);assert.equal((await handler(request(undefined,'https://evil.example'))).status,403);
 const tiktok=createSocialMemberHTTP({runtime,adapter:{},authenticate:async()=>({id:'member',verified:true}),allowedOrigins:['https://finfolk.com.au'],trustedIP:()=> 'ip',provider:'tiktok'});assert.equal((await tiktok(request(undefined,undefined,'tiktok'))).status,404);assert.equal(calls.length,1);
});

import {runAction} from '../js/finfolk-next/packages/edge/page-models.js';
test('business claim action uses authenticated REST transport and binds the page identity',async()=>{
 const calls=[];const client={authProvider:'supabase',request:async(...args)=>{calls.push(args);return {claimed:true}},call:()=>{throw Error('Claim must use REST transport')}};
 assert.deepEqual(await runAction(client,'listing','claim',{id},{id:'different',code:'CLAIM123'}),{claimed:true});
 assert.deepEqual(calls,[["/v1/me/instagram/claim",{method:'POST',body:{id,code:'CLAIM123'}}]]);
});

import {socialRequestAllowed} from '../js/finfolk-next/packages/edge/supabase-client.js';
test('declared business claim request passes the native authenticated client gate',async()=>{
 const paths=[];await runAction({authProvider:'supabase',request:async(path,options)=>paths.push([path,options.method])},'listing','claim',{id},{code:'CLAIM123'});
 assert.equal(paths.length,1);assert.equal(socialRequestAllowed(...paths[0]),true);
});
