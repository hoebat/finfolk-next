// Cryptographic primitives only. Length, alphabet and reply text come from PostgreSQL.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const canonical = value => JSON.stringify(value, Object.keys(value).sort());
const encode = value => btoa(String.fromCharCode(...value));
const decode = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));

async function aesKey(raw) {
  if (!(raw instanceof Uint8Array) || raw.byteLength !== 32) throw Error('A 256-bit sealing key is required');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function sealSocialReply(text, binding, rawKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {name: 'AES-GCM', iv, additionalData: encoder.encode(canonical(binding))},
    await aesKey(rawKey), encoder.encode(text),
  );
  return 'v1.' + encode(iv) + '.' + encode(new Uint8Array(ciphertext));
}

export async function openSocialReply(sealed, binding, rawKey) {
  const parts = sealed.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') throw Error('Unsupported sealed reply');
  const value = await crypto.subtle.decrypt(
    {name: 'AES-GCM', iv: decode(parts[1]), additionalData: encoder.encode(canonical(binding))},
    await aesKey(rawKey), decode(parts[2]),
  );
  return decoder.decode(value);
}

export async function prepareSocialMaterial(request, binding, rawKey) {
  const {codeLength: length, alphabet, prefix, suffix} = request;
  if (!Number.isInteger(length) || length < 1 || length > 64 ||
      typeof alphabet !== 'string' || alphabet.length < 2 || alphabet.length > 128 ||
      new Set(alphabet).size !== alphabet.length || typeof prefix !== 'string' || typeof suffix !== 'string')
    throw Error('Invalid cryptographic preparation request');
  const limit = 256 - 256 % alphabet.length;
  let code = '';
  while (code.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(64))) {
      if (byte < limit) code += alphabet[byte % alphabet.length];
      if (code.length === length) break;
    }
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(code)));
  const tokenHash = [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const ciphertext = await sealSocialReply(prefix + code + suffix, binding, rawKey);
  return {code, tokenHash, ciphertext};
}
