// Exercise actual workerd crypto: Node-only tests cannot catch platform differences.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import net from 'node:net';
import http from 'node:http';
await mkdir('.cache', { recursive: true });
const directory = await mkdtemp(resolve('.cache/messaging-worker-'));
const socket = net.createServer();
await new Promise(done => socket.listen(0, '127.0.0.1', done));
const port = socket.address().port;
await new Promise(done => socket.close(done));
let providerRequests = 0;
const provider = http.createServer((request, response) => {
  providerRequests++;
  response.setHeader('Content-Type', 'application/json');
  const url = new URL(request.url,'http://fixture');
  const data = url.pathname === '/v26.0/oauth/access_token' ? {access_token:url.searchParams.has('code')?'fixture-short':'fixture-long'} :
    url.pathname === '/v26.0/debug_token' ? {data:{app_id:'111',type:'PAGE',is_valid:true}} :
    url.pathname === '/v26.0/me' ? {id:'222'} :
    url.pathname === '/v26.0/222' ? {id:'222',instagram_business_account:{id:'123',username:'finfolk.com.au'},access_token:'fixture-page'} : null;
  response.statusCode = data ? 200 : 400;
  response.end(JSON.stringify(data || {error:{code:100}}));
});
await new Promise(done => provider.listen(0, '127.0.0.1', done));
const providerOrigin = 'http://127.0.0.1:' + provider.address().port;
const config = resolve(directory, 'wrangler.json');
await writeFile(config, JSON.stringify({ name: 'messaging-runtime-test', main: resolve('tests/fixtures/messaging-worker.mjs'), compatibility_date: '2026-10-30', compatibility_flags: ['nodejs_compat'], vars: { TEST_PROVIDER_ORIGIN: providerOrigin } }));
const worker = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--config', config, '--local', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
let output = '';worker.stdout.on('data', data => { output += data; });worker.stderr.on('data', data => { output += data; });
try {
  let ready;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) throw Error('Worker runtime failed to start: ' + output);
    try { ready = await fetch('http://127.0.0.1:' + port + '/health', {signal: AbortSignal.timeout(1000)}); break; } catch { await new Promise(done => setTimeout(done, 100)); }
  }
  assert.ok(ready, 'Worker runtime did not start within 30 seconds');
  assert.equal(ready.status, 200);
  assert.equal(providerRequests, 0, 'Startup probes must not call the provider');
  const response = await fetch('http://127.0.0.1:' + port, {signal: AbortSignal.timeout(15000)});
  assert.equal(response.status, 200, output.slice(-1500));
  assert.deepEqual(await response.json(), { providerAccount: { id: '123', username: 'finfolk.com.au' }, result: { command: '/claim fixture', unicode: '波 🌊' }, rejectsWrongScope: true, challenge: 'challenge-123' });
  assert.equal(providerRequests, 3, 'The provider must issue one real HTTP request with its default fetch function');
  const oauth = await fetch('http://127.0.0.1:' + port + '/oauth', {signal:AbortSignal.timeout(15000)});
  assert.equal(oauth.status, 200, 'The OAuth code exchange must work with native workerd fetch');
  assert.deepEqual(await oauth.json(), {token:'fixture-page',tokenKind:'facebook-page',expiresAt:null});
  assert.equal(providerRequests, 8, 'Code exchange, long-lived grant, configured Page, token validation and Page identity must all reach the provider');
  console.log('MESSAGING_WORKER_PASS: actual workerd encrypted replay, Unicode, scope binding, webhook verification, provider HTTP transport and full Facebook Page OAuth exchange.');
} finally {
  worker.kill('SIGTERM');
  if (worker.exitCode === null) await new Promise(done => worker.once('exit', done));
  await new Promise(done => provider.close(done));
  await rm(directory, { recursive: true, force: true });
}
