import assert from 'node:assert/strict';
import {appendFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {SITE_ID} from './promote_frontend_preview.mjs';

export function validateSource(commit, currentMain, repository) {
  assert.equal(repository, 'hoebat/finfolk-next', 'Unexpected release repository');
  assert.match(commit ?? '', /^[a-f0-9]{40}$/, 'Invalid release commit');
  assert.equal(commit, currentMain, 'Main has advanced; the newer commit must complete checks before publishing');
}
export function productionId(site) {
  assert.equal(site.id, SITE_ID, 'Wrong Netlify project');
  assert.equal(site.custom_domain, 'finfolk.com.au', 'Wrong production domain');
  assert.equal(site.published_deploy?.state, 'ready', 'Current production is not ready');
  const id=site.published_deploy?.id;
  assert.match(id ?? '', /^[a-f0-9]{24}$/, 'Missing production deployment');
  return id;
}
async function main() {
  const mode=process.argv[2];
  assert(['--capture','--check-main'].includes(mode), 'Use --capture or --check-main');
  const {GITHUB_TOKEN,GITHUB_REPOSITORY,RELEASE_SHA,NETLIFY_AUTH_TOKEN}=process.env;
  assert(GITHUB_TOKEN, 'GITHUB_TOKEN is required');
  assert.equal(GITHUB_REPOSITORY,'hoebat/finfolk-next','Unexpected release repository');
  async function api(url,token) {
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(60000)});
    assert(response.ok,`Release metadata request failed (${response.status})`);
    return response.json();
  }
  const main=await api(`https://api.github.com/repos/${GITHUB_REPOSITORY}/git/ref/heads/main`,GITHUB_TOKEN);
  validateSource(RELEASE_SHA,main.object?.sha,GITHUB_REPOSITORY);
  if(mode==='--check-main')return;
  assert(NETLIFY_AUTH_TOKEN,'NETLIFY_AUTH_TOKEN is required');
  const site=await api(`https://api.netlify.com/api/v1/sites/${SITE_ID}`,NETLIFY_AUTH_TOKEN),id=productionId(site);
  mkdirSync('.cache',{recursive:true});
  writeFileSync('.cache/frontend-release-source.json',JSON.stringify({commit:RELEASE_SHA,previousProduction:id},null,2)+'\n');
  if(process.env.GITHUB_ENV)appendFileSync(process.env.GITHUB_ENV,`EXPECTED_PRODUCTION_DEPLOY_ID=${id}\n`);
  console.log(JSON.stringify({commit:RELEASE_SHA,previousProduction:id}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1});
