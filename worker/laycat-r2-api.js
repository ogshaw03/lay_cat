/*
 * LayCAT R2 プロキシ Worker
 * ---------------------------------------------------------------
 * ブラウザから直接 R2 を触らせず、Firebase Auth の ID トークンを
 * 検証してから R2 (env.R2) を叩くゲートウェイ。
 *
 * ルート:
 *   OPTIONS *                                → CORS プリフライト
 *   GET     /api/r2/projects/<pid>/<path>    → R2 GET
 *   PUT     /api/r2/projects/<pid>/<path>    → R2 PUT（body そのまま）
 *   DELETE  /api/r2/projects/<pid>/<path>    → R2 DELETE
 *   GET     /api/r2/list/projects/<pid>/     → R2 LIST（prefix）
 *   DELETE  /api/r2/purge/projects/<pid>/    → R2 LIST→DELETE 全消し
 *
 * 認可:
 *   - Authorization: Bearer <Firebase ID token>
 *   - トークンの aud/iss/exp/署名を検証（Firebase 公開鍵）
 *   - email が Firestore `laynaAccess/config.allowedEmails`
 *     または allowedDomains か、`laynaAccess/invited` に含まれるかを確認
 *   - key の先頭が `projects/<pid>/` に一致することを検証
 *
 * 環境変数（wrangler.toml or secret）:
 *   [vars]  FIREBASE_PROJECT_ID    Firebase の projectId
 *   [vars]  ALLOW_ORIGIN           カンマ区切り許可オリジン
 *   secret  FIREBASE_SERVICE_ACCOUNT  Firestore を読むための SA JSON（1行）
 *   binding R2                     R2 バケット
 */

const KEY_PREFIX = 'projects/';

// ---------- 公開鍵キャッシュ ----------
let _keysCache = { at: 0, keys: null };
async function getGooglePublicKeys() {
  const now = Date.now();
  if (_keysCache.keys && (now - _keysCache.at) < 60 * 60 * 1000) return _keysCache.keys;
  const r = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('failed to fetch google public keys');
  const j = await r.json();
  _keysCache = { at: now, keys: j };
  return j;
}

// ---------- 小物 ----------
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function b64urlDecodeText(s) {
  const u8 = b64urlDecode(s);
  return new TextDecoder().decode(u8);
}
function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g, '');
  return b64urlDecode(b64.replace(/\+/g, '-').replace(/\//g, '_'));
}

async function importCert(pem) {
  const der = pemToArrayBuffer(pem);
  // x509 pem をそのまま importKey で扱えるブラウザ/Worker は限定的なので、
  // Firebase 側は SPKI と JWK も返せるが x509 が来る。ここでは crypto.subtle が
  // 'spki' しか受け付けない環境向けに、cert 内の subjectPublicKeyInfo を切り出す。
  // Workers runtime は 'raw'/'pkcs8'/'spki'/'jwk' しかサポートしないため、
  // x509 は WebCrypto では直接読めない → 別実装として jwks エンドポイントを使う。
  throw new Error('use jwks path instead');
}

// Firebase は securetoken.google.com の JWKS も公開している
let _jwksCache = { at: 0, keys: null };
async function getFirebaseJWKS() {
  const now = Date.now();
  if (_jwksCache.keys && (now - _jwksCache.at) < 60 * 60 * 1000) return _jwksCache.keys;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('failed to fetch jwks');
  const j = await r.json();
  _jwksCache = { at: now, keys: j.keys || [] };
  return _jwksCache.keys;
}

async function verifyIdToken(token, projectId) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const header = JSON.parse(b64urlDecodeText(parts[0]));
  const payload = JSON.parse(b64urlDecodeText(parts[1]));
  const sig = b64urlDecode(parts[2]);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('token expired');
  if (payload.iat && payload.iat > now + 300) throw new Error('token iat in future');
  if (payload.aud !== projectId) throw new Error('aud mismatch');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('iss mismatch');
  if (!payload.sub) throw new Error('no sub');

  const jwks = await getFirebaseJWKS();
  const jwk = jwks.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('kid not found');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signedBytes = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, signedBytes);
  if (!ok) throw new Error('signature invalid');
  return payload;
}

// ---------- Firestore access check ----------
// laynaAccess/config, laynaAccess/invited を Service Account で読む
let _saTokenCache = { at: 0, token: null };
async function getSaAccessToken(env) {
  const now = Date.now();
  if (_saTokenCache.token && (now - _saTokenCache.at) < 50 * 60 * 1000) return _saTokenCache.token;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
  const iat = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat, exp: iat + 3600,
  };
  const enc = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const toSign = enc(header) + '.' + enc(claim);
  const pkPem = sa.private_key;
  const pkDer = pemToArrayBuffer(pkPem);
  const key = await crypto.subtle.importKey('pkcs8', pkDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(toSign)));
  let sigB64 = btoa(String.fromCharCode(...sig)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = toSign + '.' + sigB64;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt,
  });
  if (!r.ok) throw new Error('sa token exchange failed: ' + r.status);
  const j = await r.json();
  _saTokenCache = { at: now, token: j.access_token };
  return j.access_token;
}

async function firestoreGetDoc(env, path) {
  const token = await getSaAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  const r = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('firestore get failed: ' + r.status);
  return r.json();
}

function fsField(doc, name) {
  const f = doc && doc.fields && doc.fields[name];
  if (!f) return null;
  if (f.arrayValue) return (f.arrayValue.values || []).map(v => v.stringValue || v.integerValue || null);
  if ('stringValue' in f) return f.stringValue;
  if ('booleanValue' in f) return f.booleanValue;
  return null;
}

// _accessCache は VeryLow-cost で 60 秒だけ持つ（Worker インスタンス生存中のみ）
let _accessCache = { at: 0, cfg: null, invited: null, json: null };

// LayCAT 本体と同じく、GitHub Pages に置いた access.json をフォールバックとして参照する。
// 本体の判定は「access.json → Firestore で上書き」の順なので、Worker 側でも両方参照する。
async function loadAccessJson(env) {
  try {
    const origin = ((env.ALLOW_ORIGIN || '').split(',')[0] || '').trim().replace(/\/$/, '');
    if (!origin) return null;
    const r = await fetch(origin + '/lay_cat/access.json', { cf: { cacheTtl: 60 } });
    if (!r.ok) {
      // GitHub Pages のリポジトリ配下でない場合のフォールバック
      const r2 = await fetch(origin + '/access.json', { cf: { cacheTtl: 60 } });
      if (!r2.ok) return null;
      return await r2.json();
    }
    return await r.json();
  } catch (_) { return null; }
}

async function isAllowed(email, env) {
  if (!email) return false;
  const now = Date.now();
  if (!_accessCache.cfg || (now - _accessCache.at) > 60 * 1000) {
    const cfg = await firestoreGetDoc(env, 'laynaAccess/config').catch(() => null);
    const invited = await firestoreGetDoc(env, 'laynaAccess/invited').catch(() => null);
    const json = await loadAccessJson(env);
    _accessCache = { at: now, cfg, invited, json };
  }
  const cfg = _accessCache.cfg;
  const invited = _accessCache.invited;
  const json = _accessCache.json;

  // Firestore 側の authRequired = false は明示的な認証オフ扱い
  const authRequired = cfg ? fsField(cfg, 'authRequired') : (json ? json.authRequired : true);
  if (authRequired === false) return true;

  // access.json と Firestore の許可リストを合算して評価（本体と同じ挙動）
  const admins = [
    ...((cfg && fsField(cfg, 'adminEmails')) || []),
    ...((json && json.adminEmails) || []),
  ];
  const allowed = [
    ...((cfg && fsField(cfg, 'allowedEmails')) || []),
    ...((json && json.allowedEmails) || []),
  ];
  const domains = [
    ...((cfg && fsField(cfg, 'allowedDomains')) || []),
    ...((json && json.allowedDomains) || []),
  ];
  const invitedListRaw = (invited && invited.fields && invited.fields.emails);
  const invitedList = [];
  // laynaAccess/invited は emails マップ ({[key]: {email, ...}}) 形式で保存されているので Map 展開する
  if (invitedListRaw && invitedListRaw.mapValue && invitedListRaw.mapValue.fields) {
    for (const k of Object.keys(invitedListRaw.mapValue.fields)) {
      const f = invitedListRaw.mapValue.fields[k];
      if (f && f.mapValue && f.mapValue.fields && f.mapValue.fields.email) {
        const e = f.mapValue.fields.email.stringValue;
        if (e) invitedList.push(e);
      }
    }
  } else if (Array.isArray(invitedListRaw)) {
    invitedList.push(...invitedListRaw);
  }

  const lower = email.toLowerCase();
  if (admins.map(x => (x || '').toLowerCase()).includes(lower)) return true;
  if (allowed.map(x => (x || '').toLowerCase()).includes(lower)) return true;
  if (invitedList.map(x => (x || '').toLowerCase()).includes(lower)) return true;
  const dom = lower.split('@')[1];
  if (dom && domains.map(x => (x || '').toLowerCase()).includes(dom)) return true;
  return false;
}

// ---------- CORS ----------
function corsHeaders(env, req) {
  const origin = req.headers.get('origin') || '';
  const allowed = (env.ALLOW_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const allow = allowed.includes('*') || allowed.includes(origin) ? origin : (allowed[0] || '');
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,x-laycat-content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
}

function json(env, req, obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json', ...corsHeaders(env, req) },
  });
}

// ---------- Router ----------
export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env, req) });
    }
    const url = new URL(req.url);
    const path = url.pathname;

    // 認証
    let payload;
    try {
      const auth = req.headers.get('authorization') || '';
      if (!auth.startsWith('Bearer ')) throw new Error('no bearer');
      payload = await verifyIdToken(auth.slice(7), env.FIREBASE_PROJECT_ID);
    } catch (e) {
      return json(env, req, { error: 'unauthorized', detail: String(e.message || e) }, 401);
    }
    try {
      const ok = await isAllowed(payload.email, env);
      if (!ok) return json(env, req, { error: 'forbidden' }, 403);
    } catch (e) {
      return json(env, req, { error: 'access-check-failed', detail: String(e.message || e) }, 500);
    }

    // /api/r2/list/projects/<pid>/
    let m = path.match(/^\/api\/r2\/list\/(projects\/[^/]+\/.*)$/);
    if (m && req.method === 'GET') {
      const prefix = m[1];
      const list = await env.R2.list({ prefix });
      return json(env, req, {
        objects: list.objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded })),
        truncated: list.truncated,
      });
    }

    // /api/r2/purge/projects/<pid>/
    m = path.match(/^\/api\/r2\/purge\/(projects\/[^/]+\/)$/);
    if (m && req.method === 'DELETE') {
      const prefix = m[1];
      let cursor = undefined, total = 0;
      while (true) {
        const list = await env.R2.list({ prefix, cursor });
        if (!list.objects.length) break;
        await Promise.all(list.objects.map(o => env.R2.delete(o.key)));
        total += list.objects.length;
        if (!list.truncated) break;
        cursor = list.cursor;
      }
      return json(env, req, { deleted: total });
    }

    // /api/r2/projects/<pid>/<path>
    m = path.match(/^\/api\/r2\/(projects\/[^/]+\/.+)$/);
    if (m) {
      const key = m[1];
      if (!key.startsWith(KEY_PREFIX)) return json(env, req, { error: 'invalid-key' }, 400);

      if (req.method === 'GET') {
        const obj = await env.R2.get(key);
        if (!obj) return json(env, req, { error: 'not-found' }, 404);
        const h = new Headers(corsHeaders(env, req));
        obj.writeHttpMetadata(h);
        if (!h.get('content-type')) h.set('content-type', 'application/octet-stream');
        h.set('etag', obj.httpEtag);
        return new Response(obj.body, { status: 200, headers: h });
      }
      if (req.method === 'PUT') {
        const contentType = req.headers.get('x-laycat-content-type') || req.headers.get('content-type') || 'application/octet-stream';
        await env.R2.put(key, req.body, { httpMetadata: { contentType } });
        return json(env, req, { ok: true, key });
      }
      if (req.method === 'DELETE') {
        await env.R2.delete(key);
        return json(env, req, { ok: true, key });
      }
      return json(env, req, { error: 'method-not-allowed' }, 405);
    }

    return json(env, req, { error: 'not-found' }, 404);
  },
};
