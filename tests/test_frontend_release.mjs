import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSource,productionId} from '../scripts/prepare_frontend_release.mjs';
import {SITE_ID,validatePromotion} from '../scripts/promote_frontend_preview.mjs';
const sha='a'.repeat(40),id='1'.repeat(24),site={id:SITE_ID,custom_domain:'finfolk.com.au',published_deploy:{id,state:'ready',created_at:'2026-11-01T00:00:00Z'}};
test('release must be the current committed main of FinFolk',()=>{
  validateSource(sha,sha,'hoebat/finfolk-next');
  for(const args of [[sha,'b'.repeat(40),'hoebat/finfolk-next'],['main','main','hoebat/finfolk-next'],[sha,sha,'someone/fork']])assert.throws(()=>validateSource(...args));
});
test('capture only the ready production deployment on the canonical project',()=>{
  assert.equal(productionId(site),id);
  for(const change of [{id:'other'},{custom_domain:'other.example'},{published_deploy:null},{published_deploy:{id,state:'building'}},{published_deploy:{id:'bad',state:'ready'}}])assert.throws(()=>productionId({...site,...change}));
});
test('Actions promotion rejects a preview from a different commit',()=>{
  const candidate={id:'2'.repeat(24),site_id:SITE_ID,state:'ready',published_at:null,created_at:'2026-11-02T00:00:00Z',deploy_ssl_url:`https://${'2'.repeat(24)}--finfolk.netlify.app`,title:`GitHub Actions ${sha}`};
  assert.equal(validatePromotion(site,candidate,id,sha),candidate.deploy_ssl_url);
  assert.throws(()=>validatePromotion(site,{...candidate,title:'Another release'},id,sha));
  assert.throws(()=>validatePromotion(site,candidate,id,'main'));
});
