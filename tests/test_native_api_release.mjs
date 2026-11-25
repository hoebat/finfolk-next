import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareNativeSites,prepareNativeSiteProfiles,referenceUUID} from '../scripts/lib/native_api_release.mjs';
const beach={id:'reviewed-beach',name:'Reviewed beach',state_id:'VIC',area_name:'Reviewed area',point:[145,-38],source_url:'https://example.com/source'};
const prepare=beaches=>prepareNativeSites(JSON.stringify({beaches}));
test('preserves the sourced key and gives it a stable native UUID',()=>{
 const [site]=prepare([beach]);assert.equal(site.id,referenceUUID(beach.id));assert.equal(site.key,beach.id);assert.equal(site.timezone,'Australia/Melbourne');
 assert.match(site.id,/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
 assert.deepEqual(prepare([beach]),prepare([beach]));
});
test('imports sourced profiles without inventing access, depth or waterbody evidence',()=>{
 const [profile]=prepareNativeSiteProfiles(JSON.stringify({beaches:[beach]}));
 assert.equal(profile.site_id,referenceUUID(beach.id));assert.equal(profile.waterbody,'unknown');assert.equal(profile.access_mode,'unknown');
 assert.deepEqual(profile.payload.point,beach.point);assert.equal(profile.payload.source_url,beach.source_url);
});
test('rejects duplicates, invalid coordinates and untrusted source URLs before import',()=>{
 assert.throws(()=>prepare([beach,beach]));
 for(const change of [{point:[200,-38]},{point:[145,null]},{source_url:'http://example.com'},{source_url:'https://user:password@example.com'},{state_id:'unknown'}])
  assert.throws(()=>prepare([{...beach,...change}]));
});
