import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SITE_ID, validatePromotion} from '../scripts/promote_frontend_preview.mjs';

const expected = '111111111111111111111111';
const candidate = {id: '222222222222222222222222', site_id: SITE_ID, state: 'ready', published_at: null,
  created_at: '2026-11-25T01:00:00Z', deploy_ssl_url: 'https://222222222222222222222222--finfolk.netlify.app'};
const site = {id: SITE_ID, custom_domain: 'finfolk.com.au',
  published_deploy: {id: expected, created_at: '2026-11-10T01:00:00Z'}};

test('accepts a newer ready unpublished preview for the expected production', () => {
  assert.equal(validatePromotion(site, candidate, expected), candidate.deploy_ssl_url);
});
test('rejects changed production, foreign projects, old or previously published deploys', () => {
  for (const change of [{site_id: 'other'}, {state: 'uploading'}, {published_at: '2026-11-25T01:01:00Z'},
    {created_at: '2026-11-01T01:00:00Z'}, {created_at: 'invalid'}, {id: expected},
    {deploy_ssl_url: 'https://other.example'}]) {
    assert.throws(() => validatePromotion(site, {...candidate, ...change}, expected));
  }
  assert.throws(() => validatePromotion({...site, published_deploy: {...site.published_deploy, id: candidate.id}}, candidate, expected));
  assert.throws(() => validatePromotion({...site, custom_domain: 'other.example'}, candidate, expected));
  assert.throws(() => validatePromotion(site, candidate, undefined));
});
