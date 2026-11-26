import assert from 'node:assert/strict';
import {appendFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const SITE_ID = 'fe66fb45-09ab-4e37-8474-3a4f2e162123';
export function validatePromotion(site, candidate, expected, commit) {
  assert.match(expected ?? '', /^[a-f0-9]{24}$/, 'An expected production deploy ID is required');
  assert.equal(site.id, SITE_ID, 'Wrong Netlify project');
  assert.equal(site.custom_domain, 'finfolk.com.au', 'Wrong production domain');
  assert.equal(site.published_deploy?.id, expected, 'Production changed; review its current deploy before retrying');
  assert.equal(candidate.site_id, SITE_ID, 'Preview belongs to a different project');
  assert.match(candidate.id ?? '', /^[a-f0-9]{24}$/);
  assert.equal(candidate.state, 'ready', 'Preview must be ready');
  assert(!candidate.published_at, 'Only a never-published preview can be promoted');
  assert.notEqual(candidate.id, expected, 'Preview is already production');
  assert(Date.parse(candidate.created_at) > Date.parse(site.published_deploy.created_at), 'Preview must be newer than production');
  assert.equal(candidate.deploy_ssl_url, `https://${candidate.id}--finfolk.netlify.app`, 'Unexpected preview URL');
  if (commit) {
    assert.match(commit, /^[a-f0-9]{40}$/, 'Invalid release commit');
    assert.equal(candidate.title, `GitHub Actions ${commit}`, 'Preview does not belong to this release commit');
  }
  return candidate.deploy_ssl_url;
}

async function main() {
  const mode = process.argv[2];
  assert(['--check', '--publish'].includes(mode), 'Use --check or --publish');
  const id = process.env.DEPLOY_ID;
  const expected = process.env.EXPECTED_PRODUCTION_DEPLOY_ID;
  const commit = process.env.RELEASE_SHA;
  assert.match(id ?? '', /^[a-f0-9]{24}$/);
  assert(process.env.NETLIFY_AUTH_TOKEN, 'NETLIFY_AUTH_TOKEN is required');
  async function api(path, method = 'GET') {
    const response = await fetch(`https://api.netlify.com/api/v1${path}`, {
      method, headers: {Authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN}`},
      signal: AbortSignal.timeout(60000),
    });
    assert(response.ok, `Netlify ${method} failed (${response.status}); no automatic retry of publication`);
    return response.json();
  }
  const candidate = await api(`/deploys/${id}`);
  const site = await api(`/sites/${SITE_ID}`);
  const preview = validatePromotion(site, candidate, expected, commit);
  console.log(JSON.stringify({mode, site: SITE_ID, preview, previousProduction: expected}));
  if (mode === '--check') return;
  // Re-read the live pointer immediately before the mutation. Both release workflows
  // share a concurrency group; this also catches changes made outside GitHub.
  validatePromotion(await api(`/sites/${SITE_ID}`), candidate, expected, commit);
  // Netlify calls this endpoint "restore"; the guards above allow only a newer,
  // never-published preview. It publishes the existing artifact without a build.
  const result = await api(`/sites/${SITE_ID}/deploys/${id}/restore`, 'POST');
  assert.equal(result.id, id, 'Netlify returned a different deploy');
  let published;
  for (let attempt = 0; attempt < 12; attempt++) {
    published = await api(`/sites/${SITE_ID}`);
    if (published.published_deploy?.id === id) break;
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  assert.equal(published.published_deploy?.id, id, 'Production pointer did not match the promoted preview');
  console.log(JSON.stringify({publishedDeploy: id, production: 'https://finfolk.com.au'}));
  if (process.env.FRONTEND_RELEASE_RECEIPT) writeFileSync(process.env.FRONTEND_RELEASE_RECEIPT,
    JSON.stringify({deployId:id,commit,previousProduction:expected,url:'https://finfolk.com.au',preview,publishedAt:new Date().toISOString()},null,2)+'\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `Promoted [preview ${id}](${preview}) to [FinFolk](https://finfolk.com.au).\n\nPrevious production: \`${expected}\`. Existing artifacts reused; no rebuild, API deployment, database migration or DNS change.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {console.error(error.message); process.exitCode = 1;});
}
