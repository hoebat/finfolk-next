// Local fixture transport only. Production entrypoints never register mock routes.
import http from 'node:http';
import {createHmac, timingSafeEqual, randomBytes} from 'node:crypto';
import {createSocialRuntime} from './social-runtime.mjs';
import {readLimited} from './messaging-http.mjs';

export const signMock = (raw, secret, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},s=${createHmac('sha256', secret).update(String(t) + '.').update(raw).digest('hex')}`;

export async function listenMock(handler) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Connection', 'close');
    try {
      const request = new Request('http://127.0.0.1' + req.url, {method: req.method, headers: req.headers,
        ...(req.method === 'GET' ? {} : {body: req, duplex: 'half'})});
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(500); res.end('Mock request failed'); }
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
  return {url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => {server.close(resolve); server.closeAllConnections();})};
}

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const input = async request => JSON.parse(new TextDecoder().decode(await readLimited(request, 262144)));

export async function createMockSocial({db, databaseURL, fixture, enabled = false}) {
  const url = new URL(databaseURL);
  if (!enabled || !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/finfolk_test_[a-z0-9_]+$/.test(url.pathname) || url.search || url.hash)
    throw Error('Mock requires explicit enablement and an isolated local test database');
  // Connection validation is transport setup; fixture/domain records are authored in Clojure.
  const actual = await db.query('SELECT current_database() AS name');
  if (actual.rows[0].name !== url.pathname.slice(1)) throw Error('Database mismatch');
  if (!exact(fixture, ['application', 'inboxes', 'members']) || !uuid(fixture.application) ||
      !Array.isArray(fixture.inboxes) || !fixture.inboxes.length || !fixture.inboxes.every(uuid) ||
      !Array.isArray(fixture.members) || !fixture.members.every(uuid)) throw Error('Native mock fixtures are required');
  const {application, inboxes, members} = fixture;
  const secret = randomBytes(32).toString('hex'), adminToken = randomBytes(32).toString('hex');
  const cryptoKey = new Uint8Array(randomBytes(32));
  const memberTokens = new Map(members.map(id => [randomBytes(32).toString('hex'), id]));
  const runtimes = new Map();
  for (const inbox of inboxes)
    runtimes.set(inbox, await createSocialRuntime({db, application, inbox, provider: 'mock', cryptoKey}));
  const captures = new Map(), outcomes = [], eligibility = new Map();
  const provider = await listenMock(async request => {
    if (request.method !== 'POST') return new Response('', {status: 405});
    if (request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('', {status: 403});
    const path = new URL(request.url).pathname, value = await input(request);
    if (path === '/identity') return Response.json({provider: value.provider, namespace: value.namespace,
      externalId: value.externalId, eligible: eligibility.get(value.externalId) ?? true});
    if (path !== '/send') return new Response('', {status: 404});
    const outcome = outcomes.shift() ?? 'accepted';
    if (['accepted', 'uncertain', 'lost_ack'].includes(outcome))
      captures.set(value.idempotencyKey, {...value, messageId: 'mock:' + value.idempotencyKey});
    if (outcome === 'lost_ack') return new Response('', {status: 502});
    return Response.json({status: outcome, ...(outcome === 'accepted' ? {messageId: 'mock:' + value.idempotencyKey} : {}),
      ...(outcome === 'retry' ? {retryAfter: 1} : {})});
  });
  async function postProvider(path, value) {
    return fetch(provider.url + path, {method: 'POST', headers: {authorization: `Bearer ${secret}`,
      'content-type': 'application/json'}, body: JSON.stringify(value), signal: AbortSignal.timeout(5000)});
  }
  const adapter = {
    async verifyAccount(request) {
      const response = await postProvider('/identity', request);
      if (!response.ok) throw Error('Identity request failed');
      return response.json();
    },
    async send(message) {
      const response = await postProvider('/send', message);
      if (!response.ok) return {status: 'uncertain'};
      return response.json();
    },
  };
  async function drain() {
    const counts = {processed: 0, actions: 0, deliveries: 0};
    for (const runtime of runtimes.values()) {
      for (let n = 0; n < 1000; n++) if (!(await runtime.reconcile()).more) break;
      for (let n = 0; n < 1000 && await runtime.processNext(); n++) counts.processed++;
      for (let n = 0; n < 1000 && await runtime.performNextAction(adapter); n++) counts.actions++;
      for (let n = 0; n < 1000 && await runtime.deliverNext(adapter); n++) counts.deliveries++;
    }
    return counts;
  }
  async function step(phase) {
    let count = 0;
    for (const runtime of runtimes.values()) {
      if (phase === 'reconcile') {
        for (let n = 0; n < 1000; n++) {count++; if (!(await runtime.reconcile()).more) break;}
      } else {
        const perform = {process: () => runtime.processNext(), actions: () => runtime.performNextAction(adapter),
          deliver: () => runtime.deliverNext(adapter)}[phase];
        for (let n = 0; n < 1000 && await perform(); n++) count++;
      }
    }
    return {count};
  }
  let gateway;
  try { gateway = await listenMock(async request => {
    try {
      const path = new URL(request.url).pathname;
      if (path === '/v1/messaging/webhooks/mock') {
        if (request.method !== 'POST') return new Response('', {status: 405});
        const raw = Buffer.from(await readLimited(request, 262144));
        const match = /^t=(\d+),s=([a-f0-9]{64})$/.exec(request.headers.get('mock-signature') ?? '');
        if (!match || Math.abs(Date.now() / 1000 - Number(match[1])) > 300 ||
            !timingSafeEqual(Buffer.from(match[2], 'hex'), Buffer.from(signMock(raw, secret, Number(match[1])).split(',s=')[1], 'hex')))
          return new Response('', {status: 403});
        const payload = JSON.parse(raw), runtime = runtimes.get(payload.inbox);
        if (!exact(payload, ['version', 'inbox', 'events']) || !runtime || payload.version !== 1 ||
            !Array.isArray(payload.events) || payload.events.length > 100) return new Response('', {status: 400});
        const envelopes = payload.events.map(event => {
          if (!exact(event, ['eventId', 'messageId', 'threadId', 'senderId', 'text', 'timestamp', 'channel', 'url', 'mediaId']) ||
              !Number.isSafeInteger(event.timestamp) || !Number.isSafeInteger(event.timestamp * 1000) || event.timestamp <= 0)
            throw Error('Invalid provider event');
          return {eventId: event.eventId, messageId: event.messageId, conversationId: event.threadId,
            senderId: event.senderId, body: event.text, sentAt: event.timestamp * 1000,
            deadline: (event.timestamp + 3600000) * 1000, channel: event.channel ?? 'message',
            url: event.url, mediaId: event.mediaId};
        });
        for (const envelope of envelopes) await runtime.receive(envelope);
        return Response.json({accepted: true});
      }
      const token = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
      if (['/__mock/redeem', '/__mock/disconnect'].includes(path) && request.method === 'POST') {
        const member = memberTokens.get(token);
        if (!member) return new Response('', {status: 403});
        const value = await input(request), runtime = runtimes.get(value.inbox);
        if (!runtime) return new Response('', {status: 400});
        if (path === '/__mock/redeem') {
          if (!exact(value, ['inbox', 'code']) || typeof value.code !== 'string') return new Response('', {status: 400});
          const result = await runtime.redeem(member, value.code);
          return Response.json(result ?? {error: 'Invalid or expired code'}, {status: result ? 200 : 409});
        }
        if (!exact(value, ['inbox', 'connectionId', 'identityVersion']) || !uuid(value.connectionId) || !uuid(value.identityVersion))
          return new Response('', {status: 400});
        const result = await runtime.disconnect(member, value.connectionId, value.identityVersion);
        return Response.json({ok: result}, {status: result ? 200 : 409});
      }
      if (token !== adminToken) return new Response('', {status: 403});
      if (path === '/__mock/drain' && request.method === 'POST') return Response.json(await drain());
      if (path === '/__mock/step' && request.method === 'POST') {
        const value = await input(request);
        if (!exact(value, ['phase']) || !['process', 'actions', 'deliver', 'reconcile'].includes(value.phase))
          return new Response('', {status: 400});
        return Response.json(await step(value.phase));
      }
      if (path === '/__mock/replies' && request.method === 'GET') return Response.json([...captures.values()]);
      if (path === '/__mock/inspect' && request.method === 'GET') return Response.json({application, inboxes});
      if (path === '/__mock/outcome' && request.method === 'POST') {
        const value = await input(request);
        if (!exact(value, ['outcome']) || !['accepted', 'retry', 'failed', 'uncertain', 'lost_ack'].includes(value.outcome))
          return new Response('', {status: 400});
        outcomes.push(value.outcome); return Response.json({ok: true});
      }
      if (path === '/__mock/identity' && request.method === 'POST') {
        const value = await input(request);
        if (!exact(value, ['externalId', 'eligible']) || typeof value.externalId !== 'string' || typeof value.eligible !== 'boolean')
          return new Response('', {status: 400});
        eligibility.set(value.externalId, value.eligible); return Response.json({ok: true});
      }
      return new Response('', {status: 404});
    } catch { return Response.json({error: 'Mock request rejected'}, {status: 400}); }
  }); } catch (error) { await provider.close(); throw error; }
  return {url: gateway.url, secret, adminToken, application, inboxes, members, memberTokens: [...memberTokens], drain,
    close: async () => {await gateway.close(); await provider.close(); cryptoKey.fill(0);}};
}
