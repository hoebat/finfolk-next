import {
  messagingError,
  oauthSettings,
} from "./messaging-config.mjs";
export class InstagramProvider {
  constructor(config, fetcher = fetch) {
    if (config.provider && config.provider !== 'instagram-facebook')
      throw messagingError('provider_not_supported', 'Only Facebook Page authorization is supported for Instagram.', 503);
    this.config = { ...config, provider: 'instagram-facebook' };
    // Workers requires native fetch to be called without a provider-instance receiver.
    this.fetcher = (input, init) => fetcher(input, init);
  }
  async request(
    path,
    {
      method = "GET",
      body,
      token = this.config.token,
      host = this.config.graphHost || "https://graph.facebook.com",
      versioned = true,
      timeoutMs = 15000,
    } = {},
  ) {
    if (!token)
      throw messagingError(
        "token_missing",
        "Instagram authorization is required.",
        503,
      );
    const url = new URL(
      (versioned ? "/" + this.config.graphVersion : "") + path,
      host,
    );
    let response;
    try {
      response = await this.fetcher(url, {
        method,
        redirect: "manual",
        headers: {
          Authorization: "Bearer " + token,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw messagingError(
        ['TimeoutError', 'AbortError'].includes(error?.name) ? "provider_request_timeout" : "provider_transport_uncertain",
        "Instagram did not confirm the request.",
        503,
        true,
      );
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw messagingError(
        "provider_response_uncertain",
        "Instagram returned an unreadable response.",
        503,
      );
    }
    if (!response.ok || data.error) {
      const providerCode = Number(data.error?.code);
      if (
        this.config.provider === "instagram-facebook" &&
        path.includes("/subscribed_apps") &&
        providerCode === 200
      ) {
        if (/permissions is needed: pages_messaging\b/.test(data.error?.message || ""))
          throw messagingError(
            "page_messaging_permission_missing",
            "Reconnect FinFolk and grant Page messaging access to subscribe to message webhooks.",
            503,
          );
        if (/Requires pages_manage_metadata permission\b/.test(data.error?.message || ""))
          throw messagingError(
            "page_webhook_permission_missing",
            "Reconnect FinFolk and grant Page webhook access.",
            503,
          );
      }
      if (response.status === 401 || providerCode === 190)
        throw messagingError(
          "token_invalid",
          "Reconnect the FinFolk Instagram account.",
          503,
        );
      if (response.status === 429 || [4, 17, 32, 613].includes(providerCode)) {
        const error = messagingError(
          "provider_rate_limited",
          "Instagram temporarily limited requests.",
          429,
          true,
        );
        error.definiteRejection = true;
        const retry = Number(response.headers?.get("retry-after"));
        error.retryAfter =
          Number.isFinite(retry) && retry > 0 ? Math.min(retry, 3600) : 120;
        throw error;
      }
      if (response.status >= 500)
        throw messagingError(
          "provider_response_uncertain",
          "Instagram did not confirm acceptance.",
          503,
          true,
        );
      throw messagingError(
        "provider_rejected",
        "Instagram rejected the request. Check permissions and account subscription.",
        503,
      );
    }
    return data;
  }
  async profile(sender, { timeoutMs = 15000 } = {}) {
    const data = await this.request(
      "/" + sender + "?fields=id,username,is_user_follow_business",
      { timeoutMs },
    );
    if (
      String(data.id) !== sender ||
      typeof data.username !== "string" ||
      !/^[a-z0-9._]{1,30}$/i.test(data.username) ||
      typeof data.is_user_follow_business !== "boolean"
    )
      throw messagingError(
        "follow_lookup_unverified",
        "Instagram could not confirm the sender and follow status.",
        503,
        true,
      );
    return {
      handle: data.username.toLowerCase(),
      follows: data.is_user_follow_business,
    };
  }
  async validate() {
    const data = await this.authorizedAccount();
    if (
      String(data.id) !== this.config.accountId ||
      data.username?.toLowerCase() !== "finfolk.com.au"
    )
      throw messagingError(
        "wrong_brand_account",
        "Authorization must be for @finfolk.com.au.",
        409,
      );
    return data;
  }
  async validatePageToken() {
    const metadata = await this.request(
      "/debug_token?input_token=" + encodeURIComponent(this.config.token),
      {
        token: this.config.appId + "|" + this.config.clientSecret,
      },
    );
    const d = metadata.data;
    if (
      !d?.is_valid ||
      String(d.app_id) !== this.config.appId ||
      d.type !== "PAGE"
    )
      throw messagingError(
        "wrong_token_type",
        "Reconnect the FinFolk Facebook Page.",
        409,
      );
    const page = await this.request("/me?fields=id");
    if (String(page.id) !== this.config.pageId)
      throw messagingError(
        "wrong_brand_account",
        "Authorize the configured FinFolk Facebook Page only.",
        409,
      );
    return d;
  }
  async authorizedAccount() {
    await this.validatePageToken();
    const page = await this.request("/" + this.config.pageId + "?fields=id,instagram_business_account{id,username}");
    if (String(page.id) !== this.config.pageId ||
        String(page.instagram_business_account?.id) !== this.config.accountId ||
        page.instagram_business_account?.username?.toLowerCase() !== "finfolk.com.au")
      throw messagingError("wrong_brand_account", "The Facebook Page must be linked to @finfolk.com.au.", 409);
    return page.instagram_business_account;
  }
  async subscriptions() {
    const data = await this.request(
      "/" + this.config.accountId + "/subscribed_apps",
    );
    {
      await this.validatePageToken();
      const page = await this.request(
        "/" +
          this.config.pageId +
          "/subscribed_apps?fields=id,subscribed_fields",
      );
      const pageSubscribed =
        Array.isArray(page.data) &&
        page.data.some(
          (app) =>
            String(app.id) === this.config.appId &&
            app.subscribed_fields?.includes("messages"),
        );
      // Facebook Page-token responses can omit the app ID and expose only this
      // token's subscription. Bind the token to this app/Page before accepting it.
      return (
        pageSubscribed &&
        Array.isArray(data.data) &&
        data.data.length === 1 &&
        (data.data[0].id === undefined ||
          String(data.data[0].id) === this.config.appId) &&
        data.data[0].subscribed_fields?.includes("messages") === true
      );
    }
  }
  async subscribe() {
    const metadata = await this.validatePageToken();
    const fields = async (id, additions) => {
      const current = await this.request('/' + id + '/subscribed_apps');
      const apps = Array.isArray(current.data) ? current.data : [];
      const existing = apps.filter(app => String(app.id) === this.config.appId || (app.id === undefined && apps.length === 1))
        .flatMap(app => Array.isArray(app.subscribed_fields) ? app.subscribed_fields : [])
        .filter(field => typeof field === 'string' && /^[a-z_]+$/.test(field));
      return [...new Set([...existing, ...additions])];
    };
    const pageFields = await fields(this.config.pageId, ['messages']);
    const instagramFields = await fields(this.config.accountId,
      metadata.scopes?.includes('instagram_manage_comments') ? ['messages','comments','mentions'] : ['messages']);
    await this.request('/' + this.config.pageId + '/subscribed_apps', {method:'POST',body:{subscribed_fields:pageFields}});
    return this.request('/' + this.config.accountId + '/subscribed_apps', {method:'POST',body:{subscribed_fields:instagramFields}});
  }
  async sendText(sender, text) {
    const data = await this.request("/" + this.config.accountId + "/messages", {
      method: "POST",
      body: { recipient: { id: sender }, message: { text } },
    });
    if (typeof data.message_id !== "string" || !data.message_id)
      throw messagingError(
        "provider_response_uncertain",
        "Instagram did not return a message ID.",
        503,
      );
    return data.message_id;
  }
  async senderAction(sender, action) {
    if (!/^\d{1,40}$/.test(sender) || !['mark_seen', 'typing_on', 'typing_off'].includes(action))
      throw messagingError('sender_action_invalid', 'Invalid Instagram sender action.');
    // Page-authorized sender actions use the Page edge even though text replies
    // use the linked Instagram account edge. The recipient remains the IGSID.
    const account = this.config.pageId;
    if (!/^\d{1,40}$/.test(account || ''))
      throw messagingError('sender_action_account_missing', 'Reconnect the FinFolk messaging account.', 503);
    const data = await this.request('/' + account + '/messages', {
      method: 'POST', timeoutMs: 3000,
      body: { recipient: { id: sender }, sender_action: action },
    });
    if (String(data.recipient_id) !== sender && data.success !== true)
      throw messagingError('sender_action_unconfirmed', 'Instagram did not confirm the sender action.', 503);
  }
}
export async function exchangeOAuth(code, env, fetcher = fetch, {expectedUsername = 'finfolk.com.au'} = {}) {
  const settings = oauthSettings(env);
  const url = new URL(settings.graphHost + '/' + (env.INSTAGRAM_MESSAGING_GRAPH_VERSION || 'v26.0') + '/oauth/access_token');
  for(const [key,value] of Object.entries({client_id:settings.appId,client_secret:settings.clientSecret,code,redirect_uri:settings.redirectURI})) url.searchParams.set(key,value);
  let response,data;
  try {response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});data=await response.json();}
  catch {throw messagingError('oauth_exchange_failed','Facebook authorization could not be confirmed.',503);}
  if(!response.ok || typeof data.access_token!=='string' || !data.access_token)
    throw messagingError('oauth_exchange_failed','Facebook authorization could not be completed.',503);
  return facebookPageGrant(data.access_token,env,fetcher,{expectedUsername});
}

// Resolve a configured, verified Page directly. /me/accounts can be empty even
// when Meta allows this exact Page and its linked Instagram account.
export async function facebookPageGrant(userToken, env, fetcher = fetch, {expectedUsername = 'finfolk.com.au'} = {}) {
  const settings = oauthSettings(env);
  if (
    !/^\d{1,40}$/.test(settings.pageId) ||
    !/^\d{1,40}$/.test(env.INSTAGRAM_MESSAGING_ACCOUNT_ID || "")
  )
    throw messagingError(
      "oauth_not_configured",
      "Configure the FinFolk Facebook Page and Instagram account.",
      503,
    );
  const p = new InstagramProvider(
    {
      ...settings,
      token: userToken,
      graphVersion: env.INSTAGRAM_MESSAGING_GRAPH_VERSION || "v26.0",
    },
    fetcher,
  );
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: settings.appId,
    client_secret: settings.clientSecret,
    fb_exchange_token: userToken,
  });
  const long = await p.request("/oauth/access_token?" + params);
  if (!long.access_token)
    throw messagingError(
      "oauth_exchange_failed",
      "Facebook token exchange failed.",
      503,
    );
  const page = await p.request(
    "/" +
      settings.pageId +
      "?fields=id,instagram_business_account{id,username},access_token",
    { token: long.access_token },
  );
  if (
    String(page.id) !== settings.pageId ||
    (expectedUsername && page.instagram_business_account?.username?.toLowerCase() !== expectedUsername.toLowerCase()) ||
    String(page.instagram_business_account?.id) !==
      env.INSTAGRAM_MESSAGING_ACCOUNT_ID ||
    !page.access_token
  )
    throw messagingError(
      "wrong_brand_account",
      "Authorize the Facebook Page linked to @finfolk.com.au only.",
      409,
    );
  p.config.token = page.access_token;
  const d = await p.validatePageToken();
  const expiries = [d.expires_at, d.data_access_expires_at].filter(
    (x) => Number.isSafeInteger(x) && x > 0 && x <= 8640000000000,
  );
  return {
    token: page.access_token,
    tokenKind: "facebook-page",
    expiresAt: expiries.length
      ? new Date(Math.min(...expiries) * 1000).toISOString()
      : null,
  };
}
