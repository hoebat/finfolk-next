import { InstagramProvider, exchangeOAuth } from '../../backend/instagram-provider.mjs';
import { seal, unseal } from '../../backend/messaging-config.mjs';
import { instagramWebhook } from '../../backend/instagram-webhook.mjs';
export default {
  async fetch(_request, bindings) {
    if (new URL(_request.url).pathname === '/health') return Response.json({ready: true});
    if (new URL(_request.url).pathname === '/oauth') {
      const grant = await exchangeOAuth('fixture-code', {
        INSTAGRAM_MESSAGING_PROVIDER:'instagram-facebook', INSTAGRAM_APP_ID:'111', INSTAGRAM_APP_SECRET:'fixture-secret',
        INSTAGRAM_MESSAGING_PAGE_ID:'222', INSTAGRAM_MESSAGING_ACCOUNT_ID:'123',
      }, (input, init) => {
        const target = new URL(input), local = new URL(bindings.TEST_PROVIDER_ORIGIN);
        target.protocol = local.protocol; target.host = local.host;
        return fetch(target, init);
      });
      return Response.json(grant);
    }
    const env = { MESSAGING_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64') };
    const original = { command: '/claim fixture', unicode: '波 🌊' };
    const encrypted = seal(original, env, 'fixture-member:key');
    let rejectsWrongScope = false;
    try { unseal(encrypted, env, 'other-member:key'); } catch { rejectsWrongScope = true; }
    const challenge = await instagramWebhook(new Request('https://fixture/instagram/webhook?hub.mode=subscribe&hub.verify_token=fixture&hub.challenge=challenge-123'), { INSTAGRAM_VERIFY_TOKEN: 'fixture' }, () => { throw Error('GET verification must not use the database'); });
    const providerAccount = await new InstagramProvider({ provider: 'instagram-facebook', graphHost: bindings.TEST_PROVIDER_ORIGIN, graphVersion: 'v26.0', accountId: '123', appId:'111', clientSecret:'fixture-secret',pageId:'222', token: 'fixture' }).validate();
    return Response.json({ providerAccount, result: unseal(encrypted, env, 'fixture-member:key'), rejectsWrongScope, challenge: await challenge.text() });
  },
};
